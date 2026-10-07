/**
 * transactionLabDraftStorage.ts
 * Dual-tier persistence for Spring Transaction Lab scenarios.
 * Saves candidate method annotations, propagation, and concurrency load across page refreshes.
 * Cognitive bounding limit: <= 200 lines (Rule 8 compliant).
 */

import { TransactionAnnotationConfig } from '../types/transactionLab';

export interface TransactionLabLocalDraft {
  scenarioId: string;
  userConfigs: Record<string, TransactionAnnotationConfig>;
  threads: number;
  updatedAt: number;
}

const TX_DRAFT_PREFIX = 'tx_lab_draft:';

export function saveTxLabLocalDraft(
  scenarioId: string,
  userConfigs: Record<string, TransactionAnnotationConfig>,
  threads: number
): void {
  if (!scenarioId || !userConfigs) return;

  try {
    const draft: TransactionLabLocalDraft = {
      scenarioId,
      userConfigs,
      threads,
      updatedAt: Date.now()
    };
    localStorage.setItem(`${TX_DRAFT_PREFIX}${scenarioId}`, JSON.stringify(draft));
  } catch (e) {
    console.warn(`[transactionLabDraftStorage] Failed to save local draft for ${scenarioId}:`, e);
  }
}

export function getTxLabLocalDraft(scenarioId: string): TransactionLabLocalDraft | null {
  if (!scenarioId) return null;

  try {
    const raw = localStorage.getItem(`${TX_DRAFT_PREFIX}${scenarioId}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function removeTxLabLocalDraft(scenarioId: string): void {
  if (!scenarioId) return;
  try {
    localStorage.removeItem(`${TX_DRAFT_PREFIX}${scenarioId}`);
  } catch {}
}

export async function syncTxLabDraftWithCloud(
  scenarioId: string,
  userConfigs: Record<string, TransactionAnnotationConfig>,
  threads: number
): Promise<boolean> {
  try {
    const res = await fetch('/api/practice/transaction-lab/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ scenarioId, userConfigs, threads })
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchTxLabDraftFromCloud(
  scenarioId: string
): Promise<TransactionLabLocalDraft | null> {
  try {
    const res = await fetch(`/api/practice/transaction-lab/draft/${encodeURIComponent(scenarioId)}`, {
      credentials: 'include'
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.draft) return null;

    return {
      scenarioId,
      userConfigs: data.draft.userConfigs || {},
      threads: data.draft.threads || 1,
      updatedAt: data.draft.updatedAt ? new Date(data.draft.updatedAt).getTime() : 0
    };
  } catch {
    return null;
  }
}
