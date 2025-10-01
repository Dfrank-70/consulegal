// app/api/admin/llm-providers/[providerId]/models/route.ts

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { modelCosts, getModelCost } from '@/lib/llm-costs';

const prisma = new PrismaClient();

interface ApiModel {
  id: string;
  // Altri campi potrebbero essere presenti ma non ci servono
}

export async function GET(request: Request, { params }: { params: { providerId: string } }) {
  const { providerId } = params;

  if (!providerId) {
    return NextResponse.json({ error: 'Provider ID mancante' }, { status: 400 });
  }

  try {
    const provider = await prisma.lLMProvider.findUnique({
      where: { id: providerId },
    });

    if (!provider) {
      return NextResponse.json({ error: 'Provider non trovato' }, { status: 404 });
    }

    const { name, config } = provider;
    const providerConfig = (config as Record<string, any>) || {};
    // apiKey: prima da config.apiKey, poi dal campo provider.apiKey
    const apiKey: string | undefined = providerConfig.apiKey || (provider as any).apiKey;
    // baseURL: da config.baseURL, altrimenti default per provider noti
    let baseURL: string | undefined = providerConfig.baseURL;
    const lowerName = (name || '').toLowerCase();
    if (!baseURL) {
      if (lowerName === 'openai') baseURL = 'https://api.openai.com/v1';
      else if (lowerName === 'anthropic' || lowerName === 'claude') baseURL = 'https://api.anthropic.com/v1';
    }

    if (!apiKey || !baseURL) {
      return NextResponse.json({ error: 'Configurazione del provider incompleta (apiKey o baseURL mancanti)' }, { status: 400 });
    }

    // Endpoint per ottenere i modelli, specifico per provider
    // NOTA: Questo potrebbe dover essere adattato se si aggiungono provider con API diverse
    const modelsUrl = `${baseURL}/models`;

    let headers: Record<string, string> = {};
    if (lowerName === 'anthropic' || lowerName === 'claude') {
      headers = {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      };
    } else {
      headers = {
        'Authorization': `Bearer ${apiKey}`,
      };
    }

    const apiResponse = await fetch(modelsUrl, { headers });

    if (!apiResponse.ok) {
      const body = await apiResponse.text();
      console.error(`Errore API da ${name}:`, body);
      return NextResponse.json({ error: `Errore nella comunicazione con l'API di ${name}`, details: body }, { status: 502 });
    }

    const jsonResponse = await apiResponse.json();
    let modelsFromApi: ApiModel[] = [];

    if (lowerName === 'anthropic' || lowerName === 'claude') {
        // Anthropic: risposta recente ha la forma { data: [...] }
        if (Array.isArray(jsonResponse?.data)) {
          modelsFromApi = jsonResponse.data as ApiModel[];
        } else if (Array.isArray(jsonResponse)) {
          modelsFromApi = jsonResponse as ApiModel[];
        } else {
          modelsFromApi = [];
        }
    } else {
        // La maggior parte delle API OpenAI-compatibili usa il campo 'data'
        modelsFromApi = jsonResponse.data || [];
    }

    if (!Array.isArray(modelsFromApi)) {
        console.error(`Risposta API non valida da ${name}:`, jsonResponse);
        return NextResponse.json({ error: `Formato risposta API non valido da ${name}` }, { status: 500 });
    }

    const enrichedModels = modelsFromApi
      .map(model => {
        const cost = getModelCost(model.id);
        return {
          id: model.id,
          ...cost, // Se non noto, input/output = 0
        };
      })
      .sort((a, b) => a.input - b.input); // Ordina per costo di input crescente

    return NextResponse.json(enrichedModels);

  } catch (error) {
    console.error('[LLM_MODELS_API]', error);
    return NextResponse.json({ error: 'Errore Interno del Server' }, { status: 500 });
  }
}
