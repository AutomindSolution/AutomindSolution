const { randomBytes, createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

// Public project identifiers; never use a service-role key here.
const SUPABASE_URL = 'https://pzlxoxvdokshymtctyih.supabase.co';
const PUBLIC_KEY = 'sb_publishable_YIn64UmciqjF9S11W-66hQ_moTOjJic';
const ORIGIN = 'https://www.automindsolution.com.br';
const SESSION = '__Host-automind-session';
const VERIFIER = '__Host-automind-pkce';
const ALLOWED_EMAILS = ['atendimento@automindsolution.com.br'];

function cookies(req) {
  const values = {};
  for (const item of (req.headers.cookie || '').split(';')) {
    const at = item.indexOf('=');
    if (at < 0) continue;
    try { values[item.slice(0, at).trim()] = decodeURIComponent(item.slice(at + 1)); } catch {}
  }
  return values;
}
function cookie(name, value, age) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
}
function redirect(res, url) { res.statusCode = 303; res.setHeader('Location', url); res.end(); }
function page(res, status, message = '') {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // message is exclusively a constant owned by this module, never query/provider text.
  res.end(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Entrar — Automind</title><style>*{box-sizing:border-box}body{margin:0;background:#FAFAF7;color:#141414;font:16px/1.6 system-ui,sans-serif;min-height:100svh;display:grid;place-items:center;padding:24px}main{max-width:460px;width:100%;border-top:4px solid #D6402C;padding:32px 0}h1{font-size:36px;line-height:1.1;letter-spacing:-1px}p{color:#575752}.brand{font-weight:700;letter-spacing:.04em}button{font:600 16px system-ui;width:100%;padding:16px;background:#141414;color:white;border:0;cursor:pointer}button:focus-visible,a:focus-visible{outline:3px solid #D6402C;outline-offset:4px}a{color:#8F2D1D}.notice{padding:14px;border-left:3px solid #D6402C;background:#F2E8E4}</style></head><body><main><div class="brand">AUTOMIND / ADMIN</div><h1>Acesso à operação.</h1><p>Entre com sua conta Google autorizada para acessar o painel.</p>${message ? `<p class="notice" role="alert">${message}</p>` : ''}<form method="post" action="/api/admin?action=login"><button type="submit">Entrar com Google</button></form><p>O acesso é exclusivo das contas autorizadas pela Automind.</p><a href="/">Voltar ao site</a></main></body></html>`);
}
async function auth(path, options = {}) {
  return fetch(`${SUPABASE_URL}/auth/v1${path}`, {
    ...options,
    headers: { apikey: PUBLIC_KEY, 'Content-Type': 'application/json', ...options.headers },
    signal: AbortSignal.timeout(10000)
  });
}
async function verifiedUser(token) {
  if (!token || token.length > 6000) return null;
  const response = await auth('/user', { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) return null;
  const user = await response.json();
  const google = user.identities?.some(identity => identity.provider === 'google');
  return user.email_confirmed_at && google && !user.is_anonymous &&
    ALLOWED_EMAILS.includes(String(user.email).toLowerCase()) ? user : null;
}
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('Vary', 'Cookie');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const url = new URL(req.url, ORIGIN);
  const action = url.searchParams.get('action') || 'panel';
  const jar = cookies(req);
  try {
    if (action === 'login' || action === 'logout') {
      if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return page(res, 405, 'Use o botão de entrada para continuar.'); }
      if (req.headers.origin !== ORIGIN) return page(res, 403, 'Abra o painel pelo endereço oficial da Automind.');
    } else if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET'); return page(res, 405);
    }
    if (action === 'login') {
      const settings = await auth('/settings');
      if (!settings.ok || !(await settings.json()).external?.google) {
        return page(res, 503, 'O login Google está aguardando a ativação pela Automind. O acesso ao painel permanece bloqueado.');
      }
      const verifier = randomBytes(48).toString('base64url');
      const challenge = createHash('sha256').update(verifier).digest('base64url');
      const target = new URL(`${SUPABASE_URL}/auth/v1/authorize`);
      target.search = new URLSearchParams({ provider: 'google', redirect_to: `${ORIGIN}/api/admin?action=callback`, code_challenge: challenge, code_challenge_method: 's256', prompt: 'select_account' }).toString();
      res.setHeader('Set-Cookie', cookie(VERIFIER, verifier, 600));
      return redirect(res, target.href);
    }
    if (action === 'callback') {
      res.setHeader('Set-Cookie', [cookie(VERIFIER, '', 0), cookie(SESSION, '', 0)]);
      const code = url.searchParams.get('code');
      if (!code || code.length > 2048 || !/^[A-Za-z0-9_-]{64}$/.test(jar[VERIFIER] || '') || url.searchParams.has('error')) {
        return page(res, 400, 'A entrada expirou ou foi cancelada. Tente novamente.');
      }
      const exchange = await auth('/token?grant_type=pkce', { method: 'POST', body: JSON.stringify({ auth_code: code, code_verifier: jar[VERIFIER] }) });
      if (!exchange.ok) return page(res, 401, 'Não foi possível confirmar a entrada. Tente novamente.');
      const session = await exchange.json();
      const user = await verifiedUser(session.access_token);
      if (!user) {
        if (session.access_token) await auth('/logout?scope=local', { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` } });
        return page(res, 403, 'Esta conta não está autorizada a acessar o painel.');
      }
      // No refresh token is persisted. Expired sessions require Google sign-in again.
      const age = Math.min(Number(session.expires_in) || 3600, 3600);
      res.setHeader('Set-Cookie', [cookie(VERIFIER, '', 0), cookie(SESSION, session.access_token, age)]);
      return redirect(res, '/admin');
    }
    if (action === 'logout') {
      res.setHeader('Set-Cookie', [cookie(SESSION, '', 0), cookie(VERIFIER, '', 0)]);
      if (jar[SESSION]) await auth('/logout?scope=local', { method: 'POST', headers: { Authorization: `Bearer ${jar[SESSION]}` } });
      return redirect(res, '/admin');
    }
    if (action !== 'panel') return page(res, 404);
    const user = await verifiedUser(jar[SESSION]);
    if (!user) {
      res.setHeader('Set-Cookie', cookie(SESSION, '', 0));
      return page(res, 200, jar[SESSION] ? 'Sua sessão expirou ou a conta não tem acesso. Entre novamente.' : '');
    }
    // Read the private panel only after server-side authentication and authorization.
    const html = readFileSync(join(process.cwd(), 'private', 'admin.html'), 'utf8');
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(html);
  } catch {
    return page(res, 503, 'Não foi possível verificar o acesso agora. Tente novamente em alguns instantes.');
  }
};
