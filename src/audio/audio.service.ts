import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Gravacao } from './entities/gravacao.entity';
import { Response } from 'express';
import * as fs from 'fs';
import { parseFile, parseBuffer } from 'music-metadata';
import { S3Client, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

const archiver = require('archiver');

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
});

const S3_BUCKET = process.env.AWS_S3_BUCKET || 'safra-search-audio-e-video';

// regrinha pra rodar ou local ou no s3
// colocar USE_S3=true no .env quando quiser testar/usar o S3.
const USE_S3 = process.env.USE_S3 === 'true';

const MOCK_EXTRA_FIELDS = {
  CPF: null,
  CNPJ: null,
  AGENCIA: null,
  CONTA: null,
  EC: null,
  CONTRATO: null,
  PROTOCOLO: null,
};


function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

@Injectable()
export class AudioService {
  constructor(
    @InjectRepository(Gravacao)
    private readonly gravacaoRepository: Repository<Gravacao>,
  ) {}

  //calcula a duração real de cada arquivo
  private async calcularDuracaoPorId(referenciaAudio: string): Promise<number | null> {
    try {
      if (USE_S3) {
        const buffer = await this.getAudioBufferFromS3(referenciaAudio);
        const metadata = await parseBuffer(buffer);
        const duration = metadata.format.duration;
        return duration ? Math.floor(duration) : null;
      }

      const metadata = await parseFile(referenciaAudio);
      const duration = metadata.format.duration;
      return duration ? Math.floor(duration) : null;
    } catch (err) {
      console.error(`[AudioService] Erro ao calcular duração de ${referenciaAudio}:`, getErrorMessage(err));
      return null;
    }
  }

  /**
   * Converte uma Gravacao do banco para o formato RecordingMeta,
   * que é o que o front (useRecordings.ts) espera pra montar a tabela.
   * A duração vem do arquivo de áudio real (calculada com o import music-metadata);
   */
  private async mapToRecordingMeta(g: Gravacao) {
    const recordStart =
      g.dataGravacao && g.horaInicio
        ? `${g.dataGravacao}T${g.horaInicio}`
        : null;

    const duracaoReal = g.referenciaAudio
      ? await this.calcularDuracaoPorId(g.referenciaAudio)
      : null;

    const extension = g.referenciaAudio?.split('.').pop()?.toLowerCase();
    const contentType = extension ? this.getContentTypeForExtension(extension) : 'audio/mpeg';

    return {
      CallIDMaster: g.id,
      IdOrigem: g.idOrigem,
      ANI: g.origem,
      DNIS: g.destino,
      RecordStart: recordStart,
      RecordDuration: duracaoReal ?? g.duracaoSegundos ?? 0,
      CampaignId: g.sistemaOrigem,
      Campaignname: g.sistemaOrigem,
      DestinationFileSize: null,
      S3Directory: null,
      S3FileName: g.referenciaAudio,
      DestinationFileName: g.referenciaAudio,
      AgentId: g.agente,
      Username: g.agente,
      AgentLogin: g.agente,
      Disposition: null,
      Dispositionname: null,
      Direction: null,
      MediaType: 'audio',
      ContentType: contentType,
      FileExtension: extension ?? null,
      ...MOCK_EXTRA_FIELDS,
    };
  }

  //verifica se o arquivo existe no s3 via HeadObjectCommand
  private async checkFileExists(referenciaAudio: string): Promise<boolean> {
    if (USE_S3) {
      try {
        await s3Client.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: referenciaAudio }));
        return true;
      } catch {
        return false;
      }
    }
    return fs.existsSync(referenciaAudio);
  }

  /**
   * Busca os bytes do áudio a partir do "endereço" salvo em
   * referencia_audio. Controlado pelo toggle USE_S3:
   * - USE_S3=false (padrão): lê do disco local (fs.readFile) — bom
   *   para desenvolvimento sem depender da AWS.
   * - USE_S3=true: busca no bucket S3 configurado, usando
   *   referencia_audio como a KEY do objeto (ex: "CALL-014.mp3").
   * Nenhum outro lugar do sistema precisa mudar quando alternar entre
   * os dois modos — toda a decisão fica isolada aqui.
   */
  private async getAudioBuffer(referenciaAudio: string): Promise<Buffer> {
    if (USE_S3) {
      return this.getAudioBufferFromS3(referenciaAudio);
    }
    return fs.promises.readFile(referenciaAudio);
  }

  /**
   * Busca um objeto no S3 pela key e retorna como Buffer.
   */
  private async getAudioBufferFromS3(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    });

    const response = await s3Client.send(command);
    const stream = response.Body as Readable;

    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  }

  async findAll(filterTypes: string[], filterValues: string[]) {
    let query = this.gravacaoRepository.createQueryBuilder('g');

    filterTypes.forEach((type, index) => {
      if (!type) return;
      const value = filterValues[index];
      if (!value) return;

      if (type === 'RecordStart') {
        query = query.andWhere('g.data_gravacao = :date' + index, {
          ['date' + index]: value,
        });
      } else if (type === 'ANI') {
        query = query.andWhere(
          '(g.origem ILIKE :phone' + index + ' OR g.destino ILIKE :phone' + index + ')',
          { ['phone' + index]: `%${value}%` },
        );
      } else if (type === 'Agent') {
        query = query.andWhere('g.agente ILIKE :agent' + index, {
          ['agent' + index]: `%${value}%`,
        });
      } else if (type === 'Campaign') {
        query = query.andWhere('g.sistema_origem ILIKE :sistema' + index, {
          ['sistema' + index]: `%${value}%`,
        });
      }
    });

    query = query.orderBy('g.data_gravacao', 'DESC').addOrderBy('g.hora_inicio', 'DESC');

    let data: Gravacao[] = [];
    try {
      data = await query.limit(500).getMany();
    } catch (error) {
      console.error('[AudioService] Erro ao consultar gravacoes:', getErrorMessage(error));
      data = [];
    }

    return Promise.all(data.map((g) => this.mapToRecordingMeta(g)));
  }

  async findOne(id: string) {
    const gravacao = await this.gravacaoRepository.findOne({ where: { id } });

    if (!gravacao) {
      return null;
    }

    const fileExists = gravacao.referenciaAudio
      ? await this.checkFileExists(gravacao.referenciaAudio)
      : false;

    return {
      ...(await this.mapToRecordingMeta(gravacao)),
      fileExists,
      filePath: gravacao.referenciaAudio,
    };
  }

  async findSome(ids: string[]) {
    const data = await this.gravacaoRepository
      .createQueryBuilder('g')
      .where('g.id IN (:...ids)', { ids })
      .getMany();

    return Promise.all(data.map((g) => this.mapToRecordingMeta(g)));
  }

  /**
   * Retorna os bytes do áudio de uma gravação específica, para a rota
   * de streaming/play (GET /api/audio/play/:id) e para o download
   * individual. O content-type e a extensão do arquivo são detectados
   * a partir do próprio arquivo em referencia_audio.
   */
  async getAudioFile(id: string): Promise<{ buffer: Buffer; contentType: string; fileName: string } | null> {
    const gravacao = await this.gravacaoRepository.findOne({ where: { id } });

    if (!gravacao || !gravacao.referenciaAudio) {
      return null;
    }

    try {
      const buffer = await this.getAudioBuffer(gravacao.referenciaAudio);
      const extension = gravacao.referenciaAudio.split('.').pop()?.toLowerCase() || 'mp3';
      const contentType = this.getContentTypeForExtension(extension);
      const fileName = `${gravacao.idOrigem || gravacao.id}.${extension}`;

      return {
        buffer,
        contentType,
        fileName,
      };
    } catch (err) {
      console.error(`[AudioService] Erro ao ler áudio da gravação ${id}:`, getErrorMessage(err));
      return null;
    }
  }

  /**
   * Mapeia extensão de arquivo para o content-type correto.
   */
  private getContentTypeForExtension(extension: string): string {
    const map: Record<string, string> = {
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      m4a: 'audio/mp4',
      ogg: 'audio/ogg',
      flac: 'audio/flac',
    };

    return map[extension] || 'audio/mpeg';
  }

  /**
   * Gera um ZIP com os áudios das gravações selecionadas, lendo cada
   * arquivo a partir de referencia_audio (hoje um caminho local; no
   * futuro, um objeto no S3 — só getAudioBuffer muda). Cada entrada no
   * ZIP é nomeada com o id_origem da gravação (ex: CALL-014.mp3).
   */
  async streamZipFromFilesystem(ids: string[], res: Response) {
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    const gravacoes = await this.gravacaoRepository
      .createQueryBuilder('g')
      .where('g.id IN (:...ids)', { ids })
      .getMany();

    for (const gravacao of gravacoes) {
      try {
        if (!gravacao.referenciaAudio) {
          console.log(`[AudioService] Gravação ${gravacao.id} sem referencia_audio, pulando.`);
          continue;
        }

        const buffer = await this.getAudioBuffer(gravacao.referenciaAudio);
        const extension = gravacao.referenciaAudio.split('.').pop()?.toLowerCase() || 'mp3';
        const fileName = `${gravacao.idOrigem || gravacao.id}.${extension}`;

        archive.append(buffer, { name: fileName });
      } catch (err) {
        console.error(`[AudioService] Erro ao ler áudio da gravação ${gravacao.id}:`, getErrorMessage(err));
      }
    }

    await archive.finalize();
  }
}