import { PDFParse } from 'pdf-parse';
import { ExtractedPdf, ExtractedPage } from '../types/rag.js';
import { AppError } from '../types/errors.js';

export class PdfService {
  public static readonly MAX_PAGE_COUNT = 50;
  public static readonly MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

  /**
   * Validates whether a buffer starts with standard PDF magic bytes (%PDF-).
   * 0x25 0x50 0x44 0x46 0x2D in ASCII.
   */
  public static isPdf(buffer: Buffer): boolean {
    if (!buffer || buffer.length < 5) return false;
    return (
      buffer[0] === 0x25 && // %
      buffer[1] === 0x50 && // P
      buffer[2] === 0x44 && // D
      buffer[3] === 0x46 && // F
      buffer[4] === 0x2d    // -
    );
  }

  /**
   * Extracts text, page count, and per-page content from a PDF Buffer with strict security validation.
   */
  public static async extractText(buffer: Buffer): Promise<ExtractedPdf> {
    if (buffer.length > this.MAX_FILE_SIZE_BYTES) {
      throw AppError.payloadTooLarge(
        `PDF file size (${Math.round(buffer.length / (1024 * 1024))}MB) exceeds maximum limit of 10MB.`
      );
    }

    if (!this.isPdf(buffer)) {
      throw AppError.unsupportedMediaType(
        'Invalid file format. The provided file does not have a valid %PDF- magic header signature.'
      );
    }

    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      const totalPages = result.total || (result.pages ? result.pages.length : 1);

      if (totalPages > this.MAX_PAGE_COUNT) {
        throw AppError.validation(
          `PDF exceeds maximum allowed page count (${this.MAX_PAGE_COUNT} pages). Document has ${totalPages} pages.`
        );
      }

      const pages: ExtractedPage[] = (result.pages || []).map((p: any, idx: number) => ({
        pageNumber: p.num || idx + 1,
        text: this.cleanText(p.text || '')
      }));

      // If pages array is empty but full text exists, create single page
      if (pages.length === 0 && result.text) {
        pages.push({
          pageNumber: 1,
          text: this.cleanText(result.text)
        });
      }

      const fullCleanedText = pages.map(p => p.text).join('\n\n').trim();

      if (!fullCleanedText || fullCleanedText.length === 0) {
        throw AppError.validation(
          'No readable text could be extracted from this PDF. It may be a scanned image or contain non-extractable text.'
        );
      }

      return {
        fullText: fullCleanedText,
        totalPages,
        pages,
        characterCount: fullCleanedText.length
      };
    } finally {
      try {
        await parser.destroy();
      } catch {
        // Silently ignore cleanup error
      }
    }
  }

  /**
   * Cleans extracted raw PDF text:
   * - Normalizes Windows CRLF to LF
   * - Replaces control characters
   * - Collapses excessive whitespace and empty lines
   */
  public static cleanText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // remove ASCII control chars
      .replace(/[ \t]+/g, ' ')                          // collapse inline spaces
      .replace(/\n{3,}/g, '\n\n')                      // max 2 consecutive newlines
      .trim();
  }
}
