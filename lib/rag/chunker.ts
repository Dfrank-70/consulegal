// Text Chunking for RAG with configurable presets

import { Readable } from 'stream';
import { ChunkConfig, ChunkPreset, CHUNK_PRESETS } from './types';

export interface Chunk {
  content: string;
  chunkIndex: number;
  startChar: number;
  endChar: number;
  metadata?: Record<string, any>;
}

/**
 * Split text into overlapping chunks
 */
export async function chunkText(
  textOrStream: string | Readable,
  config: ChunkConfig = CHUNK_PRESETS.default,
  metadata?: Record<string, any>
): Promise<Chunk[]> {
  if (typeof textOrStream === 'string') {
    return chunkTextFromString(textOrStream, config, metadata);
  } else {
    return chunkTextFromStream(textOrStream, config, metadata);
  }
}

function chunkTextFromString(
  text: string,
  config: ChunkConfig,
  metadata?: Record<string, any>
): Chunk[] {
  const { chunkSize, overlap } = config;
  const chunks: Chunk[] = [];
  
  // Clean text: normalize whitespace
  const cleanedText = text.replace(/\s+/g, ' ').trim();
  
  if (cleanedText.length === 0) {
    return chunks;
  }

  let startChar = 0;
  let chunkIndex = 0;

  while (startChar < cleanedText.length) {
    const endChar = Math.min(startChar + chunkSize, cleanedText.length);
    let chunkContent = cleanedText.slice(startChar, endChar);

    // Try to break at sentence boundary if not at end
    if (endChar < cleanedText.length) {
      const lastPeriod = chunkContent.lastIndexOf('. ');
      const lastNewline = chunkContent.lastIndexOf('\n');
      const breakPoint = Math.max(lastPeriod, lastNewline);

      if (breakPoint > chunkSize * 0.5) {
        // Only break if we're past halfway through the chunk
        chunkContent = chunkContent.slice(0, breakPoint + 1).trim();
      }
    }

    chunks.push({
      content: chunkContent.trim(),
      chunkIndex,
      startChar,
      endChar: startChar + chunkContent.length,
      metadata,
    });

    if (endChar >= cleanedText.length) {
      break;
    }

    const advance = chunkContent.length - overlap;
    startChar += Math.max(advance, 1);
    chunkIndex++;

    // Prevent infinite loop
    if (startChar >= cleanedText.length) {
      break;
    }
  }

  return chunks;
}

/**
 * Get chunk configuration by preset name
 */
export function getChunkConfig(preset: ChunkPreset = 'default'): ChunkConfig {
  return CHUNK_PRESETS[preset] || CHUNK_PRESETS.default;
}

/**
 * Chunk text with a preset
 */
async function chunkTextFromStream(
  stream: Readable,
  config: ChunkConfig,
  metadata?: Record<string, any>
): Promise<Chunk[]> {
  return new Promise((resolve, reject) => {
    const chunks: Chunk[] = [];
    let buffer = '';
    let chunkIndex = 0;
    let totalCharsProcessed = 0;

    stream.on('data', (data: Buffer) => {
      buffer += data.toString();

      while (buffer.length >= config.chunkSize) {
        const chunkContent = buffer.slice(0, config.chunkSize);
        chunks.push({
          content: chunkContent,
          chunkIndex,
          startChar: totalCharsProcessed,
          endChar: totalCharsProcessed + chunkContent.length,
          metadata,
        });

        buffer = buffer.slice(chunkContent.length - config.overlap);
        totalCharsProcessed += chunkContent.length;
        chunkIndex++;
      }
    });

    stream.on('end', () => {
      if (buffer.length > 0) {
        chunks.push({
          content: buffer,
          chunkIndex,
          startChar: totalCharsProcessed,
          endChar: totalCharsProcessed + buffer.length,
          metadata,
        });
      }
      resolve(chunks);
    });

    stream.on('error', reject);
  });
}

export async function chunkTextWithPreset(
  textOrStream: string | Readable,
  preset: ChunkPreset = 'default',
  metadata?: Record<string, any>
): Promise<Chunk[]> {
  const config = getChunkConfig(preset);
  return chunkText(textOrStream, config, metadata);
}

/**
 * Estimate page number from character position (rough heuristic)
 * Assumes ~2000 chars per page on average
 */
export function estimatePageNumber(charPosition: number, charsPerPage: number = 2000): number {
  return Math.floor(charPosition / charsPerPage) + 1;
}
