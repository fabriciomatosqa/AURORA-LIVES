import { describe, expect, it } from 'vitest';
import { CHECK_INTERVAL_MS } from './useOnlineUpdater';
describe('consulta periódica de atualizações', () => {
  it('consulta o GitHub a cada duas horas', () => {
    expect(CHECK_INTERVAL_MS).toBe(2 * 60 * 60 * 1000);
  });
});
