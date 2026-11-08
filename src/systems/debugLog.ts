/**
 * debugLog.ts
 * ─────────────────────────────────────────────────────────
 * Helper para logs de debug.
 * Ativo apenas quando ?debug=1 está na URL.
 */

/**
 * Verifica se o modo debug está ativo.
 */
export function isDebugMode(): boolean {
  if (typeof window === 'undefined') return false;
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('debug') === '1';
}

/**
 * Log condicional baseado no modo debug.
 */
export function debugLog(...args: unknown[]): void {
  if (isDebugMode()) {
    console.log('[DEBUG]', ...args);
  }
}

/**
 * Warn condicional baseado no modo debug.
 */
export function debugWarn(...args: unknown[]): void {
  if (isDebugMode()) {
    console.warn('[DEBUG]', ...args);
  }
}

/**
 * Error condicional baseado no modo debug.
 */
export function debugError(...args: unknown[]): void {
  if (isDebugMode()) {
    console.error('[DEBUG]', ...args);
  }
}
