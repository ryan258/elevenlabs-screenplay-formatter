import { GenerationError } from './elevenLabsApi';

export const isGenerationError = (error: unknown): error is GenerationError => {
  return error instanceof GenerationError;
};
