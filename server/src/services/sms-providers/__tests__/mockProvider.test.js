import { describe, it, expect } from 'vitest';
import mockProvider from '../mockProvider.js';

describe('mockProvider', () => {
  it('exposes id, label and no required fields', () => {
    expect(mockProvider.id).toBe('mock');
    expect(mockProvider.requiredFields).toEqual([]);
  });

  it('always resolves with a providerMessageId, without sending anything real', async () => {
    const result = await mockProvider.send('11988887777', 'oi');
    expect(result.providerMessageId).toMatch(/^mock_\d+$/);
  });
});
