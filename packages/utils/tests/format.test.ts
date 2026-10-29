import { describe, expect, it } from 'vitest';
import { formatBytes, formatDuration, progressRatio } from '../src/index';
describe('formatação e progresso', () => {
  it('formata duração e tamanho e limita progresso inválido', () => {
    expect(formatDuration(3661)).toBe('1:01:01');
    expect(formatDuration(NaN)).toBe('0:00');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(-1)).toBe('0 B');
    expect(progressRatio(40, 0)).toBe(0);
    expect(progressRatio(120, 100)).toBe(1);
  });
});
