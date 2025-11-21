/* eslint-env node */
/* global console, module */

const logError = (context, error) => {
  if (error instanceof Error) {
    console.error(`[${context}]`, error);
    return error.message;
  }
  console.error(`[${context}]`, error);
  return typeof error === 'string' ? error : 'Unknown error';
};

module.exports = { logError };
