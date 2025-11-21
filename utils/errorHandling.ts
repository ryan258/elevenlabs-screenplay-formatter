export const logError = (context: string, error: unknown) => {
  if (error instanceof Error) {
    console.error(`[${context}]`, error);
    return error.message;
  }
  console.error(`[${context}]`, error);
  return typeof error === 'string' ? error : 'Unknown error';
};

export const notifyError = (
  context: string,
  error: unknown,
  addToast?: (message: string, tone?: 'info' | 'success' | 'error') => void,
  fallbackMessage?: string
) => {
  const message = logError(context, error);
  if (addToast) {
    addToast(fallbackMessage || message, 'error');
  }
  return message;
};
