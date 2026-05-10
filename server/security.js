import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === 'change_this_to_a_long_random_secret') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be set to a long random value in production.');
    }
    return 'local_development_only_change_me';
  }
  return secret;
}

export function hashIp(req) {
  const raw =
    req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
    req.socket.remoteAddress ||
    '';
  const salt = getJwtSecret();
  return crypto.createHash('sha256').update(`${salt}:${raw}`).digest('hex');
}

export function signSession(user) {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      username: user.username,
      force_password_change: Boolean(user.force_password_change),
    },
    getJwtSecret(),
    { expiresIn: '8h' },
  );
}

export function verifySession(token) {
  return jwt.verify(token, getJwtSecret());
}

export function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    login_email: row.login_email,
    role: row.role,
    display_name: row.display_name,
    active: Boolean(row.active),
    force_password_change: Boolean(row.force_password_change),
    last_login_at: row.last_login_at,
  };
}

export function browserFamily(userAgent = '') {
  if (/edg/i.test(userAgent)) return 'Edge';
  if (/chrome|crios/i.test(userAgent)) return 'Chrome';
  if (/firefox|fxios/i.test(userAgent)) return 'Firefox';
  if (/safari/i.test(userAgent)) return 'Safari';
  return 'Other';
}

export function deviceType(userAgent = '') {
  if (/ipad|tablet/i.test(userAgent)) return 'tablet';
  if (/mobile|iphone|android/i.test(userAgent)) return 'mobile';
  return 'desktop';
}
