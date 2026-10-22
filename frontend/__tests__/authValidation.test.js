import {
  validateEmail, validatePhone, validateName, validatePassword,
  normalizeEmail, normalizePhone, passwordStrength, authErrorMessage,
  fieldErrorsFromResponse,
} from '../src/utils/authValidation';

describe('authValidation (ported from website)', () => {
  test('email rules match website messages', () => {
    expect(validateEmail('')).toBe('Email is required');
    expect(validateEmail('bad')).toBe('Enter a valid email address');
    expect(validateEmail('A@B.CO')).toBe('');
    expect(normalizeEmail('  Test@X.com ')).toBe('test@x.com');
  });
  test('phone rules accept 10-digit Indian mobiles', () => {
    expect(validatePhone('')).toBe('Mobile number is required');
    expect(validatePhone('123')).toBe('Mobile number must be exactly 10 digits');
    expect(validatePhone('5123456789')).toBe('Enter a valid 10-digit mobile number');
    expect(validatePhone('+91 98765 43210')).toBe('');
    expect(normalizePhone('09876543210')).toBe('9876543210');
  });
  test('name and password bounds', () => {
    expect(validateName('')).toBe('Full name is required');
    expect(validateName('A')).toBe('Name must be at least 2 characters');
    expect(validatePassword('')).toBe('Password is required');
    expect(validatePassword('short1')).toBe('Password must be at least 8 characters');
    expect(validatePassword('long-enough-1')).toBe('');
  });
  test('password strength scale', () => {
    expect(passwordStrength('abcdefgh')).toBe(1);
    expect(passwordStrength('Abcdefgh1!')).toBe(4);
  });
  test('server error mapping', () => {
    expect(authErrorMessage({ response: { status: 429 } }, 'x')).toMatch(/Too many attempts/);
    expect(authErrorMessage({ response: { status: 401 } }, 'x')).toMatch(/Invalid email/);
    expect(authErrorMessage({ response: { status: 200, data: { message: 'Email already exists' } } }, 'x')).toMatch(/another email/);
    expect(
      fieldErrorsFromResponse({ response: { data: { errors: [{ path: 'email', msg: 'taken' }] } } }),
    ).toEqual({ email: 'taken' });
  });
});
