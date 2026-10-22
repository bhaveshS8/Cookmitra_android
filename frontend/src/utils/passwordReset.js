// The backend mints reset tokens with crypto.randomBytes(32).toString("hex"),
// so a valid token is exactly 64 hexadecimal characters. Rejecting malformed
// links on-device avoids sending arbitrary strings to /auth/reset-password.
const RESET_TOKEN_RE = /^[a-f0-9]{64}$/i;

export const parseResetToken = (value) => {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) {
    return { token: '', problem: 'missing' };
  }
  if (!RESET_TOKEN_RE.test(trimmed)) {
    return { token: '', problem: 'malformed' };
  }
  return { token: trimmed, problem: '' };
};
