import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LocalDevStore } from '../lib/local-store.js';
import { AcademicEngineService as Engine } from '../services/academic-engine.service.js';
async function main() {
const original = process.cwd();
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'lunalearn-test-'));
process.chdir(temp);
try {
  const store = LocalDevStore.getInstance();
  const db = store.createClient('student-a');
  const bytes = Buffer.from('%PDF-1.4\nreal stored bytes\n%%EOF');
  const saved = await db.storage.from('materials').upload('student-a/subject/notes.pdf', bytes);
  assert.equal(saved.error, null);
  const read = await db.storage.from('materials').download('student-a/subject/notes.pdf');
  assert.deepEqual(read.data, bytes);
  assert.ok((await store.createClient('student-b').storage.from('materials').download('student-a/subject/notes.pdf')).error);
  assert.ok((await db.storage.from('materials').download('student-a/../escape')).error);
  assert.ok((await db.storage.from('materials').download('student-a/missing.pdf')).error);
  store.reloadState();
  assert.deepEqual((await db.storage.from('materials').download('student-a/subject/notes.pdf')).data, bytes);
  assert.equal(Engine.calculateTopicCompletion([]), 0);
  assert.equal(Engine.calculateAssignmentCompletion([]), 100);
  assert.equal(Engine.calculateWeightedReadiness({topic_completion:60,quiz_performance:80,revision_activity:50,assignment_completion:100}),68);
  console.log('Real-data formulas and storage: passed');
} finally { process.chdir(original); fs.rmSync(temp, { recursive:true, force:true }); }

}
main().catch(err => { console.error(err); process.exitCode = 1; });
