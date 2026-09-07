import { db } from '../connection';

export function recoverOrphanedJobs() {
  try {
    const info = db.prepare(`
      UPDATE podcast_jobs
      SET status = 'FAILED',
          error = 'Процесс генерации прерван перезапуском сервера'
      WHERE status IN ('PROCESSING', 'QUEUED')
    `).run();
    if (info.changes > 0) {
      console.log(`🧹 Recovered ${info.changes} orphaned podcast jobs marked as FAILED`);
    }
  } catch (err) {
    console.error('Error recovering orphaned jobs:', err);
  }
}
