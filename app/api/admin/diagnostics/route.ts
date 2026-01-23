import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const maxFileBytes = parseInt(process.env.MAX_FILE_BYTES || '1048576', 10);
    const maxInputTokens = parseInt(process.env.MAX_INPUT_TOKENS || '8000', 10);

    return NextResponse.json({
      max_file_bytes: Number.isFinite(maxFileBytes) ? maxFileBytes : 1048576,
      max_input_tokens: Number.isFinite(maxInputTokens) ? maxInputTokens : 8000,
    });
  } catch (error: any) {
    console.error('[ADMIN_DIAGNOSTICS_GET]', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 }
    );
  }
}
