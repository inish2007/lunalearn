import http from 'http';
import busboy from 'busboy';
import { requireAuth } from '../middleware/auth.middleware.js';
import { RagMaterialService } from '../services/rag-material.service.js';
import { SemanticSearchService } from '../services/semantic-search.service.js';
import { RagJobsService } from '../services/rag-jobs.service.js';
import { UploadPdfJsonSchema, SemanticSearchSchema } from '../types/rag.js';
import { AppError, ErrorCode } from '../types/errors.js';
import { sendStandardSuccess, sendStandardError, getOrCreateRequestId } from '../lib/response.js';

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
          fileSize: 10 * 1024 * 1024 // 10MB limit enforced
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
function parseJson<T = unknown>(req: http.IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk.toString();
      if (raw.length > 15 * 1024 * 1024) {
        reject(AppError.payloadTooLarge('Payload exceeds maximum allowed size of 15MB.'));
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? (JSON.parse(raw) as T) : ({} as T));
      } catch {
        reject(AppError.validation('Malformed JSON payload.'));
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
  const requestId = getOrCreateRequestId(req);

  // ----------------------------------------------------------------------------
  // 1. GET /api/rag/jobs/:jobId (Poll async processing state)
  // ----------------------------------------------------------------------------
  if (pathname.startsWith('/api/rag/jobs/')) {
    const jobId = pathname.replace('/api/rag/jobs/', '').trim();
    if (!jobId) {
      sendStandardError(res, AppError.validation('Missing jobId in path'), requestId, { req });
      return true;
    }

    const handler = requireAuth(async (_req, res, ctx) => {
      const job = RagJobsService.getJob(jobId);
      if (!job) {
        return sendStandardError(res, AppError.notFound(`Job with ID ${jobId} not found`), requestId, { req });
      }

      if (job.profileId !== ctx.user.id) {
        return sendStandardError(res, AppError.forbidden('Access denied to this processing job'), requestId, { req });
      }

      return sendStandardSuccess(res, job, 200, { requestId });
    });

    await handler(req, res);
    return true;
  }

  // ----------------------------------------------------------------------------
  // 2. POST /api/rag/upload (PDF Upload & Ingestion Pipeline)
  // ----------------------------------------------------------------------------
  const isUploadRoute =
    pathname === '/api/rag/upload' ||
    pathname === '/api/rag/materials/upload' ||
    pathname === '/api/materials/upload/pdf';

  if (isUploadRoute) {
    if (method !== 'POST') {
      sendStandardError(
        res,
        new AppError({ code: ErrorCode.VALIDATION_ERROR, message: `Method ${method} not supported. Use POST.`, statusCode: 405 }),
        requestId,
        { req }
      );
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
          subjectId = (parsed.fields.subject_id || '').trim();
          const rawUnit = (parsed.fields.unit_id || '').trim();
          unitId = rawUnit && rawUnit !== 'null' && rawUnit !== 'undefined' ? rawUnit : null;
          const rawName = (parsed.fields.name || parsed.fields.custom_name || '').trim();
          customName = rawName && rawName !== 'null' && rawName !== 'undefined' ? rawName : undefined;
          fileName = parsed.fileName || 'uploaded_document.pdf';
          fileBuffer = parsed.fileBuffer;
        } else if (contentType.includes('application/json')) {
          // B. JSON Base64 Upload
          const body = await parseJson(req);
          const parsed = UploadPdfJsonSchema.safeParse(body);
          if (!parsed.success) {
            return sendStandardError(
              res,
              AppError.validation(
                'Invalid JSON upload payload',
                parsed.error.issues.map(i => ({ field: i.path.join('.'), message: i.message }))
              ),
              requestId,
              { req }
            );
          }

          subjectId = parsed.data.subject_id;
          unitId = parsed.data.unit_id || null;
          fileName = parsed.data.file_name;
          customName = parsed.data.custom_name;

          const base64Data = parsed.data.file_base64.replace(/^data:[^;]+;base64,/, '');
          fileBuffer = Buffer.from(base64Data, 'base64');
        } else {
          return sendStandardError(
            res,
            AppError.unsupportedMediaType(
              'Please send either multipart/form-data with a "file" field or application/json with "file_base64".'
            ),
            requestId,
            { req }
          );
        }

        // Validate basic parameters
        if (!subjectId) {
          return sendStandardError(res, AppError.validation('Missing required parameter: subject_id'), requestId, { req });
        }

        if (!fileBuffer || fileBuffer.length === 0) {
          return sendStandardError(res, AppError.validation('No PDF file data provided for processing.'), requestId, { req });
        }

        // Check if asynchronous execution requested
        const isAsync =
          url.searchParams.get('async') === 'true' ||
          Boolean(req.headers['prefer']?.includes('respond-async'));

        if (isAsync) {
          const job = RagJobsService.createJob({
            profileId: ctx.user.id,
            subjectId,
            fileName
          });

          // Run processing asynchronously in background
          Promise.resolve(
            RagMaterialService.processAndIndexPdf({
              db: ctx.db,
              profileId: ctx.user.id,
              subjectId,
              unitId,
              fileName,
              fileBuffer,
              customName,
              jobId: job.id
            })
          ).catch(err => {
            console.error(`[Async RAG Worker] Job ${job.id} failed:`, err);
          });

          return sendStandardSuccess(
            res,
            {
              jobId: job.id,
              status: 'UPLOADED',
              pollUrl: `/api/rag/jobs/${job.id}`,
              message: 'File accepted for processing. Poll job endpoint for status.'
            },
            202,
            { requestId }
          );
        }

        // Synchronous Processing Pipeline (Default for instant verification & automated tests)
        const result = await RagMaterialService.processAndIndexPdf({
          db: ctx.db,
          profileId: ctx.user.id,
          subjectId,
          unitId,
          fileName,
          fileBuffer,
          customName
        });

        return sendStandardSuccess(res, result, 201, {
          message: 'PDF uploaded, processed, and chunked successfully',
          requestId
        });
      } catch (err: unknown) {
        if (err instanceof AppError) {
          return sendStandardError(res, err, requestId, { req });
        }
        const message = err instanceof Error ? err.message : 'Error processing PDF document';
        sendStandardError(res, AppError.internal(message, err), requestId, { req });
      }
    });

    await handler(req, res);
    return true;
  }

  // ----------------------------------------------------------------------------
  // 3. POST /api/rag/search (Semantic Search & Vector Retrieval)
  // ----------------------------------------------------------------------------
  const isSearchRoute =
    pathname === '/api/rag/search' ||
    pathname === '/api/rag/retrieve';

  if (isSearchRoute) {
    if (method !== 'POST') {
      sendStandardError(
        res,
        new AppError({ code: ErrorCode.VALIDATION_ERROR, message: `Method ${method} not supported. Use POST.`, statusCode: 405 }),
        requestId,
        { req }
      );
      return true;
    }

    const handler = requireAuth(async (req, res, ctx) => {
      try {
        const body = await parseJson(req);
        const parsed = SemanticSearchSchema.safeParse(body);
        if (!parsed.success) {
          return sendStandardError(
            res,
            AppError.validation(
              'Invalid semantic search payload',
              parsed.error.issues.map(i => ({ field: i.path.join('.'), message: i.message }))
            ),
            requestId,
            { req }
          );
        }

        const results = await SemanticSearchService.search({
          db: ctx.db,
          profileId: ctx.user.id,
          query: parsed.data.query,
          subjectId: parsed.data.subject_id,
          materialId: parsed.data.material_id,
          topK: parsed.data.top_k,
          threshold: parsed.data.threshold
        });

        // Distinguish NO_RELEVANT_CONTEXT from VECTOR_SEARCH_FAILED
        if (results.matches_count === 0) {
          res.setHeader('X-Request-Id', requestId);
          res.setHeader('Content-Type', 'application/json');
          res.writeHead(200);
          res.end(
            JSON.stringify({
              success: true,
              data: results,
              count: 0,
              message: 'No relevant study materials matched this topic or query.',
              error: {
                code: ErrorCode.NO_RELEVANT_CONTEXT,
                message: 'No relevant notes found for query',
                userMessage: 'No matching study notes were found. Try another query or upload syllabus materials.',
                retryable: false,
                requestId
              }
            })
          );
          return;
        }

        return sendStandardSuccess(res, results, 200, {
          count: results.matches_count,
          message: `Top ${results.matches_count} matching chunks retrieved`,
          requestId
        });
      } catch (err: unknown) {
        if (err instanceof AppError) {
          return sendStandardError(res, err, requestId, { req });
        }
        const message = err instanceof Error ? err.message : 'Error executing semantic search';
        return sendStandardError(res, AppError.vectorSearchFailed(message), requestId, { req });
      }
    });

    await handler(req, res);
    return true;
  }

  return false;
}
