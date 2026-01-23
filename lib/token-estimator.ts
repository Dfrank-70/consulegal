/**
 * Token Estimation - Conservative Character-Based Approximation
 * 
 * Since we don't have tiktoken in this MVP, we use a conservative
 * character-based estimation. This tends to overestimate slightly,
 * which is safer for preventing API overages.
 * 
 * Note: For production, consider using tiktoken library for accurate counts.
 */

export interface TokenEstimate {
  estimatedTokens: number;
  characterCount: number;
  method: 'conservative_chars';
}

/**
 * Estimate token count from text using conservative character-based approximation.
 * 
 * Rule of thumb:
 * - English: ~4 characters per token
 * - Code/technical: ~3 characters per token (more dense)
 * - We use 3.5 as conservative middle ground
 * 
 * @param text - Input text to estimate
 * @returns TokenEstimate with count and metadata
 */
export function estimateTokens(text: string): TokenEstimate {
  if (!text || text.length === 0) {
    return {
      estimatedTokens: 0,
      characterCount: 0,
      method: 'conservative_chars'
    };
  }

  const characterCount = text.length;
  
  // Conservative estimation: 3.5 chars/token (tends to overestimate)
  const estimatedTokens = Math.ceil(characterCount / 3.5);

  return {
    estimatedTokens,
    characterCount,
    method: 'conservative_chars'
  };
}

/**
 * Estimate tokens for chat input (message + system prompt + file content).
 * 
 * @param message - User message text
 * @param systemPrompt - Optional system prompt
 * @param fileContent - Optional extracted file content
 * @returns Total estimated tokens
 */
export function estimateChatInputTokens(
  message: string,
  systemPrompt?: string,
  fileContent?: string
): number {
  let totalTokens = 0;

  // User message
  if (message) {
    totalTokens += estimateTokens(message).estimatedTokens;
  }

  // System prompt (if any)
  if (systemPrompt) {
    totalTokens += estimateTokens(systemPrompt).estimatedTokens;
  }

  // File content (if any)
  if (fileContent) {
    totalTokens += estimateTokens(fileContent).estimatedTokens;
  }

  // Add small buffer for message formatting overhead (~50 tokens)
  totalTokens += 50;

  return totalTokens;
}

/**
 * Check if input exceeds token limit.
 * 
 * @param estimatedTokens - Estimated token count
 * @param maxTokens - Max allowed input tokens (from env MAX_INPUT_TOKENS or default 2000)
 * @returns { withinLimit: boolean, estimatedTokens, maxTokens }
 */
export function checkTokenLimit(
  estimatedTokens: number,
  maxTokens: number = parseInt(process.env.MAX_INPUT_TOKENS || '8000')
): { withinLimit: boolean; estimatedTokens: number; maxTokens: number } {
  return {
    withinLimit: estimatedTokens <= maxTokens,
    estimatedTokens,
    maxTokens
  };
}
