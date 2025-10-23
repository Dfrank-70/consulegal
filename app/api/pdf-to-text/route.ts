import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const startTime = Date.now();
  const tempPath = `/tmp/pdf-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`;

  try {
    // 1. Salva il PDF temporaneamente
    const buffer = await req.arrayBuffer();
    await fs.writeFile(tempPath, Buffer.from(buffer));

    // 2. Converti in testo con opzioni per italiano
    const text = execSync(`
      pdftotext -enc UTF-8 -layout -nopgbrk \"${tempPath}\" - 
    `, { maxBuffer: 50 * 1024 * 1024 }) // 50MB buffer
      .toString()
      .normalize('NFC'); // Normalizza accenti

    // 3. Statistiche
    const stats = {
      size_kb: buffer.byteLength / 1024,
      chars: text.length,
      lines: text.split('\n').length,
      processing_ms: Date.now() - startTime
    };

    return NextResponse.json({ 
      text, 
      metadata: stats 
    });

  } catch (error) {
    console.error('[PDF-TO-TEXT] Error:', error);
    return NextResponse.json(
      { 
        error: 'Conversione fallita', 
        details: error instanceof Error ? error.message : String(error)
      }, 
      { status: 500 }
    );
  } finally {
    // 4. Pulizia garantita
    await fs.unlink(tempPath).catch(() => {});
  }
}
