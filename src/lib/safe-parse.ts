/**
 * Safely parse a JSON string with a fallback value.
 * Prevents unhandled exceptions from malformed JSON.
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}
