import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

const CONVERT_AUDIO_TO_MP3 =
  (process.env.CONVERT_AUDIO_TO_MP3 ?? 'true').toLowerCase() !== 'false';
const MP3_BITRATE = process.env.MP3_BITRATE || '128k';

/** Áudio que ainda não é MP3 (ex.: OGG da Genesys). */
export function shouldServeAsMp3(
  contentType?: string | null,
  fileName?: string | null,
): boolean {
  if (!CONVERT_AUDIO_TO_MP3) return false;
  const ct = String(contentType || '').toLowerCase();
  const name = String(fileName || '').toLowerCase();
  if (name.endsWith('.mp3') || ct.includes('mpeg') || ct.includes('mp3')) {
    return false;
  }
  if (ct.startsWith('video/')) return false;
  if (
    ct.includes('ogg') ||
    ct.includes('opus') ||
    ct.includes('wav') ||
    name.endsWith('.ogg') ||
    name.endsWith('.opus') ||
    name.endsWith('.wav') ||
    name.endsWith('.webm')
  ) {
    return true;
  }
  // Genesys: áudio costuma ser OGG mesmo quando metadata falha
  return ct.startsWith('audio/');
}

export function mp3FileName(fileName: string, recordingId: string): string {
  const base = (fileName || recordingId).replace(/\.[^.]+$/, '');
  return `${base || recordingId}.mp3`;
}

export async function convertBufferToMp3(input: Buffer): Promise<Buffer> {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'searchaudio-mp3-'));
  const inPath = path.join(workDir, 'source.bin');
  const outPath = path.join(workDir, 'output.mp3');
  try {
    await fs.writeFile(inPath, input);
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        'ffmpeg',
        [
          '-hide_banner',
          '-loglevel',
          'error',
          '-y',
          '-i',
          inPath,
          '-vn',
          '-acodec',
          'libmp3lame',
          '-ab',
          MP3_BITRATE,
          '-ar',
          '44100',
          '-ac',
          '2',
          outPath,
        ],
        { stdio: ['ignore', 'ignore', 'pipe'] },
      );
      let stderr = '';
      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) resolve();
        else {
          reject(
            new Error(
              `ffmpeg falhou (code=${code}): ${stderr.trim().slice(0, 500) || 'sem detalhe'}`,
            ),
          );
        }
      });
    });
    return await fs.readFile(outPath);
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
