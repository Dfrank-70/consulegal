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
    return new NextResponse('Provider ID mancante', { status: 400 });
  }

  try {
    const provider = await prisma.lLMProvider.findUnique({
      where: { id: providerId },
    });

    if (!provider) {
      return new NextResponse('Provider non trovato', { status: 404 });
    }

    const { name, config } = provider;
    const providerConfig = config as Record<string, any>;
    const apiKey = providerConfig.apiKey;
    const baseURL = providerConfig.baseURL;

    if (!apiKey || !baseURL) {
      return new NextResponse('Configurazione del provider incompleta (apiKey o baseURL mancanti)', { status: 400 });
    }

    // Endpoint per ottenere i modelli, specifico per provider
    // NOTA: Questo potrebbe dover essere adattato se si aggiungono provider con API diverse
    const modelsUrl = `${baseURL}/models`;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${apiKey}`,
    };

    // Header specifico per Anthropic
    if (name.toLowerCase() === 'anthropic') {
        headers['anthropic-version'] = '2023-06-01';
    }

    const apiResponse = await fetch(modelsUrl, { headers });

    if (!apiResponse.ok) {
      console.error(`Errore API da ${name}:`, await apiResponse.text());
      return new NextResponse(`Errore nella comunicazione con l'API di ${name}`, { status: 502 });
    }

    const jsonResponse = await apiResponse.json();
    let modelsFromApi: ApiModel[] = [];

    if (name.toLowerCase() === 'anthropic') {
        // La risposta di Anthropic non è standard, potrebbe non avere un campo 'data'
        // e potrebbe essere direttamente l'array di modelli.
        modelsFromApi = Array.isArray(jsonResponse) ? jsonResponse : [];
    } else {
        // La maggior parte delle API OpenAI-compatibili usa il campo 'data'
        modelsFromApi = jsonResponse.data || [];
    }

    if (!Array.isArray(modelsFromApi)) {
        console.error(`Risposta API non valida da ${name}:`, jsonResponse);
        return new NextResponse(`Formato risposta API non valido da ${name}`, { status: 500 });
    }

    const enrichedModels = modelsFromApi
      .map(model => {
        const cost = getModelCost(model.id);
        return {
          id: model.id,
          ...cost,
        };
      })
      .filter(model => model.input > 0 || model.output > 0) // Mostra solo modelli di cui conosciamo il costo
      .sort((a, b) => a.input - b.input); // Ordina per costo di input crescente

    return NextResponse.json(enrichedModels);

  } catch (error) {
    console.error('[LLM_MODELS_API]', error);
    return new NextResponse('Errore Interno del Server', { status: 500 });
  }
}
