const crypto = require('crypto');

function base64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function sign(payload) {
  const secret = process.env.AUTH_SECRET;
  const body = base64url(JSON.stringify(payload));
  const sig = base64url(crypto.createHmac('sha256', secret).update(body).digest());
  return `${body}.${sig}`;
}

function verify(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const secret = process.env.AUTH_SECRET;
  const expectedSig = base64url(crypto.createHmac('sha256', secret).update(body).digest());
  if (sig.length !== expectedSig.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

module.exports = { sign, verify };
