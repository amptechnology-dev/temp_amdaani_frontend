// Centralized error extractor
export function extractErrorMessage(errorResponse) {
  if (typeof errorResponse === 'string') return errorResponse;

  const data = errorResponse?.response?.data || errorResponse;

  // 1. Direct message

  // 2. Array of errors
  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    return data.errors.map(err => err.message).join('\n'); // multiline
  }

  // 3. Object-based errors
  if (data?.errors && typeof data.errors === 'object') {
    if (data.errors.error) return data.errors.error;
    if (data.errors.message) return data.errors.message;
  }

  if (data?.message) return data.message;

  // 4. Fallback
  return 'Something went wrong. Please try again.';
}
