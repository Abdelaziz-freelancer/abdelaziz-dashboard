import bcrypt from 'bcryptjs';
import { ALL, UUID, db, fail, guard } from './_utils.js';

export default async function handler(req, res) {
  const me = await guard(req, res, 'admins');
  if (!me) return;
  const b = req.body || {};
  const perms = (a) => (Array.isArray(a) ? a : []).filter((x) => ALL.includes(x) && (me.master || x !== 'admins'));
  try {
    const s = db();
    if (b.action === 'list') {
      const { data, error } = await s.from('dashboard_admins').select('id,name,permissions,created_at').order('created_at');
      if (error) throw error;
      return res.json({ rows: data });
    }
    if (b.action === 'add') {
      const name = String(b.name || '').trim(), pw = String(b.password || '');
      if (name.length < 2 || name.length > 60) return res.status(400).json({ error: 'الاسم لازم يكون من حرفين لـ 60 حرف' });
      if (pw.length < 6) return res.status(400).json({ error: 'الباسورد لازم يكون 6 حروف على الأقل' });
      const { error } = await s.from('dashboard_admins').insert({ name, password_hash: await bcrypt.hash(pw, 10), permissions: perms(b.permissions) });
      if (error) return error.code === '23505' ? res.status(400).json({ error: 'الاسم ده موجود قبل كده' }) : fail(res, error);
      return res.json({ ok: true });
    }
    if (!UUID.test(b.id || '')) return res.status(400).json({ error: 'معرّف غير صالح' });
    if (b.action === 'perms') {
      const { error } = await s.from('dashboard_admins').update({ permissions: perms(b.permissions) }).eq('id', b.id);
      if (error) throw error;
      return res.json({ ok: true });
    }
    if (b.action === 'reset') {
      const pw = String(b.password || '');
      if (pw.length < 6) return res.status(400).json({ error: 'الباسورد لازم يكون 6 حروف على الأقل' });
      const { error } = await s.from('dashboard_admins').update({ password_hash: await bcrypt.hash(pw, 10) }).eq('id', b.id);
      if (error) throw error;
      return res.json({ ok: true });
    }
    if (b.action === 'delete') {
      const { error } = await s.from('dashboard_admins').delete().eq('id', b.id);
      if (error) throw error;
      return res.json({ ok: true });
    }
    res.status(400).json({ error: 'أمر غير معروف' });
  } catch (e) { fail(res, e); }
}
