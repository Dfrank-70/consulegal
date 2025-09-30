import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

// GET - Ottieni un provider LLM specifico
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const provider = await prisma.lLMProvider.findUnique({
      where: { id: params.id }
    });

    if (!provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    }

    return NextResponse.json(provider);
  } catch (error) {
    console.error('Error fetching LLM provider:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Aggiorna un provider LLM
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, apiKey, isActive, config } = body;

    const provider = await prisma.lLMProvider.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(apiKey && { apiKey }),
        ...(isActive !== undefined && { isActive }),
        ...(config !== undefined && { config })
      }
    });

    return NextResponse.json(provider);
  } catch (error) {
    console.error('Error updating LLM provider:', error);
    
    if (error.code === 'P2002') {
      return NextResponse.json({ 
        error: 'A provider with this name already exists' 
      }, { status: 400 });
    }
    
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Elimina un provider LLM
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prisma.lLMProvider.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting LLM provider:', error);
    
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
