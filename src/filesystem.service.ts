import { Injectable } from '@nestjs/common';
import { createReadStream, existsSync, statSync, readFileSync } from 'fs';
import { join } from 'path';
import { Response } from 'express';
import { createDecipheriv } from 'crypto';

@Injectable()
export class FilesystemService {
  private readonly basePath: string;
  private readonly decryptionKey: Buffer;

  constructor() {
    // Base path onde os arquivos estão armazenados
    this.basePath = process.env.RECORDINGS_BASE_PATH || '/recordings';

    // Carregar chave de descriptografia
    const keyPath = process.env.RECORDINGS_KEY_FILE || '/run/secrets/recordings.key';
    try {
      const keyHex = readFileSync(keyPath, 'utf8').trim();
      this.decryptionKey = Buffer.from(keyHex, 'base64');
      console.log(`[FilesystemService] Chave de descriptografia carregada de: ${keyPath}`);
    } catch (error) {
      console.error(`[FilesystemService] ERRO: Não foi possível carregar a chave de descriptografia de ${keyPath}`);
      throw error;
    }
  }

  /**
   * Constrói o caminho completo do arquivo
   * Converte estrutura antiga (S3Directory, S3FileName) para caminho filesystem
   */
  private buildFilePath(directory: string, fileName: string): string {
    // Remove barras iniciais/finais
    const cleanDir = directory.replace(/^\/|\/$/g, '');

    // Caminho completo: /recordings/{directory}/{fileName}
    return join(this.basePath, cleanDir, fileName);
  }

  /**
   * Verifica se arquivo existe
   */
  fileExists(directory: string, fileName: string): boolean {
    const filePath = this.buildFilePath(directory, fileName);
    return existsSync(filePath);
  }

  /**
   * Retorna tamanho do arquivo em bytes
   */
  getFileSize(directory: string, fileName: string): number {
    const filePath = this.buildFilePath(directory, fileName);
    if (!existsSync(filePath)) return 0;
    return statSync(filePath).size;
  }

  /**
   * Descriptografa o arquivo e retorna um stream legível junto com o tamanho
   * Arquivos são criptografados com AES-256-GCM:
   * - Primeiros 16 bytes: IV
   * - Restante: Dados criptografados (sem auth tag)
   */
  private createDecryptStream(filePath: string): { stream: any; size: number } {
    const { Readable } = require('stream');

    // Ler arquivo inteiro
    const encryptedData = readFileSync(filePath);

    // Extrair IV (primeiros 16 bytes)
    const iv = encryptedData.slice(0, 16);
    const ciphertext = encryptedData.slice(16);

    // Criar decipher GCM
    const decipher = createDecipheriv('aes-256-gcm', this.decryptionKey, iv);

    // Descriptografar usando apenas update() - não podemos chamar final() sem auth tag
    const decrypted = decipher.update(ciphertext);

    // Criar stream a partir do buffer descriptografado
    const readable = new Readable();
    readable.push(decrypted);
    readable.push(null);

    return { stream: readable, size: decrypted.length };
  }

  /**
   * Retorna stream descriptografado para leitura do arquivo
   * Usado para streaming direto ao cliente e para ZIP
   */
  getStream(directory: string, fileName: string) {
    const filePath = this.buildFilePath(directory, fileName);

    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    return this.createDecryptStream(filePath);
  }

  /**
   * Stream arquivo descriptografado diretamente para a resposta HTTP
   * Substitui getFile() e downloadFile() do S3Service
   */
  streamFile(
    directory: string,
    fileName: string,
    res: Response,
    disposition: 'inline' | 'attachment' = 'inline'
  ) {
    const filePath = this.buildFilePath(directory, fileName);

    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Criar stream descriptografado
    const { stream, size } = this.createDecryptStream(filePath);

    // Detectar MIME type baseado na extensão
    const ext = fileName.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      'ogg': 'audio/ogg',
      'opus': 'audio/opus',
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'm4a': 'audio/mp4',
    };
    const contentType = mimeTypes[ext || ''] || 'audio/ogg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', size);
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${fileName}"`
    );

    // Pipe stream descriptografado para resposta
    stream.pipe(res);

    // Tratar erros no stream
    stream.on('error', (error) => {
      console.error(`[FilesystemService] Erro ao descriptografar ${filePath}:`, error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to decrypt audio file' });
      }
    });

    return stream;
  }
}
