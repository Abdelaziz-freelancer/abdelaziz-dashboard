import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { BUILTIN_ADMIN } from './_config.js';

export const ALL = ['site', 'contact', 'results', 'reviews', 'ticker', 'questions', 'responses', 'admins'];
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NEED = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];

export const missing = () => NEED.filter((k) => !process.env[k]);
// بنقبل الرابط حتى لو اتلصق بحاجات زيادة (مسافات، علامات تنصيص، /rest/v1، رابط الداش بورد...) ونخليه https://xxxx.supabase.co بس
const clean = (v) => String(v || '').trim().replace(/^["']+|["']+$/g, '').trim();
export const baseUrl = () => { const v = clean(process.env.SUPABASE_URL); try { return new URL(/^https?:\/\//i.test(v) ? v : 'https://' + v).origin; } catch { return v; } };
const serviceKey = () => clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
export const db = () => createClient(baseUrl(), serviceKey(), { auth: { persistSession: false } });
const secret = () => crypto.createHash('sha256').update(`${process.env.ADMIN_PASSWORD || BUILTIN_ADMIN}|${serviceKey()}`).digest();

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
// كلمة سر المدير: لو ADMIN_PASSWORD متضاف في Vercel بيتستخدم هو، غير كده بنقارن بالـ hash الافتراضي
export function checkMaster(pw) {
  if (!pw) return false;
  if (process.env.ADMIN_PASSWORD) return same(pw, process.env.ADMIN_PASSWORD);
  const [alg, salt, hash] = String(BUILTIN_ADMIN).split('$');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const h = crypto.scryptSync(String(pw), Buffer.from(salt, 'hex'), 32), b = Buffer.from(hash, 'hex');
  return h.length === b.length && crypto.timingSafeEqual(h, b);
}
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
const HINTS = [
  [/invalid path specified/i, 'رابط Supabase (SUPABASE_URL) فيه حاجة زيادة. لازم يكون https://xxxx.supabase.co بس.'],
  [/invalid api key|invalid jwt|jwt|apikey/i, 'مفتاح Supabase (SUPABASE_SERVICE_ROLE_KEY) غلط أو ناقص. انسخ الـ Secret key من Settings ← API Keys.'],
  [/could not find the table|does not exist|schema cache/i, 'جداول القاعدة مش موجودة. شغّل ملف supabase-schema.sql في Supabase (SQL Editor).'],
  [/fetch failed|enotfound|getaddrinfo/i, 'مش قادر يوصل لـ Supabase. راجع SUPABASE_URL.']
];
export const fail = (res, e) => {
  const m = (e && e.message) || 'خطأ في السيرفر', h = HINTS.find((x) => x[0].test(m));
  res.status(500).json({ error: h ? h[1] + ' (' + m + ')' : m });
};
