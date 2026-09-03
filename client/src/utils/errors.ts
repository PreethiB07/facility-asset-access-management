import axios from 'axios';

export function getErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return 'Network error. Please check your connection and try again.';
    }

    const data = error.response.data as { error?: { message?: string } } | undefined;
    if (data?.error?.message) {
      return data.error.message;
    }

    switch (error.response.status) {
      case 401:
        return 'Invalid email or password.';
      case 403:
        return 'You are not authorized to perform this action.';
      case 404:
        return 'The requested resource could not be found.';
      case 409:
        return 'This request has already been processed.';
      default:
        return fallback;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
