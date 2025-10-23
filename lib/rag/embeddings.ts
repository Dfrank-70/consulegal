// Embeddings Adapter for RAG - OpenAI text-embedding-3-large

import OpenAI from 'openai';
import { EmbeddingsAdapter } from './types';

export class OpenAIEmbeddingsAdapter implements EmbeddingsAdapter {
  private client: OpenAI;
  private model: string = 'text-embedding-3-large';
  private dimension: number = 3072;

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Generate embeddings for multiple texts
   */
  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    try {
      const response = await this.client.embeddings.create({
        model: this.model,
        input: texts,
        dimensions: this.dimension,
      });

      return response.data.map((item) => item.embedding);
    } catch (error) {
      console.error('Error generating embeddings:', error);
      throw new Error(`Failed to generate embeddings: ${error}`);
    }
  }

  /**
   * Generate embedding for a single text
   */
  async embedSingle(text: string): Promise<number[]> {
    const embeddings = await this.embed([text]);
    return embeddings[0];
  }

  getModel(): string {
    return this.model;
  }

  getDimension(): number {
    return this.dimension;
  }
}

// Singleton instance
let embeddingsInstance: OpenAIEmbeddingsAdapter | null = null;

export function getEmbeddingsAdapter(apiKey?: string): OpenAIEmbeddingsAdapter {
  if (!embeddingsInstance) {
    embeddingsInstance = new OpenAIEmbeddingsAdapter(apiKey);
  }
  return embeddingsInstance;
}
