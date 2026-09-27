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
  progressPercent: number;
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
      progressPercent: 10,
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

  public static getProgressPercentage(status: RagJobState): number {
    switch (status) {
      case 'UPLOADED':
        return 10;
      case 'VALIDATING':
        return 25;
      case 'EXTRACTING':
        return 45;
      case 'CHUNKING':
        return 65;
      case 'EMBEDDING':
        return 85;
      case 'INDEXING':
        return 95;
      case 'READY':
        return 100;
      case 'FAILED':
        return 0;
      default:
        return 0;
    }
  }
}
