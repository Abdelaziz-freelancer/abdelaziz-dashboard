import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export const ALL = ['site', 'contact', 'results', 'reviews', 'ticker', 'questions', 'responses', 'admins'];
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NEED = ['ADMIN_PASSWORD', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];

export const missing = () => NEED.filter((k) => !process.env[k]);
export const db = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const secret = () => crypto.createHash('sha256').update(`${process.env.ADMIN_PASSWORD}|${process.env.SUPABASE_SERVICE_ROLE_KEY}`).digest();

export function sign(payload) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 12 * 3600 * 1000 })).toString('base64url');
  return body + '.' + crypto.createHmac('sha256', secret()).update(body).digest('base64url');
}
export function verify(token) {
  try {
    const [body, sig] = String(token || '').split('.');
    if (!body || !sig) return null;
    const exp = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
    if (sig.length !== exp.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(exp))) return null;
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return p.exp > Date.now() ? p : null;
  } catch { return null; }
}
export const same = (a, b) => {
  const x = crypto.createHash('sha256').update(String(a)).digest(), y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
};
export const can = (me, p) => !!me && (me.master || (me.perms || []).includes(p));

// returns the admin (with fresh permissions) or sends an error and returns null
export async function guard(req, res, perm) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return null; }
  const m = missing();
  if (m.length) { res.status(500).json({ error: 'ناقص في Vercel (Environment Variables): ' + m.join(' , ') }); return null; }
  const me = verify((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
  if (!me) { res.status(401).json({ error: 'سجّل دخول تاني' }); return null; }
  if (!me.master) {
    const { data } = await db().from('dashboard_admins').select('permissions').eq('id', me.id).maybeSingle();
    if (!data) { res.status(401).json({ error: 'الحساب ده اتمسح' }); return null; }
    me.perms = data.permissions || [];
  }
  if (perm && !can(me, perm)) { res.status(403).json({ error: 'مفيش عندك صلاحية للقسم ده' }); return null; }
  return me;
}
export const fail = (res, e) => res.status(500).json({ error: (e && e.message) || 'خطأ في السيرفر' });
