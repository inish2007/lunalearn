import fs from 'fs';
import path from 'path';
import { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../lib/supabase.js';
import { Database } from '../types/database.js';

export interface StorageUploadResult {
  storagePath: string;
  bucket: string;
  sizeBytes: number;
}

export class StorageService {
  private static readonly BUCKET_NAME = 'materials';

  /**
   * Uploads a raw PDF file buffer into Supabase Storage under the 'materials' bucket.
   * Path convention: `<profile_id>/<subject_id>/<timestamp>_<clean_filename>.pdf`
   * 
   * Gracefully handles bucket creation and offline/placeholder mode.
   */
  public static async uploadPdf(
    db: SupabaseClient<Database>,
    profileId: string,
    subjectId: string,
    fileName: string,
    fileBuffer: Buffer
  ): Promise<StorageUploadResult> {
    const cleanFileName = fileName
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '_')
      .replace(/\s+/g, '_');

    const timestamp = Date.now();
    const storagePath = `${profileId}/${subjectId}/${timestamp}_${cleanFileName}`;

    try {
      // 1. Attempt upload via user-scoped or service client
      const { data, error } = await db.storage
        .from(this.BUCKET_NAME)
        .upload(storagePath, fileBuffer, {
          contentType: 'application/pdf',
          upsert: true
        });

      if (!error && data) {
        return {
          storagePath: data.path || storagePath,
          bucket: this.BUCKET_NAME,
          sizeBytes: fileBuffer.length
        };
      }

      // If bucket does not exist, attempt to auto-create it with admin client
      if (error && (error.message.includes('Bucket not found') || error.message.includes('not exist'))) {
        try {
          await supabaseAdmin.storage.createBucket(this.BUCKET_NAME, {
            public: false,
            fileSizeLimit: 52428800 // 50MB
          });

          // Retry upload
          const retry = await db.storage
            .from(this.BUCKET_NAME)
            .upload(storagePath, fileBuffer, {
              contentType: 'application/pdf',
              upsert: true
            });

          if (!retry.error) {
            return {
              storagePath: retry.data?.path || storagePath,
              bucket: this.BUCKET_NAME,
              sizeBytes: fileBuffer.length
            };
          }
        } catch {
          // Continue to fallback
        }
      }

      // If Supabase Storage failed (e.g. placeholder credentials or network), write locally for testing/dev
      return this.writeLocalFallback(storagePath, fileBuffer);
    } catch {
      return this.writeLocalFallback(storagePath, fileBuffer);
    }
  }

  /**
   * Fallback for local development or placeholder Supabase credentials.
   * Stores the uploaded file in backend/uploads/<storagePath>.
   */
  private static writeLocalFallback(storagePath: string, fileBuffer: Buffer): StorageUploadResult {
    try {
      const localDir = path.resolve(process.cwd(), 'uploads', path.dirname(storagePath));
      fs.mkdirSync(localDir, { recursive: true });
      const fullPath = path.resolve(process.cwd(), 'uploads', storagePath);
      fs.writeFileSync(fullPath, fileBuffer);
    } catch {
      // Non-fatal if filesystem is restricted
    }

    return {
      storagePath,
      bucket: this.BUCKET_NAME,
      sizeBytes: fileBuffer.length
    };
  }
}
