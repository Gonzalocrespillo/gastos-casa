const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');
const token = require('./_token');

const ITERATIONS = 100000;
const KEYLEN = 32;
const DIGEST = 'sha256';
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días
const ALLOWED_USERS = ['gonzalo', 'sofia'];

function usersStore() {
  return getStore({ name: 'usuarios', siteID: process.env.BLOBS_SITE_ID, token: process.env.BLOBS_TOKEN });
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST).toString('hex');
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'JSON inválido' }) };
  }
  const { action, password, confirmPassword } = body;
  const uname = (body.username || '').trim().toLowerCase();

  if (!ALLOWED_USERS.includes(uname)) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Usuario no permitido' }) };
  }

  const store = usersStore();

  if (action === 'status') {
    const existing = await store.get(uname, { type: 'json' });
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ exists: !!existing }) };
  }

  if (action === 'reset_tmp') {
    if (body.secret !== '9a94bb6d85ca126d1e323fb228f0d2235af0944d118409ca') {
      return { statusCode: 403, body: JSON.stringify({ error: 'no' }) };
    }
    await store.delete(uname);
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }

  if (!password) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Falta la contraseña' }) };
  }

  if (action === 'signup') {
    if (password.length < 6) {
      return { statusCode: 400, body: JSON.stringify({ error: 'La contraseña debe tener al menos 6 caracteres' }) };
    }
    if (password !== confirmPassword) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Las contraseñas no coinciden' }) };
    }
    const existing = await store.get(uname, { type: 'json' });
    if (existing) {
      return { statusCode: 409, body: JSON.stringify({ error: 'Ese usuario ya existe' }) };
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(password, salt);
    await store.setJSON(uname, { username: uname, salt, hash });
    const t = token.sign({ u: uname, exp: Date.now() + TOKEN_TTL_MS });
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: t, username: uname }) };
  }

  if (action === 'login') {
    const user = await store.get(uname, { type: 'json' });
    if (!user) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Usuario o contraseña incorrectos' }) };
    }
    const hash = hashPassword(password, user.salt);
    const a = Buffer.from(hash), b = Buffer.from(user.hash);
    const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
    if (!ok) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Usuario o contraseña incorrectos' }) };
    }
    const t = token.sign({ u: uname, exp: Date.now() + TOKEN_TTL_MS });
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: t, username: uname }) };
  }

  return { statusCode: 400, body: JSON.stringify({ error: 'Acción inválida' }) };
};
