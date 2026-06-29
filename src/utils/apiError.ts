/**
 * Extracts a human-readable error message from an Axios error or any thrown value.
 * Reads err.response.data.message first (set by backend GlobalExceptionHandler),
 * then falls back to err.message, then to the provided fallback string.
 */
export function extractApiError(
  err: unknown,
  fallback = 'Something went wrong. Please try again.'
): string {
  if (!err) return fallback;
  const e = err as any;
  return (
    e?.response?.data?.message ||
    e?.response?.data?.error ||
    e?.message ||
    fallback
  );
}
