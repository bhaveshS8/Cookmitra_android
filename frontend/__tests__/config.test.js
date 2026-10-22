import { normalizeRole } from '../src/store/store';
import { getApiConfig } from '../src/config';

describe('auth role + config', () => {
  test('roles normalize like the website', () => {
    expect(normalizeRole('ADMIN')).toBe('admin');
    expect(normalizeRole('Cook')).toBe('cook');
    expect(normalizeRole('customer')).toBe('customer');
  });
  test('API requests always target the production backend', () => {
    const cfg = getApiConfig();
    expect(cfg.baseUrl).toBe('https://cookmitra.org/api');
    expect(cfg.webOrigin).toMatch(/^https?:\/\//);
  });
});
