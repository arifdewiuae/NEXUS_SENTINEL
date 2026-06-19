import { ApiError } from './api';

/** Humanize an unknown thrown value into a message safe to show the user. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return 'Something went wrong. Please try again.';
}
