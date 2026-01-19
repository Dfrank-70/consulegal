import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "../../../auth";
import { OpenAI } from "openai";
// Rimosso formidable - usiamo le API native di Next.js
// pdf-parse viene importato dinamicamente solo quando necessario
import mammoth from "mammoth";
import { executeWorkflow, getWorkflowFinalOutput } from "@/lib/workflow-executor";
import { stripe } from "@/lib/stripe";
import { checkSubscriptionEntitlement } from "@/lib/entitlement";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import { estimateChatInputTokens, checkTokenLimit } from "@/lib/token-estimator";

// Configurazione rimossa - usiamo le API native di Next.js

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

// Funzione per generare il messaggio di sistema per l'AI (rimossa - usa system semplice)

function cleanExtractedText(text: string): string {
  return text
    .split('\n')
    .filter(line => line.trim() !== '') // Rimuove righe vuote
    .join('\n')
    .trim();
}

async function extractTextFromFile(file: File): Promise<string> {
  const fileName = file.name || 'file sconosciuto';
  const fileType = file.type;

  console.log(`Elaborazione file: ${fileName}, tipo MIME: ${fileType}`);

  try {
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    let extractedText = "";

    if (fileType === "application/pdf") {
      console.log("Elaborazione PDF in corso con pdf2json...");
      try {
        const PDFParser = await import("pdf2json");
        
        extractedText = await new Promise<string>((resolve, reject) => {
          const pdfParser = new PDFParser.default();
          
          pdfParser.on("pdfParser_dataError", (errData: any) => {
            console.error("Errore PDF2JSON:", errData);
            resolve(`[ERRORE: Impossibile elaborare il PDF "${fileName}". Il file potrebbe essere corrotto o protetto.]`);
          });
          
          pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
            try {
              let fullText = "";
              
              if (pdfData.Pages && pdfData.Pages.length > 0) {
                pdfData.Pages.forEach((page: any, pageIndex: number) => {
                  if (page.Texts && page.Texts.length > 0) {
                    page.Texts.forEach((textItem: any) => {
                      if (textItem.R && textItem.R.length > 0) {
                        textItem.R.forEach((run: any) => {
                          if (run.T) {
                            fullText += decodeURIComponent(run.T) + " ";
                          }
                        });
                      }
                    });
                    fullText += "\n";
                  }
                });
              }
              
              if (fullText.trim()) {
                resolve(fullText.trim());
              } else {
                resolve(`[PDF "${fileName}" elaborato ma non contiene testo estraibile. Potrebbe essere un'immagine scansionata.]`);
              }
            } catch (parseError) {
              console.error("Errore parsing PDF:", parseError);
              resolve(`[ERRORE: Impossibile estrarre il testo dal PDF "${fileName}".]`);
            }
          });
          
          // Avvia il parsing
          pdfParser.parseBuffer(fileBuffer);
        });
      } catch (pdfError) {
        console.error("Errore caricamento pdf2json:", pdfError);
        extractedText = `[ERRORE: Impossibile caricare il parser PDF. Prova a convertire in DOCX.]`;
      }
      
    } else if (fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      console.log("Elaborazione DOCX in corso...");
      const { value } = await mammoth.extractRawText({ buffer: fileBuffer });
      extractedText = value;
      
    } else if (fileType === "application/msword") {
      console.log("Elaborazione DOC in corso...");
      try {
        const WordExtractor = await import("word-extractor");
        const extractor = new WordExtractor.default();
        
        // word-extractor richiede un file path, quindi salviamo temporaneamente il buffer
        const fs = await import("fs");
        const path = await import("path");
        const os = await import("os");
        
        const tempFilePath = path.join(os.tmpdir(), `temp_${Date.now()}.doc`);
        fs.writeFileSync(tempFilePath, fileBuffer);
        
        const extracted = await extractor.extract(tempFilePath);
        extractedText = extracted.getBody();
        
        // Pulisci il file temporaneo
        fs.unlinkSync(tempFilePath);
        
      } catch (docError) {
        console.error("Errore elaborazione DOC:", docError);
        return `[ERRORE DOC: Impossibile elaborare il file "${fileName}". Prova a salvarlo come DOCX.]`;
      }
      
    } else {
      console.log(`Tipo di file non supportato: ${fileType}`);
      return `\n[ERRORE: Tipo di file "${fileType}" non supportato. Sono accettati solo PDF, DOC e DOCX.]\n`;
    }

    // Pulisce il testo rimuovendo righe vuote
    const cleanedText = cleanExtractedText(extractedText);
    console.log(`File elaborato con successo. Testo pulito: ${cleanedText.length} caratteri (originale: ${extractedText.length})`);
    
    return cleanedText;
    
  } catch (error) {
    console.error(`Errore durante l'elaborazione del file ${fileName}:`, error);
    return `\n[ERRORE: Impossibile elaborare il file "${fileName}". Verifica che il file non sia corrotto.]\n`;
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const userId = session.user.id as string;

    // RATE LIMITING: Check requests per minute
    const rateLimitIdentifier = userId || getClientIP(req.headers);
    const rateLimit = checkRateLimit(rateLimitIdentifier);
    
    if (!rateLimit.allowed) {
      console.log(`🚫 Rate limit exceeded for ${userId || 'IP:' + rateLimitIdentifier}`);
      return NextResponse.json(
        { 
          error: 'rate_limited', 
          retry_after_seconds: rateLimit.retryAfterSeconds 
        },
        { 
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfterSeconds || 60)
          }
        }
      );
    }

    // --- FETCH USER + SUBSCRIPTION (before expensive operations) ---
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscription: true,
        workflow: {
          include: {
            nodes: true,
            edges: true,
          },
        },
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

    // ENTITLEMENT CHECK: Block if no active subscription
    const entitlement = checkSubscriptionEntitlement(user.subscription);
    
    if (!entitlement.entitled) {
      console.log(`🚫 Access denied for user ${userId}: ${entitlement.reason}`);
      return NextResponse.json(
        { 
          error: 'subscription_inactive', 
          reason: entitlement.reason,
          action: 'subscribe'
        },
        { status: 402 }
      );
    }

    // --- PARSE FORM DATA (after entitlement check) ---
    const formData = await req.formData();
    const message = formData.get("message") as string || "";
    let conversationId = formData.get("conversationId") as string || null;
    const file = formData.get("file") as File | null;

    if (!message && !file) {
      return NextResponse.json(
        { error: "È richiesto un messaggio o un file." },
        { status: 400 }
      );
    }

    // FILE SIZE CHECK: Limit upload size
    if (file) {
      const maxFileBytes = parseInt(process.env.MAX_FILE_BYTES || '10485760'); // 10MB default
      if (file.size > maxFileBytes) {
        console.log(`🚫 File too large for user ${userId}: ${file.size} bytes (max: ${maxFileBytes})`);
        return NextResponse.json(
          { 
            error: 'file_too_large', 
            max_file_bytes: maxFileBytes,
            file_bytes: file.size
          },
          { status: 413 }
        );
      }
    }
    
    // Extract file content for token estimation
    let fileContentPreview = "";
    if (file) {
      try {
        fileContentPreview = await extractTextFromFile(file);
      } catch (error) {
        console.warn(`File extraction failed for token estimate: ${error}`);
      }
    }

    // TOKEN LIMIT: Check input size before LLM call
    const estimatedInputTokens = estimateChatInputTokens(
      message,
      "You are a helpful legal assistant.",
      fileContentPreview
    );
    
    const tokenLimitCheck = checkTokenLimit(estimatedInputTokens);
    
    if (!tokenLimitCheck.withinLimit) {
      console.log(`🚫 Input too large for user ${userId}: ${estimatedInputTokens} tokens (max: ${tokenLimitCheck.maxTokens})`);
      return NextResponse.json(
        { 
          error: 'input_too_large', 
          max_input_tokens: tokenLimitCheck.maxTokens,
          estimated_tokens: estimatedInputTokens
        },
        { status: 413 }
      );
    }

    // Subscription attiva, procedi con validazione token limit
    let subscription = user.subscription;
    let isSubscribed = true; // Entitlement già verificato sopra

    // Fallback: Se subscription mancante ma user ha stripeCustomerId, sincronizza
    if (!subscription && user.stripeCustomerId) {
      console.log(`🔄 Utente ${user.email} non ha abbonamento attivo nel DB, controllo Stripe...`);
      try {
        const stripeSubscriptions = await stripe.subscriptions.list({
          customer: user.stripeCustomerId,
          status: 'active',
          limit: 1
        });

        if (stripeSubscriptions.data.length > 0) {
          const stripeSub = stripeSubscriptions.data[0];
          console.log(`✅ Trovata subscription attiva su Stripe: ${stripeSub.id}`);

          // Sincronizza nel DB
          subscription = await prisma.subscription.upsert({
            where: { userId: userId },
            create: {
              userId: userId,
              stripeSubscriptionId: stripeSub.id,
              stripePriceId: stripeSub.items.data[0].price.id,
              stripeProductId: stripeSub.items.data[0].price.product as string,
              status: stripeSub.status,
              currentPeriodStart: new Date((stripeSub as any).current_period_start * 1000),
              currentPeriodEnd: new Date((stripeSub as any).current_period_end * 1000),
              cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
              tokenLimit: 10000, // Default per piano intermedio
            },
            update: {
              stripeSubscriptionId: stripeSub.id,
              stripePriceId: stripeSub.items.data[0].price.id,
              stripeProductId: stripeSub.items.data[0].price.product as string,
              status: stripeSub.status,
              currentPeriodStart: new Date((stripeSub as any).current_period_start * 1000),
              currentPeriodEnd: new Date((stripeSub as any).current_period_end * 1000),
              cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
              tokenLimit: 10000,
            }
          });

          isSubscribed = 
            subscription &&
            subscription.currentPeriodEnd &&
            subscription.currentPeriodEnd.getTime() > Date.now();

          console.log(`✅ Abbonamento sincronizzato per ${user.email}, attivo: ${isSubscribed}`);
        }
      } catch (error) {
        console.error(`❌ Errore sincronizzazione Stripe per ${user.email}:`, error);
      }
    }

    if (isSubscribed) {
      const dailyTokenLimit = subscription!.tokenLimit;

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
          date: { gte: todayStart, lte: todayEnd },
        },
      });
      const totalTokensUsedToday = usageAggregation._sum.tokensUsed || 0;

      if (totalTokensUsedToday >= dailyTokenLimit) {
        return NextResponse.json(
          { error: `Hai raggiunto il limite giornaliero di ${dailyTokenLimit.toLocaleString('it-IT')} token. Potrai utilizzare nuovamente il servizio domani o contattare l'assistenza per un upgrade.` },
          { status: 429 } // Too Many Requests
        );
      }
    } else {
      // Se l'abbonamento non esiste o non è attivo, blocca la richiesta
      return NextResponse.json(
        { error: "Nessun abbonamento attivo trovato. Per favore, sottoscrivi un piano." },
        { status: 403 } // Forbidden
      );
    }

    // --- FINE BLOCCO DI VALIDAZIONE ---
    
    // Determina quale workflow utilizzare
    let workflowToUse = user.workflow;
    
    // Se l'utente non ha un workflow assegnato, usa quello di default
    if (!workflowToUse) {
      workflowToUse = await prisma.workflow.findFirst({
        where: { isDefault: true },
        include: {
          nodes: true,
          edges: true,
        },
      });
    }

    // Se non c'è nemmeno un workflow di default, usa la logica legacy
    const useWorkflow = workflowToUse && workflowToUse.nodes.length > 0;

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
          workflowId: workflowToUse?.id || null,
        },
      });
    }
    
    let fileContent = "";
    let fullMessage = message;
    
    if (file) {
      try {
        fileContent = await extractTextFromFile(file);
        
        // Costruisci un prompt strutturato che include il messaggio e il contenuto del file
        fullMessage = `${message} allego questi file

L'utente ha inviato 1 file allegato:
- Contenuto del file "${file.name}": ${fileContent}`;
        
      } catch (e) {
        console.error("Error extracting text from file:", e);
        return NextResponse.json({ error: "Impossibile leggere il file allegato." }, { status: 500 });
      }
    }

    // Count tokens for user message
    const tokensIn = countTokens(fullMessage);
    
    // Save user message to database
    const userMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "USER",
        content: fullMessage,
        tokensIn,
      },
    });
    
    let content: string;
    let tokensOut: number;
    let totalTokens: number;
    let executionDetails: any = null;

    if (useWorkflow && workflowToUse) {
      // Esegui il workflow
      console.log(`Eseguendo workflow: ${workflowToUse.name} (ID: ${workflowToUse.id})`);
      
      const workflowExecution = await executeWorkflow(workflowToUse.id, userId, fullMessage);
      
      if (workflowExecution.success) {
        content = getWorkflowFinalOutput(workflowExecution);
        tokensOut = workflowExecution.totalTokensUsed;
        totalTokens = workflowExecution.totalTokensUsed;
        executionDetails = {
          workflowId: workflowToUse.id,
          workflowName: workflowToUse.name,
          steps: workflowExecution.steps.length,
          totalCost: workflowExecution.totalCost,
        };
      } else {
        content = `Errore nell'esecuzione del workflow: ${workflowExecution.error}`;
        tokensOut = countTokens(content);
        totalTokens = tokensOut;
      }
    } else {
      // Fallback alla logica legacy se non c'è workflow
      console.log("Nessun workflow configurato, usando logica legacy");
      
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

      const systemMessage = { role: "system", content: "Sei Traspolegal, un assistente legale virtuale." };

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

      content = completion.choices[0].message.content || "Mi dispiace, non sono stato in grado di generare una risposta.";

      // Count tokens for assistant message
      tokensOut = completion.usage?.completion_tokens || countTokens(content);

      totalTokens = messages.reduce((acc: number, msg: any) => acc + countTokens(msg.content || ""), 0);
    }

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
      llmProvider: useWorkflow ? "Workflow" : "OpenAI",
      ...(executionDetails && { workflowExecution: executionDetails }),
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
