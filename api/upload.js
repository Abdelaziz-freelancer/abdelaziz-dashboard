import { can, db, fail, guard } from './_utils.js';

const FOLDERS = { hero: 'site', results: 'results', reviews: 'reviews', logos: 'reviews', ticker: 'ticker' };
const EXT = { png: 'png', jpeg: 'jpg', webp: 'webp', gif: 'gif' };

export default async function handler(req, res) {
  const me = await guard(req, res);
  if (!me) return;
  try {
    const { folder, dataUrl = '' } = req.body || {};
    if (!FOLDERS[folder] || !can(me, FOLDERS[folder])) return res.status(403).json({ error: 'مفيش عندك صلاحية لرفع صور هنا' });
    const m = /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!m) return res.status(400).json({ error: 'نوع الصورة مش مدعوم (JPG / PNG / WEBP / GIF)' });
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 3.3 * 1024 * 1024) return res.status(413).json({ error: 'الصورة كبيرة قوي، صغّرها شوية' });
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${EXT[m[1]]}`;
    const s = db();
    const { error } = await s.storage.from('site-assets').upload(path, buf, { contentType: `image/${m[1]}`, cacheControl: '31536000', upsert: false });
    if (error) throw error;
    res.json({ url: s.storage.from('site-assets').getPublicUrl(path).data.publicUrl });
  } catch (e) { fail(res, e); }
}
