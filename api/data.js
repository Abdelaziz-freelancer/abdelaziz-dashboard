import { UUID, can, db, fail, guard } from './_utils.js';

const T = {
  results: { perm: 'results', cols: ['category', 'platform', 'title', 'spend', 'sales', 'roas', 'image_url', 'visible'], scope: [] },
  reviews: { perm: 'reviews', cols: ['name', 'business', 'image_url', 'visible'], scope: [] },
  client_logos: { perm: 'reviews', cols: ['name', 'image_url', 'visible'], scope: [] },
  ticker_items: { perm: 'ticker', cols: ['image_url', 'visible'], scope: ['lane'] },
  brief_sections: { perm: 'questions', cols: ['title', 'description'], scope: [] },
  brief_questions: { perm: 'questions', cols: ['type', 'label', 'hint', 'placeholder', 'options', 'required', 'width', 'variant'], scope: ['section_id'] }
};
const CONTENT = { settings: 'site', hero: 'site', why: 'site', brief_intro: 'site', results_head: 'results', reviews_head: 'reviews', ticker_head: 'ticker', contact: 'contact' };
const TYPES = ['text', 'area', 'number', 'email', 'url', 'tel', 'radio', 'checkbox', 'multitext', 'info'];

function clean(table, o) {
  const r = {};
  for (const c of T[table].cols) {
    if (!(c in o)) continue;
    let v = o[c];
    if (c === 'visible' || c === 'required') v = !!v;
    else if (c === 'options') v = (Array.isArray(v) ? v : []).map((x) => String(x).slice(0, 200)).slice(0, 60);
    else {
      v = String(v ?? '').slice(0, 2000);
      if (c === 'type' && !TYPES.includes(v)) v = 'text';
      if (c === 'width' && !['half', 'full'].includes(v)) v = 'half';
      if (c === 'variant' && !['', 'gold', 'blue'].includes(v)) v = '';
      if (c === 'image_url' && v && !/^https:\/\//i.test(v)) v = '';
    }
    r[c] = v;
  }
  return r;
}

export default async function handler(req, res) {
  const me = await guard(req, res);
  if (!me) return;
  const b = req.body || {};
  try {
    const s = db();
    if (b.action === 'stats') {
      const count = async (t, f) => { let q = s.from(t).select('id', { count: 'exact', head: true }); if (f) q = f(q); const { count: n } = await q; return n || 0; };
      const [a, bb, c, d, st] = await Promise.all([
        count('brief_submissions', (q) => q.eq('status', 'new')), count('brief_submissions'), count('results', (q) => q.eq('visible', true)),
        count('brief_questions', (q) => q.neq('type', 'info')), s.from('site_content').select('value').eq('key', 'settings').maybeSingle()
      ]);
      return res.json({ new_responses: a, responses: bb, results: c, questions: d, site_url: (st.data && st.data.value && st.data.value.site_url) || '' });
    }
    if (b.action === 'content_get' || b.action === 'content_set') {
      const perm = CONTENT[b.key];
      if (!perm || !can(me, perm)) return res.status(403).json({ error: 'مفيش عندك صلاحية للقسم ده' });
      if (b.action === 'content_get') {
        const { data, error } = await s.from('site_content').select('value').eq('key', b.key).maybeSingle();
        if (error) throw error;
        return res.json({ value: data ? data.value : null });
      }
      if (!b.value || typeof b.value !== 'object' || JSON.stringify(b.value).length > 100000) return res.status(400).json({ error: 'بيانات غير صالحة' });
      const { error } = await s.from('site_content').upsert({ key: b.key, value: b.value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      if (error) throw error;
      return res.json({ ok: true });
    }
    const t = T[b.table];
    if (!t) return res.status(400).json({ error: 'جدول غير معروف' });
    if (!can(me, t.perm)) return res.status(403).json({ error: 'مفيش عندك صلاحية للقسم ده' });

    if (b.action === 'list') {
      let q = s.from(b.table).select('*');
      if (b.table === 'ticker_items') q = q.order('lane').order('position'); else q = q.order('position');
      const { data, error } = await q;
      if (error) throw error;
      return res.json({ rows: data });
    }
    if (b.action === 'add') {
      const scope = {};
      for (const k of t.scope) {
        const v = b.scope && b.scope[k];
        if (k === 'section_id' && !UUID.test(v || '')) return res.status(400).json({ error: 'قسم غير صالح' });
        if (k === 'lane' && ![1, 2].includes(Number(v))) return res.status(400).json({ error: 'شريط غير صالح' });
        scope[k] = k === 'lane' ? Number(v) : v;
      }
      let q = s.from(b.table).select('position').order('position', { ascending: false }).limit(1);
      for (const k of Object.keys(scope)) q = q.eq(k, scope[k]);
      const { data: top } = await q;
      const { data, error } = await s.from(b.table).insert({ ...clean(b.table, b.row || {}), ...scope, position: ((top && top[0] && top[0].position) || 0) + 1 }).select().single();
      if (error) throw error;
      return res.json({ row: data });
    }
    if (!UUID.test(b.id || '')) return res.status(400).json({ error: 'معرّف غير صالح' });
    if (b.action === 'update') {
      const patch = clean(b.table, b.patch || {});
      if (!Object.keys(patch).length) return res.status(400).json({ error: 'مفيش تعديل' });
      const { error } = await s.from(b.table).update(patch).eq('id', b.id);
      if (error) throw error;
      return res.json({ ok: true });
    }
    if (b.action === 'delete') {
      const { error } = await s.from(b.table).delete().eq('id', b.id);
      if (error) throw error;
      return res.json({ ok: true });
    }
    if (b.action === 'move') {
      const { data: cur, error: e1 } = await s.from(b.table).select('*').eq('id', b.id).single();
      if (e1) throw e1;
      const up = Number(b.dir) < 0;
      let q = s.from(b.table).select('id,position');
      for (const k of t.scope) q = q.eq(k, cur[k]);
      q = up ? q.lt('position', cur.position).order('position', { ascending: false }) : q.gt('position', cur.position).order('position', { ascending: true });
      const { data: nb } = await q.limit(1);
      if (nb && nb[0]) {
        await s.from(b.table).update({ position: nb[0].position }).eq('id', cur.id);
        await s.from(b.table).update({ position: cur.position }).eq('id', nb[0].id);
      }
      return res.json({ ok: true });
    }
    res.status(400).json({ error: 'أمر غير معروف' });
  } catch (e) { fail(res, e); }
}
