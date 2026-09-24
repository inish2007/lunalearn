import http from 'http';
import busboy from 'busboy';
import { requireAuth } from '../middleware/auth.middleware.js';
import { sendSuccess, sendError } from '../routes/domain.routes.js';
import { RagMaterialService } from '../services/rag-material.service.js';
import { UploadPdfJsonSchema } from '../types/rag.js';

/**
 * Parses multipart/form-data requests using busboy.
 */
function parseMultipartForm(req: http.IncomingMessage): Promise<{
  fields: Record<string, string>;
  fileBuffer: Buffer | null;
  fileName: string;
  mimeType: string;
}> {
  return new Promise((resolve, reject) => {
    try {
      const bb = busboy({
        headers: req.headers,
        limits: {
          fileSize: 50 * 1024 * 1024 // 50MB
        }
      });

      const fields: Record<string, string> = {};
      let fileBuffer: Buffer | null = null;
      let fileName = '';
      let mimeType = '';

      bb.on('file', (_name, file, info) => {
        fileName = info.filename || 'document.pdf';
        mimeType = info.mimeType || 'application/pdf';
        const chunks: Buffer[] = [];

        file.on('data', data => chunks.push(data));
        file.on('end', () => {
          fileBuffer = Buffer.concat(chunks);
        });
      });

      bb.on('field', (name, val) => {
        fields[name] = val;
      });

      bb.on('close', () => {
        resolve({ fields, fileBuffer, fileName, mimeType });
      });

      bb.on('error', err => {
        reject(err);
      });

      req.pipe(bb);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Parses JSON request bodies with payload limits.
 */
function parseJson(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk.toString();
      if (raw.length > 50 * 1024 * 1024) {
        reject(new Error('Payload exceeds maximum allowed size of 50MB.'));
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('Malformed JSON payload.'));
      }
    });
    req.on('error', reject);
  });
}

// ==============================================================================
// AI/RAG Routes Dispatcher
// ==============================================================================

export async function handleRagRoutes(req: http.IncomingMessage, res: http.ServerResponse): Promise<boolean> {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const method = req.method?.toUpperCase();

  // Match:
  // POST /api/rag/upload
  // POST /api/rag/materials/upload
  // POST /api/materials/upload/pdf
  const isUploadRoute =
    pathname === '/api/rag/upload' ||
    pathname === '/api/rag/materials/upload' ||
    pathname === '/api/materials/upload/pdf';

  if (isUploadRoute) {
    if (method !== 'POST') {
      sendError(res, 'MethodNotAllowed', `Method ${method} not supported on ${pathname}. Use POST.`, 405);
      return true;
    }

    const handler = requireAuth(async (req, res, ctx) => {
      const contentType = req.headers['content-type'] || '';

      let subjectId = '';
      let unitId: string | null = null;
      let fileName = '';
      let customName: string | undefined = undefined;
      let fileBuffer: Buffer | null = null;

      try {
        if (contentType.includes('multipart/form-data')) {
          // A. Multipart Form-Data Upload
          const parsed = await parseMultipartForm(req);
          subjectId = parsed.fields.subject_id;
          unitId = parsed.fields.unit_id || null;
          customName = parsed.fields.name || parsed.fields.custom_name;
          fileName = parsed.fileName || 'uploaded_document.pdf';
          fileBuffer = parsed.fileBuffer;
        } else if (contentType.includes('application/json')) {
          // B. JSON Base64 Upload
          const body = await parseJson(req);
          const parsed = UploadPdfJsonSchema.safeParse(body);
          if (!parsed.success) {
            return sendError(
              res,
              'ValidationError',
              'Invalid JSON upload payload',
              400,
              parsed.error.issues.map(i => ({ field: i.path.join('.'), message: i.message }))
            );
          }

          subjectId = parsed.data.subject_id;
          unitId = parsed.data.unit_id || null;
          fileName = parsed.data.file_name;
          customName = parsed.data.custom_name;

          // Strip data URL header if included (e.g. data:application/pdf;base64,...)
          const base64Data = parsed.data.file_base64.replace(/^data:[^;]+;base64,/, '');
          fileBuffer = Buffer.from(base64Data, 'base64');
        } else {
          return sendError(
            res,
            'UnsupportedMediaType',
            'Please send either multipart/form-data with a "file" field or application/json with "file_base64".',
            415
          );
        }

        // Validate basic parameters
        if (!subjectId) {
          return sendError(res, 'ValidationError', 'Missing required parameter: subject_id');
        }

        if (!fileBuffer || fileBuffer.length === 0) {
          return sendError(res, 'ValidationError', 'No PDF file data provided for processing.');
        }

        // Process PDF Pipeline: Storage -> Text Extraction -> Overlapping Chunking -> Database Insertion
        const result = await RagMaterialService.processAndIndexPdf({
          db: ctx.db,
          profileId: ctx.user.id,
          subjectId,
          unitId,
          fileName,
          fileBuffer,
          customName
        });

        return sendSuccess(res, result, 201, 'PDF uploaded, processed, and chunked successfully');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error processing PDF document';
        const isClientError =
          message.includes('Invalid file format') ||
          message.includes('not found') ||
          message.includes('No readable text') ||
          message.includes('UUID');

        return sendError(
          res,
          isClientError ? 'ProcessingError' : 'InternalServerError',
          message,
          isClientError ? 400 : 500
        );
      }
    });

    await handler(req, res);
    return true;
  }

  return false;
}
