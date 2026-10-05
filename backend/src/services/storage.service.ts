import { SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { Database } from '../types/database.js';
import { AppError } from '../types/errors.js';
export interface StorageUploadResult { storagePath: string; bucket: string; sizeBytes: number }
export class StorageService {
  static async uploadPdf(db: SupabaseClient<Database>, profileId: string, subjectId: string, fileName: string, fileBuffer: Buffer): Promise<StorageUploadResult> {
    const storagePath = `${profileId}/${subjectId}/${crypto.randomUUID()}_${fileName.toLowerCase().replace(/[^a-z0-9._-]/g, '_')}`;
    const { data, error } = await db.storage.from('materials').upload(storagePath, fileBuffer, { contentType: 'application/pdf', upsert: false });
    if (error || !data) throw AppError.internal('PDF could not be saved. Please retry.', error);
    return { storagePath: data.path, bucket: 'materials', sizeBytes: fileBuffer.length };
  }
  static async readPdf(db: SupabaseClient<Database>, storagePath: string): Promise<Buffer> {
    const { data, error } = await db.storage.from('materials').download(storagePath);
    if (error || !data) throw AppError.notFound('Original PDF unavailable—upload again.');
    return Buffer.isBuffer(data) ? data : Buffer.from(await data.arrayBuffer());
  }
}
