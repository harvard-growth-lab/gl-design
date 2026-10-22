/**
 * Development-time warnings.
 *
 * Several spec rules can't be expressed in a type — a title ending in a period,
 * highlighting at most two series. Those get a console warning in development
 * so the feedback arrives while the chart is being written, and vanish in
 * production builds where bundlers constant-fold `process.env.NODE_ENV`.
 *
 * `process` doesn't exist in a browser at runtime, so the guard has to be a
 * `typeof` check rather than a bare property read — otherwise an un-substituted
 * bundle throws a ReferenceError on import.
 */

declare const process: { env?: Record<string, string | undefined> } | undefined;

export const isDev: boolean =
  typeof process === 'undefined' || process?.env?.NODE_ENV !== 'production';

export function warn(message: string): void {
  if (isDev) console.warn(`[gl-charts] ${message}`);
}
