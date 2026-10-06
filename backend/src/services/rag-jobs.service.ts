/**
 * Production-Grade Asynchronous RAG Job Processor & Granular State Tracker
 * Manages states: UPLOADED -> VALIDATING -> EXTRACTING -> CHUNKING -> EMBEDDING -> INDEXING -> READY / FAILED
 */

import crypto from 'crypto';

export type RagJobState =
  | 'UPLOADED'
  | 'VALIDATING'
  | 'EXTRACTING'
  | 'CHUNKING'
  | 'EMBEDDING'
  | 'INDEXING'
  | 'READY'
  | 'FAILED';

export interface RagJob {
  id: string;
  profileId: string;
  subjectId: string;
  fileName: string;
  status: RagJobState;
  progressPercent: number | null;
  materialId?: string;
  chunksCreated?: number;
  totalPages?: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export class RagJobsService {
  private static jobs = new Map<string, RagJob>();

  public static createJob(params: {
    profileId: string;
    subjectId: string;
    fileName: string;
  }): RagJob {
    const id = `rag_job_${crypto.randomBytes(8).toString('hex')}`;
    const now = new Date().toISOString();
    const job: RagJob = {
      id,
      profileId: params.profileId,
      subjectId: params.subjectId,
      fileName: params.fileName,
      status: 'UPLOADED',
      progressPercent: null,
      createdAt: now,
      updatedAt: now
    };
    this.jobs.set(id, job);
    return job;
  }

  public static updateJob(
    jobId: string,
    updates: Partial<Omit<RagJob, 'id' | 'createdAt'>>
  ): RagJob | null {
    const job = this.jobs.get(jobId);
    if (!job) return null;

    Object.assign(job, updates, { updatedAt: new Date().toISOString() });
    return job;
  }

  public static getJob(jobId: string): RagJob | null {
    return this.jobs.get(jobId) || null;
  }

  /** Intermediate processing stages have no measured overall percentage. */
  public static getProgressPercentage(status: RagJobState): number | null {
    return status === 'READY' ? 100 : status === 'FAILED' ? 0 : null;
  }
}
