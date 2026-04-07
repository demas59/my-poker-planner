import { describe, expect, it } from 'vitest';
import { environment } from './environment';

describe('environment', () => {
  it('exposes the API url', () => {
    expect(environment.apiUrl).toBe('http://localhost:3000');
  });
});
