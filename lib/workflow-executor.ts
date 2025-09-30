import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import prisma from '@/lib/prisma';

// Tipi per i nodi del workflow
export interface WorkflowNode {
  id: string;
  nodeId: string;
  type: string;
  position: { x: number; y: number };
  data: {
    provider?: string;
    prompt?: string;
    temperature?: number;
    maxTokens?: number;
    customInstruction?: string;
    [key: string]: any;
  };
}

export interface WorkflowEdge {
  id: string;
  edgeId: string;
  sourceId: string;
  targetId: string;
  data?: {
    condition?: string;
    instruction?: string;
    [key: string]: any;
  };
}

export interface WorkflowExecution {
  workflowId: string;
  steps: WorkflowStep[];
  totalTokensUsed: number;
  totalCost: number;
  success: boolean;
  error?: string;
}

export interface WorkflowStep {
  nodeId: string;
  type: string;
  provider?: string;
  input: string;
  output: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  executionTime: number;
  success: boolean;
  error?: string;
}

// Funzione per ottenere il client OpenAI
function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY non configurata");
  }
  return new OpenAI({ apiKey });
}

// Funzione per eseguire un singolo nodo LLM
async function executeNode(
  node: WorkflowNode,
  input: string,
  providers: any[]
): Promise<WorkflowStep> {
  const startTime = Date.now();
  
  const step: WorkflowStep = {
    nodeId: node.nodeId,
    type: node.type,
    input,
    output: '',
    tokensIn: 0,
    tokensOut: 0,
    cost: 0,
    executionTime: 0,
    success: false
  };

  try {
    if (node.type === 'input') {
      // Nodo di input - passa semplicemente il testo
      step.output = input;
      step.success = true;
      return step;
    }

    if (node.type === 'output') {
      // Nodo di output - passa semplicemente il testo
      step.output = input;
      step.success = true;
      return step;
    }

    if (node.type === 'llm') {
      const providerName = node.data.provider || 'OpenAI';
      const provider = providers.find(p => p.name === providerName);
      
      if (!provider || !provider.isActive) {
        throw new Error(`Provider ${providerName} non trovato o non attivo`);
      }

      // Per ora supportiamo solo OpenAI, ma la struttura è estensibile
      if (providerName === 'OpenAI') {
        const openai = getOpenAIClient();
        
        // Costruisci il prompt combinando custom instruction e prompt del nodo
        let systemPrompt = node.data.customInstruction || '';
        if (node.data.prompt) {
          systemPrompt += systemPrompt ? '\n\n' + node.data.prompt : node.data.prompt;
        }

        const messages = [
          ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
          { role: 'user' as const, content: input }
        ];


        const completion = await openai.chat.completions.create({
          model: node.data.model || 'gpt-3.5-turbo',
          messages,
          temperature: node.data.temperature || 0.7,
          max_tokens: node.data.maxTokens || 1000,
        });
        step.tokensIn = completion.usage?.prompt_tokens || 0;
        step.output = completion.choices[0].message.content || '';
        step.tokensOut = completion.usage?.completion_tokens || 0;
        step.cost = ((step.tokensIn / 1000) * 0.0015) + ((step.tokensOut / 1000) * 0.002);
        step.provider = providerName;
        step.success = true;
      } else if (providerName === 'Claude') {
        const anthropic = new Anthropic({ apiKey: provider.apiKey });
        const response = await anthropic.messages.create({
          model: node.data.model,
          max_tokens: node.data.maxTokens || 1024,
          temperature: node.data.temperature,
          system: node.data.customInstruction,
          messages: [{ role: 'user', content: input }],
        });

        const outputText = response.content
          .filter(block => block.type === 'text')
          .map(block => block.text)
          .join('');
        const tokensIn = response.usage.input_tokens;
        const tokensOut = response.usage.output_tokens;

        // Calcolo del costo (esempio per haiku)
        const costPerInputToken = 0.00000025; // $0.25 / 1M tokens
        const costPerOutputToken = 0.00000125; // $1.25 / 1M tokens
        const cost = (tokensIn * costPerInputToken) + (tokensOut * costPerOutputToken);

        step.output = outputText;
        step.tokensIn = tokensIn;
        step.tokensOut = tokensOut;
        step.cost = cost;
        step.provider = providerName;
        step.success = true;
      } else {
        throw new Error(`Provider ${providerName} non ancora supportato`);
      }
    }

    step.executionTime = Date.now() - startTime;
    return step;

  } catch (error: any) {
    step.error = error.message;
    step.executionTime = Date.now() - startTime;
    return step;
  }
}

// Funzione principale per eseguire un workflow
export async function executeWorkflow(
  workflowId: string,
  userId: string,
  initialInput: string
): Promise<WorkflowExecution> {
  const execution: WorkflowExecution = {
    workflowId,
    steps: [],
    totalTokensUsed: 0,
    totalCost: 0,
    success: false
  };

  try {
    // Carica il workflow dal database
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: {
        nodes: true,
        edges: true
      }
    });

    if (!workflow) {
      throw new Error(`Workflow ${workflowId} non trovato`);
    }

    // Carica i provider LLM attivi
    const providers = await prisma.lLMProvider.findMany({
      where: { isActive: true }
    });

    // Converti i nodi e edge dal database al formato interno
    const nodes: WorkflowNode[] = workflow.nodes.map(node => ({
      id: node.id,
      nodeId: node.nodeId,
      type: node.type,
      position: node.position as { x: number; y: number },
      data: node.data as any
    }));

    const edges: WorkflowEdge[] = workflow.edges.map(edge => ({
      id: edge.id,
      edgeId: edge.edgeId,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      data: edge.data as any
    }));

    // Trova il nodo di input
    const inputNode = nodes.find(node => node.type === 'input');
    if (!inputNode) {
      throw new Error('Nodo di input non trovato nel workflow');
    }

    // Esegui il workflow seguendo le connessioni in modo sequenziale
    let currentNode = nodes.find(node => node.type === 'input');
    if (!currentNode) {
      throw new Error('Nodo di input non trovato nel workflow');
    }

    let currentInput = initialInput;
    const maxSteps = nodes.length + 1; // Prevenzione loop infiniti
    let stepCount = 0;

    while (currentNode && stepCount < maxSteps) {
      stepCount++;

      // Esegui il nodo corrente
      const step = await executeNode(currentNode, currentInput, providers);
      execution.steps.push(step);

      if (!step.success) {
        throw new Error(`Errore nell'esecuzione del nodo ${currentNode.nodeId}: ${step.error}`);
      }

      // Aggiorna l'input per il prossimo nodo
      currentInput = step.output;
      execution.totalTokensUsed += step.tokensIn + step.tokensOut;
      execution.totalCost += step.cost;

      // Trova il prossimo nodo da eseguire
      const nextEdge = edges.find(edge => edge.sourceId === currentNode!.nodeId);
      if (nextEdge) {
        currentNode = nodes.find(node => node.nodeId === nextEdge.targetId);
      } else {
        currentNode = undefined; // Fine del percorso
      }
    }

    // Se il loop è terminato senza errori, l'esecuzione è un successo.
    execution.success = true;

  } catch (error: any) {
    execution.error = error.message;
  }

  // Salva il log dell'esecuzione nel database
  try {
    await prisma.workflowExecutionLog.create({
      data: {
        workflowId: execution.workflowId,
        userId: userId,
        success: execution.success,
        input: initialInput,
        output: getWorkflowFinalOutput(execution),
        error: execution.error,
        steps: execution.steps as any, // Prisma accetta Json
        totalCost: execution.totalCost,
        totalTokens: execution.totalTokensUsed,
      },
    });
  } catch (logError) {
    console.error('❌ Errore durante il salvataggio del log di esecuzione:', logError);
  }

  return execution;
}

// Funzione per ottenere l'output finale di un workflow
export function getWorkflowFinalOutput(execution: WorkflowExecution): string {
  if (!execution.success || execution.steps.length === 0) {
    return execution.error || 'Errore nell\'esecuzione del workflow';
  }

  // Trova il nodo di output o usa l'ultimo step
  const outputStep = execution.steps.find(step => step.type === 'output') || 
                    execution.steps[execution.steps.length - 1];
  
  return outputStep.output;
}
