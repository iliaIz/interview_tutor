/**
 * SOTA Full-Jitter Exponential Backoff HTTP Transport Utility (AGENTS.md Invariant 5)
 * Formula: T = random(0, min(2500, 800 * 1.8^attempt))
 * Designed for LiteLLM Gateway & upstream LLM API calls with zero phantom fallbacks.
 */

export interface HttpRetryConfig {
  maxRetries?: number;
  parentSignal?: AbortSignal;
  timeoutMs?: number;
  retryableStatuses?: number[];
}

export async function fetchWithFullJitterRetry(
  url: string,
  options: RequestInit,
  maxRetries = 2,
  parentSignal?: AbortSignal,
  timeoutMs = 45_000,
  retryableStatuses: number[] = [429, 500, 502, 503, 504]
): Promise<globalThis.Response> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (parentSignal?.aborted) {
      const abortErr = new Error('Request aborted by client');
      abortErr.name = 'AbortError';
      throw abortErr;
    }

    if (attempt > 0) {
      const backoffCapMs = 2500;
      const calculatedBackoff = Math.floor(800 * Math.pow(1.8, attempt));
      const delayWithJitter = Math.floor(Math.random() * Math.min(backoffCapMs, calculatedBackoff));
      console.log(`⏱️ [HttpRetry] Transient retry attempt ${attempt}/${maxRetries} after ${delayWithJitter}ms jitter delay...`);
      await new Promise((resolve) => setTimeout(resolve, delayWithJitter));

      if (parentSignal?.aborted) {
        const abortErr = new Error('Request aborted by client');
        abortErr.name = 'AbortError';
        throw abortErr;
      }
    }

    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const combinedSignal = parentSignal
      ? AbortSignal.any([parentSignal, timeoutSignal])
      : timeoutSignal;

    const perAttemptOptions: RequestInit = {
      ...options,
      signal: combinedSignal
    };

    try {
      const res = await fetch(url, perAttemptOptions);
      if (res.ok) {
        return res;
      }

      if (retryableStatuses.includes(res.status)) {
        const errTxt = await res.text().catch(() => '');
        lastError = new Error(`HTTP ${res.status}: ${errTxt}`);
        console.warn(`[HttpRetry Transient ${res.status}] Attempt ${attempt}/${maxRetries}:`, errTxt.slice(0, 150));
        continue;
      }

      // Non-retryable HTTP status (400, 401, 403, 404, etc.)
      return res;
    } catch (err: any) {
      if (parentSignal?.aborted) {
        const abortErr = new Error('Request aborted by client');
        abortErr.name = 'AbortError';
        throw abortErr;
      }

      lastError = err;
      console.warn(`[HttpRetry Network/Timeout Error] Attempt ${attempt}/${maxRetries}:`, err?.message || err);
    }
  }

  throw (lastError instanceof Error ? lastError : new Error(`HTTP request failed after ${maxRetries} retries`));
}
