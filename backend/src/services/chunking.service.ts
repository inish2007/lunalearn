import { ExtractedPdf, ChunkingOptions, DocumentChunkDraft } from '../types/rag.js';

export class ChunkingService {
  public static readonly DEFAULT_CHUNK_SIZE = 800;
  public static readonly DEFAULT_CHUNK_OVERLAP = 160;
  public static readonly DEFAULT_MIN_CHUNK_SIZE = 80;

  /**
   * Splits extracted PDF pages into overlapping chunks sized for semantic vector embedding.
   * 
   * Strategy:
   * 1. Preserves page attribution so learners can reference exact PDF page numbers.
   * 2. Uses paragraph and sentence boundaries (\n\n, \n, sentence terminators) to avoid cutting words.
   * 3. Maintains an overlap window between adjacent chunks to preserve semantic context.
   * 4. Prepares metadata tagging each chunk with subject_id, unit_id, char_count, and word_count.
   */
  public static chunkPdf(
    extracted: ExtractedPdf,
    subjectId: string,
    unitId: string | null = null,
    options?: ChunkingOptions
  ): DocumentChunkDraft[] {
    const targetSize = options?.chunkSize ?? this.DEFAULT_CHUNK_SIZE;
    const overlap = options?.chunkOverlap ?? this.DEFAULT_CHUNK_OVERLAP;
    const minSize = options?.minChunkSize ?? this.DEFAULT_MIN_CHUNK_SIZE;

    const drafts: DocumentChunkDraft[] = [];
    let globalChunkIndex = 0;

    for (const page of extracted.pages) {
      const pageText = page.text.trim();
      if (!pageText) continue;

      // If page text is within target size, emit as single chunk
      if (pageText.length <= targetSize) {
        drafts.push(
          this.buildDraft(
            pageText,
            globalChunkIndex++,
            page.pageNumber,
            subjectId,
            unitId
          )
        );
        continue;
      }

      // Split page text into overlapping windows adhering to paragraph/sentence boundaries
      const pageChunks = this.splitIntoOverlappingChunks(pageText, targetSize, overlap, minSize);

      for (const chunkContent of pageChunks) {
        drafts.push(
          this.buildDraft(
            chunkContent,
            globalChunkIndex++,
            page.pageNumber,
            subjectId,
            unitId
          )
        );
      }
    }

    // Safety fallback: if no drafts generated from pages, chunk the fullText directly
    if (drafts.length === 0 && extracted.fullText) {
      const fallbackChunks = this.splitIntoOverlappingChunks(
        extracted.fullText,
        targetSize,
        overlap,
        minSize
      );

      for (let i = 0; i < fallbackChunks.length; i++) {
        drafts.push(
          this.buildDraft(fallbackChunks[i], i, 1, subjectId, unitId)
        );
      }
    }

    return drafts;
  }

  /**
   * Splits a continuous text block into overlapping chunks respecting natural paragraph and sentence breaks.
   */
  public static splitIntoOverlappingChunks(
    text: string,
    targetSize: number,
    overlapSize: number,
    minSize: number
  ): string[] {
    const chunks: string[] = [];
    let startIndex = 0;
    const textLength = text.length;

    while (startIndex < textLength) {
      let endIndex = startIndex + targetSize;

      if (endIndex >= textLength) {
        const remaining = text.substring(startIndex).trim();
        if (remaining.length >= minSize || chunks.length === 0) {
          chunks.push(remaining);
        } else if (chunks.length > 0) {
          // Append small remainder to previous chunk if feasible
          chunks[chunks.length - 1] = `${chunks[chunks.length - 1]}\n\n${remaining}`.trim();
        }
        break;
      }

      // Look backward from endIndex for a clean paragraph or sentence break
      const breakPoint = this.findBestBreakPoint(text, startIndex, endIndex, targetSize * 0.3);
      const chunkText = text.substring(startIndex, breakPoint).trim();

      if (chunkText.length > 0) {
        chunks.push(chunkText);
      }

      // Advance startIndex by chunk length minus overlap window
      const step = Math.max(breakPoint - startIndex - overlapSize, Math.floor(targetSize / 2));
      startIndex += step;
    }

    return chunks;
  }

  /**
   * Finds the most natural semantic break point near the target boundary:
   * 1. Paragraph boundary (\n\n)
   * 2. Line boundary (\n)
   * 3. Sentence boundary (. , ? , ! )
   * 4. Word boundary (' ')
   */
  private static findBestBreakPoint(
    text: string,
    startIndex: number,
    endIndex: number,
    searchWindow: number
  ): number {
    const searchStart = Math.max(startIndex, Math.floor(endIndex - searchWindow));
    const segment = text.substring(searchStart, endIndex);

    // 1. Paragraph break
    const doubleNewlineIdx = segment.lastIndexOf('\n\n');
    if (doubleNewlineIdx !== -1) {
      return searchStart + doubleNewlineIdx + 2;
    }

    // 2. Sentence end followed by space or newline
    const sentenceMatch = segment.search(/(\.|\?|!)\s+[A-Z0-9"']/);
    if (sentenceMatch !== -1) {
      return searchStart + sentenceMatch + 2;
    }

    // 3. Single newline
    const newlineIdx = segment.lastIndexOf('\n');
    if (newlineIdx !== -1) {
      return searchStart + newlineIdx + 1;
    }

    // 4. Space / word break
    const spaceIdx = segment.lastIndexOf(' ');
    if (spaceIdx !== -1) {
      return searchStart + spaceIdx + 1;
    }

    // Fallback: hard cut
    return endIndex;
  }

  private static buildDraft(
    content: string,
    chunkIndex: number,
    pageNumber: number,
    subjectId: string,
    unitId: string | null
  ): DocumentChunkDraft {
    const trimmed = content.trim();
    const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;

    return {
      chunk_index: chunkIndex,
      page_number: pageNumber,
      content: trimmed,
      metadata: {
        subject_id: subjectId,
        unit_id: unitId,
        char_count: trimmed.length,
        word_count: wordCount,
        chunk_index: chunkIndex,
        page_number: pageNumber
      }
    };
  }
}
