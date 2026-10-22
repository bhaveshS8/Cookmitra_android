import { parseResetToken } from '../src/utils/passwordReset';

const TOKEN = 'a'.repeat(64);

describe('password-reset token parsing', () => {
  test('accepts the backend 64-character hex format', () => {
    expect(parseResetToken(TOKEN)).toEqual({ token: TOKEN, problem: '' });
    expect(parseResetToken([TOKEN])).toEqual({ token: TOKEN, problem: '' });
  });

  test('distinguishes a missing link from a malformed one', () => {
    expect(parseResetToken(undefined).problem).toBe('missing');
    expect(parseResetToken('   ').problem).toBe('missing');
    expect(parseResetToken('not-a-token').problem).toBe('malformed');
    expect(parseResetToken('z'.repeat(64)).problem).toBe('malformed');
    expect(parseResetToken(`${TOKEN}00`).problem).toBe('malformed');
  });
});
