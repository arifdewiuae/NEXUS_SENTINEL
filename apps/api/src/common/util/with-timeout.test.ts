import { describe, expect, it, vi } from 'vitest';
import { withTimeout } from './with-timeout';

describe('withTimeout', () => {
  it('resolves with the work result when work wins the race', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 1000, () => new Error('nope'))).resolves.toBe(
      'ok',
    );
  });

  it('rejects with the onTimeout error when the deadline passes first', async () => {
    const never = new Promise<string>(() => {});
    await expect(withTimeout(never, 5, () => new Error('timed out'))).rejects.toThrow('timed out');
  });

  it('clears the timer once the race settles', async () => {
    const clear = vi.spyOn(globalThis, 'clearTimeout');
    await withTimeout(Promise.resolve('done'), 1000, () => new Error('nope'));
    expect(clear).toHaveBeenCalled();
    clear.mockRestore();
  });
});
