import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma"; // Utilizza istanza Prisma centralizzata
import { auth } from "../../../auth";
import { OpenAI } from "openai";

// La vecchia istanza locale 'const prisma = new PrismaClient();' è stata rimossa.

// Inizializziamo OpenAI solo quando serve, non durante la build
const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("CRITICAL: OPENAI_API_KEY non è configurata sul server.");
    throw new Error("Configurazione del server incompleta per la funzionalità AI.");
  }
  return new OpenAI({ apiKey });
};

// Helper function to count tokens (semplice approssimazione)
function countTokens(text: string): number {
  // Una stima semplificata: circa 4 caratteri = 1 token
  return Math.ceil(text.length / 4);
}

// Funzione per generare il messaggio di sistema per l'AI
async function constructSystemMessage(userId: string, conversationId: string): Promise<{ role: string, content: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { customInstructions: true },
  });
  
  return {
    role: "system", 
    content: `Sei un assistente legale AI specializzato per il mercato italiano. ${
      user?.customInstructions 
        ? `\n\nIstruzioni specifiche: ${user.customInstructions}` 
        : ""
    }`
  };
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session || !session.user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }
    
    const { message, conversationId } = await req.json();
    
    if (!message) {
      return NextResponse.json(
        { error: "Il messaggio è richiesto" },
        { status: 400 }
      );
    }
    
    const userId = session.user.id as string;

    // --- INIZIO CONTROLLO LIMITE TOKEN ---

    // 1. Recupera utente, abbonamento e verifica se è bloccato
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscription: true, // Carichiamo i dati dell'abbonamento per accedere al tokenLimit
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
    }

    if (user.isBlocked) {
      return NextResponse.json(
        { error: "Il tuo account è stato bloccato. Contatta l'amministratore." },
        { status: 403 }
      );
    }

    // 2. Controlla se l'utente ha un abbonamento attivo
    if (!user.subscription) {
      return NextResponse.json(
        { error: "Nessun abbonamento attivo trovato. Per favore, sottoscrivi un piano." },
        { status: 403 } // Forbidden
      );
    }

    // 3. Calcola il totale dei token usati dall'utente OGGI
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const usageAggregation = await prisma.tokenUsage.aggregate({
      _sum: {
        tokensUsed: true,
      },
      where: {
        userId: userId,
        date: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
    });
    const totalTokensUsedToday = usageAggregation._sum.tokensUsed || 0;

    const dailyTokenLimit = user.subscription.tokenLimit;

    // 4. Controlla se l'utente ha superato il limite giornaliero
    if (totalTokensUsedToday >= dailyTokenLimit) {
      return NextResponse.json(
        { error: `Hai raggiunto il limite giornaliero di ${dailyTokenLimit.toLocaleString('it-IT')} token. Potrai utilizzare nuovamente il servizio domani o contattare l'assistenza per un upgrade.` },
        { status: 429 } // 429 Too Many Requests è appropriato per i limiti di utilizzo
      );
    }

    // --- FINE CONTROLLO LIMITE TOKEN ---
    
    // Create or get conversation
    let conversation;
    if (conversationId) {
      conversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          userId,
        },
      });
      
      if (!conversation) {
        return NextResponse.json(
          { error: "Conversazione non trovata" },
          { status: 404 }
        );
      }
    } else {
      // Create new conversation
      conversation = await prisma.conversation.create({
        data: {
          userId,
          title: `Consulenza ${new Date().toLocaleDateString("it-IT")}`,
        },
      });
    }
    
    // Count tokens for user message
    const tokensIn = countTokens(message);
    
    // Save user message to database
    const userMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "USER",
        content: message,
        tokensIn,
      },
    });
    
    // Prepare conversation history for context
    const messageHistory = await prisma.message.findMany({
      where: {
        conversationId: conversation.id,
      },
      orderBy: {
        createdAt: "asc",
      },
      take: 10, // Limit recent messages to avoid token limit
    });

    // Format messages for OpenAI API
    const messages = messageHistory.map((msg: any) => ({
      role: msg.role === "USER" ? "user" : "assistant",
      content: msg.content,
    }));

    const systemMessage = await constructSystemMessage(userId, conversationId);

    const openaiClient = getOpenAIClient();
    const completion = await openaiClient.chat.completions.create({
      model: "gpt-3.5-turbo", // Usa il modello specificato
      messages: [
        systemMessage as any,
        ...messages as any,
      ],
      temperature: 0.7,
      max_tokens: 1000, // Limita il numero di token nell'output
    });

    const content = completion.choices[0].message.content || "Mi dispiace, non sono stato in grado di generare una risposta.";

    // Count tokens for assistant message
    const tokensOut = completion.usage?.completion_tokens || countTokens(content);

    const totalTokens = messages.reduce((acc: number, msg: any) => acc + countTokens(msg.content || ""), 0);

    // Save assistant message to database
    const assistantMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "ASSISTANT",
        content,
        tokensOut,
        tokensIn: totalTokens,
        llmProvider: "OpenAI",
      },
    });

    // Track token usage
    await prisma.tokenUsage.create({
      data: {
        userId,
        tokensUsed: tokensIn + tokensOut,
        cost: ((tokensIn / 1000) * 0.0015) + ((tokensOut / 1000) * 0.002), // Stima dei costi
      },
    });
    
    return NextResponse.json({
      content,
      messageId: assistantMessage.id,
      userMessageId: userMessage.id,
      conversationId: conversation.id,
      title: conversation.title,
      tokensIn: tokensIn,
      tokensOut: tokensOut,
      llmProvider: "OpenAI",
    });
    
  } catch (error: any) {
    // Log a more detailed error message
    console.error("--- ERRORE DETTAGLIATO NELL'API CHAT ---");
    console.error("Timestamp:", new Date().toISOString());
    if (error instanceof OpenAI.APIError) {
      console.error("Errore OpenAI:", error.message);
      console.error("Status Code:", error.status);
      console.error("Tipo Errore:", error.type);
    } else {
      console.error("Errore Generico:", error.message);
    }
    console.error("Stack Trace:", error.stack);
    console.error("--- FINE ERRORE DETTAGLIATO ---");
    
    // Return a more informative error in the response (for development)
    return NextResponse.json(
      { 
        error: "Si è verificato un errore durante l'elaborazione della richiesta.",
        details: error.message || "Nessun dettaglio aggiuntivo disponibile."
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }
    const userId = session.user.id as string;

    const conversationId = req.nextUrl.searchParams.get("conversationId");

    if (!conversationId) {
      return NextResponse.json(
        { error: "Il parametro conversationId è richiesto" },
        { status: 400 }
      );
    }

    // Verify the conversation exists and belongs to the user
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId: userId,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversazione non trovata o non autorizzata" },
        { status: 404 }
      );
    }

    // Fetch messages for the validated conversation
    const messages = await prisma.message.findMany({
      where: {
        conversationId: conversationId,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return NextResponse.json(messages);

  } catch (error: any) {
    console.error("--- ERRORE DETTAGLIATO NEL GET /api/chat ---");
    console.error("Timestamp:", new Date().toISOString());
    console.error("Errore:", error.message);
    console.error("Stack Trace:", error.stack);
    console.error("--- FINE ERRORE DETTAGLIATO ---");
    
    return NextResponse.json(
      { 
        error: "Si è verificato un errore durante il recupero dei messaggi.",
        details: error.message || "Nessun dettaglio aggiuntivo disponibile."
      },
      { status: 500 }
    );
  }
}
