import { UUID, db, fail, guard } from './_utils.js';

export default async function handler(req, res) {
  const me = await guard(req, res, 'responses');
  if (!me) return;
  const b = req.body || {};
  try {
    const s = db();
    if (b.action === 'list') {
      const { data, error } = await s.from('brief_submissions').select('id,client_name,brand_name,status,created_at').order('created_at', { ascending: false }).limit(300);
      if (error) throw error;
      return res.json({ rows: data });
    }
    if (!UUID.test(b.id || '')) return res.status(400).json({ error: 'معرّف غير صالح' });
    if (b.action === 'get') {
      const { data, error } = await s.from('brief_submissions').select('*').eq('id', b.id).single();
      if (error) throw error;
      return res.json({ row: data });
    }
    if (b.action === 'status') {
      if (!['new', 'review', 'done'].includes(b.status)) return res.status(400).json({ error: 'حالة غير صالحة' });
      const { error } = await s.from('brief_submissions').update({ status: b.status, read_at: new Date().toISOString() }).eq('id', b.id);
      if (error) throw error;
      return res.json({ ok: true });
    }
    if (b.action === 'delete') {
      const { error } = await s.from('brief_submissions').delete().eq('id', b.id);
      if (error) throw error;
      return res.json({ ok: true });
    }
    res.status(400).json({ error: 'أمر غير معروف' });
  } catch (e) { fail(res, e); }
}
