import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Gravacao } from './entities/gravacao.entity';
import { Response } from 'express';
import * as fs from 'fs';
import { parseFile } from 'music-metadata';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const archiver = require('archiver');

// Campos mock/teste local que o front espera mas não existem no modelo
// canônico da especificação NICE (CPF, CNPJ, dados bancários, etc).
// Como não há coluna própria pra isso na tabela gravacoes, ficam fixos
// como mock até existir uma fonte real desses dados.
const MOCK_EXTRA_FIELDS = {
  CPF: null,
  CNPJ: null,
  AGENCIA: null,
  CONTA: null,
  EC: null,
  CONTRATO: null,
  PROTOCOLO: null,
};

/**
 * Extrai uma mensagem de erro segura a partir de um valor `unknown`
 * (tipo padrão de catch no TS moderno), evitando acesso direto a
 * `.message` em um valor não tipado.
 */
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

  /**
   * Calcula a duração real (em segundos) de um arquivo de áudio, lendo
   * seus metadados diretamente do arquivo em referencia_audio. Retorna
   * null se o arquivo não existir ou não for legível.
   */
  private async calcularDuracaoPorId(referenciaAudio: string): Promise<number | null> {
    try {
      const metadata = await parseFile(referenciaAudio);
      const duration = metadata.format.duration;
      return duration ? Math.floor(duration) : null;
    } catch (err) {
      console.error(`[AudioService] Erro ao calcular duração de ${referenciaAudio}:`, getErrorMessage(err));
      return null;
    }
  }

  /**
   * Mapeia uma entidade Gravacao para o formato que o front espera
   * (RecordingMeta em useRecordings.ts). RecordDuration agora reflete a
   * duração REAL do arquivo (lida via music-metadata), com fallback
   * para o valor digitado manualmente em duracao_segundos caso o
   * arquivo não possa ser lido.
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

  /**
   * Busca os bytes do áudio a partir do "endereço" salvo em
   * referencia_audio. Hoje é um caminho de arquivo local (fs.readFile);
   * quando migrar para S3, essa é a ÚNICA função que precisa mudar —
   * troca-se a leitura local por uma chamada ao SDK do S3
   * (ex: GetObjectCommand), mantendo a mesma assinatura de retorno
   * (Buffer). Nenhum outro lugar do sistema precisa ser alterado.
   */
  private async getAudioBuffer(referenciaAudio: string): Promise<Buffer> {
    return fs.promises.readFile(referenciaAudio);
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
          '(g.origem LIKE :phone' + index + ' OR g.destino LIKE :phone' + index + ')',
          { ['phone' + index]: `%${value}%` },
        );
      } else if (type === 'Agent') {
        query = query.andWhere('g.agente = :agent' + index, {
          ['agent' + index]: value,
        });
      } else if (type === 'Campaign') {
        query = query.andWhere('g.sistema_origem = :sistema' + index, {
          ['sistema' + index]: value,
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
      ? fs.existsSync(gravacao.referenciaAudio)
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