import bcrypt from 'bcryptjs';
import { ALL, db, missing, same, sign } from './_utils.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const m = missing();
  if (m.length) return res.status(500).json({ error: 'ناقص في Vercel (Environment Variables): ' + m.join(' , ') });
  const { name = '', password = '' } = req.body || {};
  await new Promise((r) => setTimeout(r, 350));
  if (password && same(password, process.env.ADMIN_PASSWORD)) {
    const n = String(name).trim() || 'المدير';
    return res.json({ token: sign({ master: true, name: n }), me: { name: n, master: true, perms: ALL } });
  }
  try {
    const { data } = await db().from('dashboard_admins').select('*');
    const a = (data || []).find((x) => x.name.trim().toLowerCase() === String(name).trim().toLowerCase());
    if (a && password && (await bcrypt.compare(String(password), a.password_hash))) {
      const perms = a.permissions || [];
      return res.json({ token: sign({ id: a.id, name: a.name }), me: { name: a.name, perms } });
    }
  } catch (e) { /* fall through */ }
  res.status(401).json({ error: 'الاسم أو الباسورد غلط' });
}
