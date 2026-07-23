import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  GenesysConversation,
  GenesysRecording,
  GenesysConversationUser,
  GenesysConversationWrapupCode,
} from './entities/genesys-audio.entity';
import { FilesystemService } from '../filesystem.service';
import { GenesysService } from '../genesys/genesys.service';
import * as archiver from 'archiver';
import { Response } from 'express';
import { readFileSync } from 'fs';

@Injectable()
export class AudioService {
  private readonly encryptionKey: string;

  constructor(
    @InjectRepository(GenesysConversation)
    private readonly conversationRepository: Repository<GenesysConversation>,
    @InjectRepository(GenesysRecording)
    private readonly recordingRepository: Repository<GenesysRecording>,
    @InjectRepository(GenesysConversationUser)
    private readonly conversationUserRepository: Repository<GenesysConversationUser>,
    @InjectRepository(GenesysConversationWrapupCode)
    private readonly wrapupCodeRepository: Repository<GenesysConversationWrapupCode>,
    @Inject(FilesystemService)
    private readonly filesystemService: FilesystemService,
    private readonly genesysService: GenesysService
  ) {
    // Load encryption key for decrypt_value() SQL function
    const keyPath = process.env.RECORDINGS_KEY_FILE || '/run/secrets/recordings.key';
    try {
      this.encryptionKey = readFileSync(keyPath, 'utf8').trim();
      console.log(`[AudioService] Encryption key loaded from: ${keyPath}`);
    } catch (error) {
      console.error(`[AudioService] WARNING: Could not load encryption key from ${keyPath}`);
      this.encryptionKey = '';
    }
  }

  /**
   * Build the base query for Genesys data with all necessary joins and field mappings
   */
  private buildGenesysQuery() {
    return this.conversationRepository
      .createQueryBuilder('c')
      .leftJoin(GenesysRecording, 'r', 'c.conversation_id = r.conversation_id AND r.file_path IS NOT NULL')
      .leftJoin(
        subQuery => subQuery
          .select('cu.conversation_id', 'conv_id')
          .addSelect('cu.user_id', 'user_id')
          .from(GenesysConversationUser, 'cu')
          .distinctOn(['cu.conversation_id']),
        'agent',
        'c.conversation_id = agent.conv_id'
      )
      .leftJoin(
        subQuery => subQuery
          .select('cw.conversation_id', 'conv_id')
          .addSelect('cw.wrapup_code', 'wrapup_code')
          .from(GenesysConversationWrapupCode, 'cw')
          .distinctOn(['cw.conversation_id']),
        'wrapup',
        'c.conversation_id = wrapup.conv_id'
      )
      .select([
        'c.conversation_id as "CallIDMaster"',
        `genesys.decrypt_value(c.ani_displayable, :encryptionKey) as "ANI"`,
        `genesys.decrypt_value(c.dnis_displayable, :encryptionKey) as "DNIS"`,
        'c.conversation_start_time as "RecordStart"',
        'COALESCE(c.duration_ms / 1000, 0) as "RecordDuration"',
        'c.division_id as "CampaignId"',
        'c.division_name as "Campaignname"',
        'r.file_size as "DestinationFileSize"',
        `regexp_replace(genesys.decrypt_value(r.file_path, :encryptionKey), '/[^/]+$', '') as "S3Directory"`,
        `regexp_replace(genesys.decrypt_value(r.file_path, :encryptionKey), '.*/([^/]+)$', '\\1') as "S3FileName"`,
        `regexp_replace(genesys.decrypt_value(r.file_path, :encryptionKey), '.*/([^/]+)$', '\\1') as "DestinationFileName"`,
        'agent.user_id as "AgentId"',
        'agent.user_id as "Username"',
        'wrapup.wrapup_code as "Disposition"',
        'wrapup.wrapup_code as "Dispositionname"',
        'c.initial_direction as "Direction"',
        'c.media_type as "MediaType"',
        'r.content_type as "ContentType"',
      ])
      .setParameter('encryptionKey', this.encryptionKey);
  }

  async findAll(filterTypes: string[], filterValues: string[]) {
    let query = this.buildGenesysQuery();

    const ranges: Record<string, { start?: string; end?: string }> = {};

    filterTypes.forEach((type, index) => {
      if (!type) return;
      const value = filterValues[index];

      // Check if it's a range filter (ends with Start or End)
      const startMatch = type.match(/^(.+)StartStart$/);
      const endMatch = type.match(/^(.+)StartEnd$/);

      if (startMatch) {
        const field = startMatch[1] + 'Start';
        ranges[field] ??= {};
        ranges[field].start = value;
        return;
      }

      if (endMatch) {
        const field = endMatch[1] + 'Start';
        ranges[field] ??= {};
        ranges[field].end = value;
        return;
      }

      if (type === 'RecordStart') {
        const startOfDay = `${value} 00:00:00.000`;
        const endOfDay = `${value} 23:59:59.999`;
        query = query.andWhere(`c.conversation_start_time BETWEEN :start${index} AND :end${index}`, {
          [`start${index}`]: startOfDay,
          [`end${index}`]: endOfDay,
        });
      } else if (type === 'RecordStartHour') {
        const startHour = value;
        const endHour = `${startHour.split(':')[0]}:59`;
        query = query.andWhere(
          `TO_CHAR(c.conversation_start_time, 'HH24:MI') BETWEEN :startHour${index} AND :endHour${index}`,
          {
            [`startHour${index}`]: startHour,
            [`endHour${index}`]: endHour,
          }
        );
      } else if (type === 'ANI') {
        // Search in both ANI and DNIS (decrypted)
        query = query.andWhere(
          `(genesys.decrypt_value(c.ani_displayable, :encryptionKey) LIKE :phone${index} OR genesys.decrypt_value(c.dnis_displayable, :encryptionKey) LIKE :phone${index})`,
          { [`phone${index}`]: `%${value}%` }
        );
      } else if (type === 'Agent') {
        query = query.andWhere(`agent.user_id = :agentId${index}`, {
          [`agentId${index}`]: value,
        });
      } else if (type === 'Campaign') {
        query = query.andWhere(`c.division_id = :campaignId${index}`, {
          [`campaignId${index}`]: value,
        });
      } else if (type === 'Disposition') {
        query = query.andWhere(`wrapup.wrapup_code = :dispositionId${index}`, {
          [`dispositionId${index}`]: value,
        });
      } else if (type === 'Direction') {
        query = query.andWhere(`c.initial_direction = :direction${index}`, {
          [`direction${index}`]: value,
        });
      }
    });

    // Handle date ranges
    let rangeIdx = 0;
    Object.entries(ranges).forEach(([field, { start, end }]) => {
      // Map RecordStart to conversation_start_time
      const dbField = field === 'RecordStart' ? 'c.conversation_start_time' : `c.${field}`;

      if (start && end) {
        const startTs = `${start} 00:00:00.000`;
        const endTs = `${end} 23:59:59.999`;
        query = query.andWhere(`${dbField} BETWEEN :rStart${rangeIdx} AND :rEnd${rangeIdx}`, {
          [`rStart${rangeIdx}`]: startTs,
          [`rEnd${rangeIdx}`]: endTs,
        });
      } else if (start) {
        const startTs = `${start} 00:00:00.000`;
        query = query.andWhere(`${dbField} >= :rStart${rangeIdx}`, {
          [`rStart${rangeIdx}`]: startTs,
        });
      } else if (end) {
        const endTs = `${end} 23:59:59.999`;
        query = query.andWhere(`${dbField} <= :rEnd${rangeIdx}`, {
          [`rEnd${rangeIdx}`]: endTs,
        });
      }
      rangeIdx++;
    });

    query = query.orderBy('c.conversation_start_time', 'DESC');

    let data;
    try {
      data = await query.limit(500).getRawMany();
    } catch (error) {
      console.error('[AudioService] Error querying Genesys data:', error.message);
      data = [];
    }

    // Enriquecer com nomes de usuários da API do Genesys
    if (data.length > 0) {
      data = await this.genesysService.enrichWithUserNames(data);
    }

    return data;
  }

  async findOne(id: string, date: string) {
    let query = this.buildGenesysQuery();

    query = query.andWhere('c.conversation_id = :id', { id });

    const data = await query.getRawOne();

    if (!data) {
      return;
    }

    // Check if file exists in filesystem
    const fileExists = data.S3Directory && data.S3FileName
      ? this.filesystemService.fileExists(data.S3Directory, data.S3FileName)
      : false;

    return {
      ...data,
      fileExists,
      filePath: data.S3Directory && data.S3FileName
        ? `${data.S3Directory}/${data.S3FileName}`
        : null,
    };
  }

  async findSome(ids: string[], date: string) {
    let query = this.buildGenesysQuery();

    query = query.andWhere('c.conversation_id IN (:...ids)', { ids });

    const data = await query.getRawMany();

    if (!data) {
      return;
    }

    return data;
  }

  async streamZipFromFilesystem(ids: string[], res: Response, date: string) {
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    for (const id of ids) {
      try {
        const audio = await this.findOne(id, date);

        if (!audio || !audio.fileExists) {
          console.log(`Arquivo não encontrado para áudio ${id}, pulando...`);
          continue;
        }

        // Create stream from local file
        const { stream: fileStream } = this.filesystemService.getStream(
          audio.S3Directory,
          audio.S3FileName
        );

        // Add to ZIP with appropriate name
        archive.append(fileStream, {
          name: audio.DestinationFileName || audio.S3FileName,
        });
      } catch (err) {
        console.error(`Erro ao adicionar o áudio ${id}:`, err.message);
      }
    }

    await archive.finalize();
  }
}
