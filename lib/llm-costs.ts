// lib/llm-costs.ts

/**
 * Costi per milione di token per vari modelli LLM.
 * Input: costo per 1 milione di token in input.
 * Output: costo per 1 milione di token in output.
 * 
 * NOTA: Questi valori sono stime e devono essere aggiornati periodicamente
 * consultando i listini prezzi ufficiali dei provider (OpenAI, Anthropic, etc.).
 */

interface ModelCost {
  input: number;  // Costo per 1M token in USD
  output: number; // Costo per 1M token in USD
}

export const modelCosts: Record<string, ModelCost> = {
  // === OpenAI ===
  'gpt-4-turbo': { input: 10.00, output: 30.00 },
  'gpt-4-turbo-2024-04-09': { input: 10.00, output: 30.00 },
  'gpt-4-vision-preview': { input: 10.00, output: 30.00 },
  'gpt-4': { input: 30.00, output: 60.00 },
  'gpt-4-32k': { input: 60.00, output: 120.00 },
  'gpt-3.5-turbo-0125': { input: 0.50, output: 1.50 },
  'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
  'gpt-3.5-turbo-instruct': { input: 1.50, output: 2.00 },

  // === Anthropic ===
  'claude-3-opus-20240229': { input: 15.00, output: 75.00 },
  'claude-3-sonnet-20240229': { input: 3.00, output: 15.00 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  'claude-2.1': { input: 8.00, output: 24.00 },
  'claude-2.0': { input: 8.00, output: 24.00 },
  'claude-instant-1.2': { input: 0.80, output: 2.40 },

  // Aggiungere qui altri modelli se necessario
};

// Funzione di utilità per ottenere il costo di un modello specifico
export const getModelCost = (modelName: string): ModelCost => {
  return modelCosts[modelName] || { input: 0, output: 0 };
};
