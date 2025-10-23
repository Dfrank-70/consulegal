// lib/rag/parser.ts
import mammoth from 'mammoth';
import WordExtractor from 'word-extractor';
import { spawn } from 'child_process';
import { Readable } from 'stream';

export interface ParsedDocument {
  text: string;
  metadata?: {
    pages?: number;
    [key: string]: any;
  };
}

export async function parseDocument(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<ParsedDocument> {
  const lowerMime = mimeType.toLowerCase();
  const lowerFilename = filename.toLowerCase();

  if (lowerMime.includes('pdf') || lowerFilename.endsWith('.pdf')) {
    return parsePDF(buffer);
  } else if (
    lowerMime.includes('wordprocessingml') ||
    lowerFilename.endsWith('.docx')
  ) {
    return parseDOCX(buffer);
  } else if (
    lowerMime.includes('msword') ||
    lowerFilename.endsWith('.doc')
  ) {
    return parseDOC(buffer);
  } else if (lowerMime.includes('text') || lowerFilename.endsWith('.txt')) {
    return parseTXT(buffer);
  } else {
    throw new Error(`Unsupported file type: ${mimeType}`);
  }
}

async function parsePDF(buffer: Buffer): Promise<ParsedDocument> {
  const PDFTOTEXT_PATH = '/opt/homebrew/bin/pdftotext';

  try {
    const textStream = new Readable();
    textStream._read = () => {};

    // Esegui pdftotext per leggere da stdin ('-') e scrivere su stdout ('-')
    const child = spawn(PDFTOTEXT_PATH, ['-enc', 'UTF-8', '-layout', '-', '-']);

    // Invia il buffer del PDF direttamente al processo
    child.stdin.write(buffer);
    child.stdin.end();

    // Ascolta il testo estratto
    child.stdout.on('data', (data) => textStream.push(data));
    child.stderr.on('data', (data) => console.error(`[PDF-STDERR] ${data.toString()}`));
    child.on('close', () => textStream.push(null));
    child.on('error', (err) => textStream.emit('error', err));

    return {
      text: textStream as any,
      metadata: { streamed: true },
    };
  } catch (error) {
    console.error('[PDF-PARSER] Fallimento critico:', error);
    throw new Error('Impossibile avviare il processo di parsing del PDF.');
  }
}

async function parseDOCX(buffer: Buffer): Promise<ParsedDocument> {
  const result = await mammoth.extractRawText({ buffer });
  const text = (result.value || '').replace(/\s+/g, ' ').trim();
  return { text, metadata: {} };
}

async function parseDOC(buffer: Buffer): Promise<ParsedDocument> {
  const extractor = new WordExtractor();
  const extracted = await extractor.extract(buffer);
  const text = (extracted.getBody() || '').replace(/\s+/g, ' ').trim();
  return { text, metadata: {} };
}

async function parseTXT(buffer: Buffer): Promise<ParsedDocument> {
  const text = buffer.toString('utf-8').trim();
  return { text, metadata: {} };
}
