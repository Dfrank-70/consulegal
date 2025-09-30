import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

// GET - Ottieni tutti i provider LLM
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const providers = await prisma.lLMProvider.findMany({
      orderBy: {
        name: 'asc',
      },
      select: {
        id: true,
        name: true,
        isActive: true,
        config: true,
      },
    });

    return NextResponse.json(providers);
  } catch (error) {
    console.error('Error fetching LLM providers:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Crea un nuovo provider LLM
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, apiKey, isActive, config } = body;

    if (!name || !apiKey) {
      return NextResponse.json({ 
        error: 'Name and API key are required' 
      }, { status: 400 });
    }

    const provider = await prisma.lLMProvider.create({
      data: {
        name,
        apiKey,
        isActive: isActive !== undefined ? isActive : true,
        config: config || {}
      }
    });

    return NextResponse.json(provider);
  } catch (error: any) {
    console.error('Error creating LLM provider:', error);
    
    // Gestisci errore di nome duplicato
    if (error.code === 'P2002') {
      return NextResponse.json({ 
        error: 'A provider with this name already exists' 
      }, { status: 400 });
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
