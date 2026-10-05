/**
 * LunaLearn — Gemini Vector Embedding Service
 * Generates vector representations using Google's currently recommended embedding model.
 * 
 * Model Lifecycle & Recommendation:
 * - Following Google's deprecation and shutdown of legacy text-embedding-004 in early 2026,
 *   Google recommends 'gemini-embedding-001' (or 'gemini-embedding-2-preview' for cross-modal tasks).
 * - Target output dimension: 1536 (matching PostgreSQL document_chunks.embedding vector(1536)).
 */

import { env } from '../config/env.js';
import { retryWithBackoff } from '../lib/circuit-breaker.js';
import { AppError } from '../types/errors.js';

interface GeminiEmbedResponse {
  embedding?: {
    values: number[];
  };
}

interface GeminiBatchEmbedResponse {
  embeddings?: {
    values: number[];
  }[];
}

export class EmbeddingService {
  public static readonly DEFAULT_MODEL = 'gemini-embedding-001';
  public static readonly DEFAULT_DIMENSION = 1536;

  /**
   * Retrieves the sanitized Gemini API key from environment variables.
   */
  public static getApiKey(): string | null {
    const raw = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!raw) return null;
    // Strip possible quotes wrapping the key in .env
    const cleaned = raw.replace(/^['"]|['"]$/g, '').trim();
    return cleaned && cleaned.length > 5 ? cleaned : null;
  }

  /**
   * Retrieves the configured or currently recommended Gemini embedding model.
   */
  public static getModelName(): string {
    return env.GEMINI_EMBEDDING_MODEL || process.env.GEMINI_EMBEDDING_MODEL?.trim() || this.DEFAULT_MODEL;
  }

  /**
   * Generates a 1536-dimensional vector embedding for a single text block.
   */
  public static async embedText(text: string): Promise<number[]> {
    const cleanText = text.trim();
    if (!cleanText) {
      return new Array(this.DEFAULT_DIMENSION).fill(0);
    }

    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw AppError.aiError('Gemini API key is not configured.', false);
    }

    const model = this.getModelName();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`;

    try {
      const data = await retryWithBackoff(async () => {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: { parts: [{ text: cleanText }] },
            outputDimensionality: this.DEFAULT_DIMENSION
          }),
          signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
          const error = new Error(`Gemini embedContent API returned HTTP ${response.status}: ${await response.text()}`) as Error & { status: number };
          error.status = response.status;
          throw error;
        }

        return await response.json() as GeminiEmbedResponse;
      }, { operationName: 'Gemini embedContent' });

      const values = data.embedding?.values;
      if (!values || !Array.isArray(values) || values.length === 0) {
        throw AppError.aiError('Gemini embedContent API returned no embedding values.');
      }

      return values;
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 429) {
        throw AppError.rateLimited('Gemini embedding API rate limit exceeded.');
      }
      if (err instanceof AppError) throw err;
      const message = err instanceof Error ? err.message : String(err);
      throw AppError.aiError(`Gemini embedContent request failed: ${message}`);
    }
  }

  /**
   * Generates vector embeddings for a batch of text chunks.
   * Splits into batches of 20 to respect API request constraints.
   */
  public static async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw AppError.aiError('Gemini API key is not configured.', false);
    }

    const model = this.getModelName();
    const batchUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents?key=${apiKey}`;

    const results: number[][] = [];
    const BATCH_SIZE = 20;

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const textBatch = texts.slice(i, i + BATCH_SIZE);

      const requests = textBatch.map(text => ({
        model: `models/${model}`,
        content: { parts: [{ text: text.trim() || 'empty chunk' }] },
        outputDimensionality: this.DEFAULT_DIMENSION
      }));

      try {
        const data = await retryWithBackoff(async () => {
          const response = await fetch(batchUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requests }),
            signal: AbortSignal.timeout(15000)
          });

          if (!response.ok) {
            const error = new Error(`Gemini batchEmbedContents API returned HTTP ${response.status}: ${await response.text()}`) as Error & { status: number };
            error.status = response.status;
            throw error;
          }

          return await response.json() as GeminiBatchEmbedResponse;
        }, { operationName: 'Gemini batchEmbedContents' });

        if (!data.embeddings || !Array.isArray(data.embeddings) || data.embeddings.length !== textBatch.length ||
          data.embeddings.some(item => !Array.isArray(item.values) || item.values.length === 0)) {
          throw AppError.aiError('Gemini batchEmbedContents API returned incomplete embedding values.');
        }

        results.push(...data.embeddings.map(item => item.values));
      } catch (err: unknown) {
        const status = (err as { status?: number })?.status;
        if (status === 429) {
          throw AppError.rateLimited('Gemini embedding API rate limit exceeded.');
        }
        if (err instanceof AppError) throw err;
        const message = err instanceof Error ? err.message : String(err);
        throw AppError.aiError(`Gemini batchEmbedContents request failed: ${message}`);
      }
    }

    return results;
  }


  /**
   * Calculates cosine similarity between two vector embeddings.
   * Range: -1.0 to 1.0 (1.0 = identical semantic meaning).
   */
  public static cosineSimilarity(a: number[], b: number[]): number {
    if (!a || !b || a.length === 0 || b.length === 0) return 0;
    const len = Math.min(a.length, b.length);

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < len; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Deterministic pseudo-embedding generator used for local fallback / unit tests.
   * Produces reproducible vectors based on text character hashes.
   */
  public static generateDeterministicVector(text: string, dimension = 1536): number[] {
    const vector = new Array(dimension).fill(0);
    const clean = text.toLowerCase();

    for (let i = 0; i < clean.length; i++) {
      const charCode = clean.charCodeAt(i);
      const idx = (i * 31 + charCode) % dimension;
      vector[idx] += Math.sin(charCode * (i + 1));
    }

    // Normalize to unit vector
    let sumSq = 0;
    for (let i = 0; i < dimension; i++) {
      sumSq += vector[i] * vector[i];
    }

    if (sumSq === 0) {
      vector[0] = 1.0;
      return vector;
    }

    const norm = Math.sqrt(sumSq);
    for (let i = 0; i < dimension; i++) {
      vector[i] = Number((vector[i] / norm).toFixed(6));
    }

    return vector;
  }
}
