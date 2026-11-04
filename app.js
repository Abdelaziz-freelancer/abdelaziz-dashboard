(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  function E(t, a) {
    var e = document.createElement(t); a = a || {};
    for (var k in a) { var v = a[k]; if (k === 'class') e.className = v; else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v); else if (v === true) e.setAttribute(k, ''); else if (v !== false && v != null) e.setAttribute(k, v); }
    Array.prototype.slice.call(arguments, 2).flat(9).forEach(function (x) { if (x == null || x === false) return; e.append(x.nodeType ? x : document.createTextNode(x)); });
    return e;
  }
  var S = { tok: sessionStorage.getItem('tok'), me: JSON.parse(sessionStorage.getItem('me') || 'null'), tab: null, site: '' };
  var DEF = {}, app = $('#app'), tt;
  function toast(m, bad) { var t = $('#toast'); t.textContent = m; t.className = 'toast show' + (bad ? ' bad' : ''); clearTimeout(tt); tt = setTimeout(function () { t.className = 'toast'; }, 3400); }
  function logout() { sessionStorage.clear(); S.tok = null; S.me = null; loginView(); }
  async function api(path, body) {
    var r = await fetch('/api/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + S.tok }, body: JSON.stringify(body || {}) });
    var j = await r.json().catch(function () { return {}; });
    if (r.status === 401) { logout(); throw new Error('الجلسة انتهت، سجّل دخول تاني'); }
    if (!r.ok) throw new Error(j.error || 'حصلت مشكلة');
    return j;
  }
  async function run(fn, okMsg) { try { var r = await fn(); if (okMsg) toast(okMsg); return r === undefined ? true : r; } catch (e) { toast(e.message, true); return null; } }
  var can = function (p) { return S.me && (S.me.master || (S.me.perms || []).indexOf(p) > -1); };

  /* ---------- images ---------- */
  function readFile(f) { return new Promise(function (ok, no) { var r = new FileReader(); r.onload = function () { ok(r.result); }; r.onerror = no; r.readAsDataURL(f); }); }
  function shrink(file, max) {
    max = max || 1600;
    if (/png|webp|gif/.test(file.type) && file.size < 1.2e6) return readFile(file);
    return new Promise(function (ok, no) {
      var im = new Image(), u = URL.createObjectURL(file);
      im.onload = function () { var k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u); ok(c.toDataURL('image/jpeg', 0.86)); };
      im.onerror = function () { no(new Error('الملف ده مش صورة صالحة')); }; im.src = u;
    });
  }
  async function uploadFile(file, folder) { var dataUrl = await shrink(file); var r = await api('upload', { folder: folder, filename: file.name, dataUrl: dataUrl }); return r.url; }

  /* ---------- generic form controls ---------- */
  function imageCtl(url, folder) {
    var cur = url || '', box = E('div', { class: 'imgbox' });
    var draw = function () { box.replaceChildren(cur ? E('img', { src: cur, alt: '' }) : 'لسه مفيش صورة'); }; draw();
    var inp = E('input', { type: 'file', accept: 'image/*', hidden: true, onchange: async function () {
      var f = inp.files[0]; if (!f) return;
      var u = await run(function () { return uploadFile(f, folder); }, 'اترفعت الصورة. دوس «حفظ» عشان تتثبت');
      if (u) { cur = u; draw(); } inp.value = '';
    } });
    return { el: E('div', {}, box, E('div', { class: 'rowx' }, E('button', { class: 'bt mini', type: 'button', onclick: function () { inp.click(); } }, 'رفع / تغيير صورة'), E('button', { class: 'bt mini', type: 'button', onclick: function () { cur = ''; draw(); } }, 'مسح'), inp)), get: function () { return cur; } };
  }
  function listCtl(f, items) {
    var wrap = E('div', { class: 'sub-list' }), rows = [];
    function add(it) {
      var parts = f.item.map(function (x) { return { x: x, c: ctl(x, it[x.k]) }; });
      var r = { get: function () { var o = {}; parts.forEach(function (p) { o[p.x.k] = p.c.get(); }); return o; } };
      var row = E('div', { class: 'ls2' }, parts.map(function (p) { return E('label', { class: 'fld' }, E('span', {}, p.x.l), p.c.el); }),
        f.fixed ? null : E('button', { class: 'bt mini', type: 'button', onclick: function () { rows.splice(rows.indexOf(r), 1); row.remove(); } }, 'حذف'));
      rows.push(r); wrap.append(row);
    }
    (items || []).forEach(add);
    return { el: E('div', {}, wrap, f.fixed ? null : E('button', { class: 'bt mini', type: 'button', onclick: function () { add({}); } }, '+ إضافة')), get: function () { return rows.map(function (r) { return r.get(); }); } };
  }
  function ctl(f, v) {
    var t = f.t || 'text', x;
    if (t === 'area') { x = E('textarea', { class: 'in', rows: f.rows || 3 }); x.value = v == null ? '' : v; return { el: x, get: function () { return x.value.trim(); } }; }
    if (t === 'bool') { x = E('input', { type: 'checkbox' }); x.checked = !!v; return { el: E('label', { class: 'chk' }, x, f.l2 || 'تفعيل'), get: function () { return x.checked; } }; }
    if (t === 'num') { x = E('input', { class: 'in', type: 'number' }); x.value = v == null ? '' : v; return { el: x, get: function () { return Number(x.value) || 0; } }; }
    if (t === 'select') { x = E('select', { class: 'in' }, f.opts.map(function (o) { return E('option', { value: o[0] }, o[1]); })); x.value = v == null ? f.opts[0][0] : v; return { el: x, get: function () { return x.value; } }; }
    if (t === 'image') return imageCtl(v, f.folder);
    if (t === 'list') return listCtl(f, v);
    x = E('input', { class: 'in', type: 'text' }); x.value = v == null ? '' : v; return { el: x, get: function () { return x.value.trim(); } };
  }
  function formFor(fields, val) {
    val = val || {};
    var parts = fields.map(function (f) { return { f: f, c: ctl(f, val[f.k]) }; });
    var el = E('div', { class: 'g2c' }, parts.map(function (p) {
      var wide = p.f.full || ['area', 'list', 'image'].indexOf(p.f.t) > -1, tag = ['list', 'image', 'bool'].indexOf(p.f.t) > -1 ? 'div' : 'label';
      return E(tag, { class: 'fld' + (wide ? ' full' : '') }, p.f.l ? E('span', {}, p.f.l) : null, p.c.el);
    }));
    return { el: el, get: function () { var o = {}; parts.forEach(function (p) { o[p.f.k] = p.c.get(); }); return o; } };
  }

  /* ---------- schemas ---------- */
  var HEAD = function (extra) { return [{ k: 'k', l: 'العنوان الصغير' }, { k: 'h2', l: 'العنوان الكبير' }, { k: 'sub', l: 'الوصف', t: 'area', rows: 2 }].concat(extra || []); };
  var PAIR = [{ k: 't', l: 'العنوان' }, { k: 'd', l: 'الوصف' }];
  var TYPES = { text: 'نص قصير', area: 'نص طويل', number: 'رقم', email: 'إيميل', url: 'رابط', tel: 'تليفون', radio: 'اختيار واحد', checkbox: 'اختيارات متعددة', multitext: 'قائمة نصوص', info: 'صندوق معلومة' };
  var QF = [
    { k: 'type', l: 'نوع السؤال', t: 'select', opts: Object.keys(TYPES).map(function (k) { return [k, TYPES[k]]; }) },
    { k: 'width', l: 'العرض', t: 'select', opts: [['half', 'نص الصف'], ['full', 'الصف كله']] },
    { k: 'label', l: 'نص السؤال (أو عنوان الصندوق)', full: 1 },
    { k: 'hint', l: 'تلميح / نص إضافي', full: 1 },
    { k: 'placeholder', l: 'النص الخافت داخل الحقل' },
    { k: 'variant', l: 'لون الصندوق (للمعلومة)', t: 'select', opts: [['', 'وردي'], ['gold', 'دهبي'], ['blue', 'أزرق']] },
    { k: 'options', l: 'الاختيارات (كل اختيار في سطر)', t: 'area', rows: 4 },
    { k: 'required', l: '', t: 'bool', l2: 'إجباري' }
  ];
  var COLL = {
    results: { table: 'results', title: 'النتايج', def: { title: 'نتيجة جديدة', visible: true }, fields: [{ k: 'category', l: 'المجال (مثال: ملابس)' }, { k: 'platform', l: 'المنصة' }, { k: 'title', l: 'العنوان', full: 1 }, { k: 'spend', l: 'الإنفاق' }, { k: 'sales', l: 'المبيعات' }, { k: 'roas', l: 'ROAS' }, { k: 'image_url', l: 'سكرين النتيجة', t: 'image', folder: 'results' }, { k: 'visible', l: '', t: 'bool', l2: 'ظاهر في الموقع' }] },
    reviews: { table: 'reviews', title: 'آراء العملاء (سكرينات)', def: { name: 'عميل جديد', visible: true }, fields: [{ k: 'name', l: 'الاسم' }, { k: 'business', l: 'النشاط' }, { k: 'image_url', l: 'سكرين الرأي', t: 'image', folder: 'reviews' }, { k: 'visible', l: '', t: 'bool', l2: 'ظاهر في الموقع' }] },
    client_logos: { table: 'client_logos', title: 'لوجوهات العملاء', def: { name: 'عميل جديد', visible: true }, fields: [{ k: 'name', l: 'اسم العميل' }, { k: 'image_url', l: 'اللوجو / الصورة', t: 'image', folder: 'logos' }, { k: 'visible', l: '', t: 'bool', l2: 'ظاهر في الموقع' }] }
  };
  var TABS = [
    { g: 'محتوى الموقع' },
    { id: 'hero', t: 'الصورة والنبذة', p: 'site', blocks: [{ key: 'hero', title: 'أول الصفحة', fields: [{ k: 'eyebrow', l: 'السطر الصغير' }, { k: 'lead', l: 'النبذة عنك', t: 'area' }, { k: 'h1a', l: 'العنوان: الجزء الأول' }, { k: 'h1b', l: 'الكلمة المميزة (دهبي)' }, { k: 'h1c', l: 'العنوان: الجزء الأخير' }, { k: 'btn1', l: 'نص زرار البريف' }, { k: 'btn2', l: 'نص زرار النتايج' }, { k: 'photo', l: 'صورتك', t: 'image', folder: 'hero' }, { k: 'stats', l: 'الأرقام تحت النبذة', t: 'list', fixed: 1, item: [{ k: 'v', l: 'الرقم' }, { k: 'l', l: 'الوصف' }] }] }] },
    { id: 'results', t: 'نتايج الحملات', p: 'results', blocks: [{ key: 'results_head', title: 'عناوين القسم', fields: HEAD([{ k: 'all', l: 'اسم تبويب «الكل»' }]) }], colls: ['results'] },
    { id: 'why', t: 'النصايح والخدمات', p: 'site', blocks: [{ key: 'why', title: 'ليه تشتغل معايا', fields: HEAD([{ k: 'reasons_title', l: 'عنوان الأسباب' }, { k: 'reasons', l: 'الأسباب', t: 'list', item: PAIR }, { k: 'deliver_title', l: 'عنوان اللي هتقدمه' }, { k: 'deliverables', l: 'اللي هتقدمه', t: 'list', item: PAIR }]) }] },
    { id: 'reviews', t: 'آراء وصور العملاء', p: 'reviews', blocks: [{ key: 'reviews_head', title: 'عناوين القسم', fields: HEAD() }], colls: ['reviews', 'client_logos'] },
    { id: 'ticker', t: 'الشريطين المتحركين', p: 'ticker', blocks: [{ key: 'ticker_head', title: 'العناوين والسرعة', fields: [{ k: 'k', l: 'العنوان الصغير' }, { k: 'h2', l: 'العنوان الكبير' }, { k: 'speed', l: 'سرعة الحركة (ثواني للدورة، أقل = أسرع)', t: 'num' }] }], custom: 'ticker' },
    { id: 'contact', t: 'روابط التواصل', p: 'contact', blocks: [{ key: 'contact', title: 'التواصل', fields: HEAD([{ k: 'whatsapp', l: 'رقم واتساب (مثال: 01012345678)' }, { k: 'facebook', l: 'رابط فيسبوك' }, { k: 'instagram', l: 'رابط إنستجرام' }, { k: 'tiktok', l: 'رابط تيك توك' }, { k: 'linkedin', l: 'رابط لينكدإن' }, { k: 'email', l: 'الإيميل' }]) }] },
    { id: 'bintro', t: 'شرح البريف', p: 'site', blocks: [{ key: 'brief_intro', title: 'قسم «إيه هو البريف؟»', fields: [{ k: 'k', l: 'العنوان الصغير' }, { k: 'h2', l: 'العنوان الكبير' }, { k: 'text', l: 'الشرح', t: 'area' }, { k: 'btn', l: 'نص الزرار' }, { k: 'steps', l: 'الخطوات', t: 'list', fixed: 1, item: PAIR }] }] },
    { id: 'settings', t: 'إعدادات الموقع', p: 'site', blocks: [{ key: 'settings', title: 'إعدادات عامة', fields: [{ k: 'site_name', l: 'اسم الموقع' }, { k: 'site_url', l: 'رابط موقعك (لزرار المعاينة)' }, { k: 'seo_title', l: 'عنوان جوجل (SEO)', full: 1 }, { k: 'seo_desc', l: 'وصف جوجل (SEO)', t: 'area', rows: 2 }, { k: 'show_nav_cta', l: '', t: 'bool', l2: 'إظهار زرار «ابدأ البريف» في القايمة' }, { k: 'show_hero_cta', l: '', t: 'bool', l2: 'إظهار زرار البريف في أول الصفحة' }] }] },
    { g: 'البريف' },
    { id: 'questions', t: 'أسئلة البريف', p: 'questions', custom: 'questions' },
    { id: 'responses', t: 'الردود', p: 'responses', custom: 'responses' },
    { g: 'النظام' },
    { id: 'admins', t: 'المشرفين والصلاحيات', p: 'admins', custom: 'admins' }
  ];
  var PERMS = { site: 'نصوص الموقع', contact: 'روابط التواصل', results: 'النتايج', reviews: 'الآراء واللوجوهات', ticker: 'الشريطين', questions: 'أسئلة البريف', responses: 'الردود', admins: 'المشرفين' };

  /* ---------- views ---------- */
  function head(t, btn, body) {
    var prev = E('button', { class: 'bt noprint', onclick: function () { if (S.site) window.open(S.site, '_blank'); else toast('حط رابط موقعك في «إعدادات الموقع» الأول', true); } }, 'معاينة الموقع');
    return E('div', {}, E('div', { class: 'tp' }, E('div', {}, E('h1', {}, t.t)), E('div', { class: 'rw noprint' }, prev, btn)), body);
  }
  async function tabView(t) {
    var root = E('div'), saves = [];
    for (var b of (t.blocks || [])) {
      var r = await api('data', { action: 'content_get', key: b.key });
      var f = formFor(b.fields, r.value || DEF[b.key] || {});
      (function (key, f) { saves.push(function () { return api('data', { action: 'content_set', key: key, value: f.get() }); }); })(b.key, f);
      root.append(E('section', { class: 'cd', style: 'margin-bottom:20px' }, E('h2', { style: 'margin-bottom:12px' }, b.title), f.el));
    }
    for (var c of (t.colls || [])) root.append(await collBlock(COLL[c]));
    if (t.custom) root.append(await CUSTOM[t.custom]());
    var btn = saves.length ? E('button', { class: 'bt pr', onclick: function () { run(async function () { for (var s of saves) await s(); }, 'اتحفظ واتنشر على الموقع'); } }, 'حفظ ونشر') : null;
    return head(t, btn, root);
  }
  async function collBlock(c) {
    var sec = E('section', { class: 'cd', style: 'margin-bottom:20px' }), grid = E('div', { class: 'gr' });
    async function load() {
      var d = await api('data', { action: 'list', table: c.table }), rows = d.rows;
      grid.replaceChildren.apply(grid, rows.map(function (row, i) { return card(row, i, rows.length); }).concat([E('button', { class: 'up', onclick: async function () { await run(function () { return api('data', { action: 'add', table: c.table, row: c.def || {} }); }); load(); } }, '+ إضافة')]));
    }
    function card(row, i, n) {
      var f = formFor(c.fields, row);
      var mv = function (d) { return async function () { await run(function () { return api('data', { action: 'move', table: c.table, id: row.id, dir: d }); }); load(); }; };
      return E('div', { class: 'cd item' }, f.el, E('div', { class: 'rowx' },
        E('button', { class: 'bt mini pr', onclick: function () { run(function () { return api('data', { action: 'update', table: c.table, id: row.id, patch: f.get() }); }, 'اتحفظ'); } }, 'حفظ'),
        E('button', { class: 'bt mini', disabled: i === 0, 'aria-label': 'فوق', onclick: mv(-1) }, '↑'),
        E('button', { class: 'bt mini', disabled: i === n - 1, 'aria-label': 'تحت', onclick: mv(1) }, '↓'),
        E('button', { class: 'bt mini', onclick: async function () { if (!confirm('تمسح العنصر ده؟')) return; await run(function () { return api('data', { action: 'delete', table: c.table, id: row.id }); }, 'اتمسح'); load(); } }, 'حذف')));
    }
    sec.append(E('h2', { style: 'margin-bottom:12px' }, c.title), grid); await load(); return sec;
  }
  var CUSTOM = {};
  CUSTOM.ticker = async function () {
    var wrap = E('div');
    [1, 2].forEach(function (rw) {
      var grid = E('div', { class: 'gr' }), sec = E('section', { class: 'cd', style: 'margin-bottom:20px' }, E('h2', { style: 'margin-bottom:12px' }, rw === 1 ? 'الشريط الأول: بيمشي من اليمين للشمال' : 'الشريط التاني: بيمشي من الشمال لليمين'), grid);
      async function load() {
        var d = await api('data', { action: 'list', table: 'ticker_items' }), rows = d.rows.filter(function (x) { return x.lane === rw; });
        var inp = E('input', { type: 'file', accept: 'image/*', hidden: true, onchange: async function () {
          var f = inp.files[0]; if (!f) return;
          var u = await run(function () { return uploadFile(f, 'ticker'); });
          if (u) await run(function () { return api('data', { action: 'add', table: 'ticker_items', scope: { lane: rw }, row: { image_url: u, visible: true } }); }, 'اتضافت الصورة');
          inp.value = ''; load();
        } });
        var mv = function (id, dir) { return async function () { await run(function () { return api('data', { action: 'move', table: 'ticker_items', id: id, dir: dir }); }); load(); }; };
        grid.replaceChildren.apply(grid, rows.map(function (x, i) {
          return E('div', { class: 'cd item' }, E('div', { class: 'imgbox' }, x.image_url ? E('img', { src: x.image_url, alt: '' }) : 'بدون صورة'), E('div', { class: 'rowx' },
            E('button', { class: 'bt mini', disabled: i === 0, 'aria-label': 'قبل', onclick: mv(x.id, -1) }, '↑'), E('button', { class: 'bt mini', disabled: i === rows.length - 1, 'aria-label': 'بعد', onclick: mv(x.id, 1) }, '↓'),
            E('button', { class: 'bt mini', onclick: async function () { await run(function () { return api('data', { action: 'delete', table: 'ticker_items', id: x.id }); }, 'اتمسحت'); load(); } }, 'حذف')));
        }).concat([E('button', { class: 'up', onclick: function () { inp.click(); } }, '+ إضافة صورة'), inp]));
      }
      load(); wrap.append(sec);
    });
    return wrap;
  };
  CUSTOM.questions = async function () {
    var root = E('div');
    async function load() {
      var a = await Promise.all([api('data', { action: 'list', table: 'brief_sections' }), api('data', { action: 'list', table: 'brief_questions' })]);
      var secs = a[0].rows, qs = a[1].rows;
      root.replaceChildren.apply(root, secs.map(function (s, i) { return secBox(s, i, secs.length, qs.filter(function (q) { return q.section_id === s.id; })); }).concat([E('button', { class: 'bt pr', onclick: async function () { await run(function () { return api('data', { action: 'add', table: 'brief_sections', row: { title: 'قسم جديد', description: '' } }); }); load(); } }, '+ قسم جديد')]));
    }
    function ctrls(table, row, i, n, patchGet, label) {
      var mv = function (d) { return async function () { await run(function () { return api('data', { action: 'move', table: table, id: row.id, dir: d }); }); load(); }; };
      return E('div', { class: 'rowx' },
        E('button', { class: 'bt mini pr', onclick: function () { run(function () { return api('data', { action: 'update', table: table, id: row.id, patch: patchGet() }); }, 'اتحفظ'); } }, 'حفظ'),
        E('button', { class: 'bt mini', disabled: i === 0, 'aria-label': 'فوق', onclick: mv(-1) }, '↑'), E('button', { class: 'bt mini', disabled: i === n - 1, 'aria-label': 'تحت', onclick: mv(1) }, '↓'),
        E('button', { class: 'bt mini', onclick: async function () { if (!confirm('تمسح ' + label + '؟')) return; await run(function () { return api('data', { action: 'delete', table: table, id: row.id }); }, 'اتمسح'); load(); } }, 'حذف'));
    }
    function secBox(s, i, n, qs) {
      var f = formFor([{ k: 'title', l: 'اسم القسم', full: 1 }, { k: 'description', l: 'وصف القسم', full: 1 }], s);
      return E('section', { class: 'secbox' }, E('h2', { style: 'margin-bottom:10px' }, 'القسم ' + (i + 1)), f.el, ctrls('brief_sections', s, i, n, f.get, 'القسم وكل أسئلته'),
        E('div', { style: 'margin-top:14px' }, qs.map(function (q, k) { return qCard(q, k, qs.length); })),
        E('button', { class: 'bt', style: 'margin-top:6px', onclick: async function () { await run(function () { return api('data', { action: 'add', table: 'brief_questions', scope: { section_id: s.id }, row: { type: 'text', label: 'سؤال جديد', width: 'half' } }); }); load(); } }, '+ سؤال جديد'));
    }
    function qCard(q, k, n) {
      var f = formFor(QF, Object.assign({}, q, { options: (q.options || []).join('\n') }));
      var get = function () { var p = f.get(); p.options = p.options.split('\n').map(function (x) { return x.trim(); }).filter(Boolean); return p; };
      return E('details', { class: 'qcard' }, E('summary', {}, E('span', { class: 'pl' }, TYPES[q.type] || q.type), E('span', {}, q.label || '(بدون عنوان)'), q.required ? E('span', { class: 'bad', style: 'margin:0' }, '*') : null), E('div', { class: 'bd' }, f.el, ctrls('brief_questions', q, k, n, get, 'السؤال ده')));
    }
    await load(); return root;
  };
  var STATUS = { new: ['جديد', ''], review: ['قيد المراجعة', 'background:var(--c)'], done: ['تم', 'background:var(--b)'] };
  var pill = function (s) { var v = STATUS[s] || STATUS.new; return E('span', { class: 'pl', style: v[1] }, v[0]); };
  var fmt = function (d) { try { return new Date(d).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return d; } };
  CUSTOM.responses = async function () {
    var box = E('div');
    async function list() {
      var d = await api('submissions', { action: 'list' }), rows = d.rows;
      if (!rows.length) { box.replaceChildren(E('div', { class: 'cd' }, 'لسه مفيش بريفات وصلت.')); return; }
      box.replaceChildren(E('div', { class: 'sc' }, E('table', {}, E('tr', {}, ['العميل', 'البراند', 'التاريخ', 'الحالة', ''].map(function (h) { return E('th', {}, h); })),
        rows.map(function (r) { return E('tr', {}, E('td', {}, r.client_name || '—'), E('td', {}, r.brand_name || '—'), E('td', {}, fmt(r.created_at)), E('td', {}, pill(r.status)), E('td', {}, E('button', { class: 'bt mini', onclick: function () { open(r.id); } }, 'فتح'))); }))));
    }
    async function open(id) {
      var d = await api('submissions', { action: 'get', id: id }), r = d.row;
      if (r.status === 'new') api('submissions', { action: 'status', id: id, status: 'review' }).catch(function () {});
      var sel = E('select', { class: 'in', style: 'width:auto;margin:0', onchange: function () { run(function () { return api('submissions', { action: 'status', id: id, status: sel.value }); }, 'اتحدثت الحالة'); } }, Object.keys(STATUS).map(function (k) { return E('option', { value: k }, STATUS[k][0]); }));
      sel.value = r.status === 'new' ? 'review' : r.status;
      var groups = [], by = {};
      (r.answers || []).forEach(function (a) { if (!by[a.s]) { by[a.s] = []; groups.push(a.s); } by[a.s].push(a); });
      box.replaceChildren(E('div', { class: 'hd2 noprint' }, E('button', { class: 'bt', onclick: list }, '← رجوع'), E('div', { class: 'rw' }, sel, E('button', { class: 'bt', onclick: function () { window.print(); } }, 'طباعة / PDF'), E('button', { class: 'bt', onclick: async function () { if (!confirm('تمسح البريف ده نهائياً؟')) return; await run(function () { return api('submissions', { action: 'delete', id: id }); }, 'اتمسح'); list(); } }, 'حذف'))),
        E('section', { class: 'cd' }, E('h2', { style: 'margin-bottom:4px' }, (r.client_name || '—') + ' — ' + (r.brand_name || '—')), E('p', { class: 'sm' }, fmt(r.created_at)),
          groups.map(function (g) { return E('div', { style: 'margin-top:18px' }, E('h2', { style: 'font-size:16px;color:#be123c' }, g), by[g].map(function (a) { return E('div', { class: 'kv' }, E('b', {}, a.q), E('span', {}, [].concat(a.v).join('، '))); })); })));
    }
    await list(); return box;
  };
  CUSTOM.admins = async function () {
    var box = E('div');
    function permBox(cur) { var cbs = Object.keys(PERMS).map(function (k) { var c = E('input', { type: 'checkbox', value: k }); c.checked = cur.indexOf(k) > -1; return c; }); return { el: E('div', { class: 'perms' }, cbs.map(function (c) { return E('label', { class: 'chk' }, c, PERMS[c.value]); })), get: function () { return cbs.filter(function (c) { return c.checked; }).map(function (c) { return c.value; }); } }; }
    async function load() {
      var d = await api('admins', { action: 'list' });
      var nm = E('input', { class: 'in', placeholder: 'اسم المشرف' }), pw = E('input', { class: 'in', type: 'text', placeholder: 'باسورد (6 حروف على الأقل)' }), np = permBox([]);
      var addForm = E('section', { class: 'secbox' }, E('h2', { style: 'margin-bottom:10px' }, 'إضافة مشرف'), E('div', { class: 'g2c' }, E('label', { class: 'fld' }, E('span', {}, 'الاسم'), nm), E('label', { class: 'fld' }, E('span', {}, 'الباسورد'), pw)), E('span', { class: 'sm' }, 'الصلاحيات'), np.el,
        E('button', { class: 'bt pr', onclick: async function () { var ok = await run(function () { return api('admins', { action: 'add', name: nm.value, password: pw.value, permissions: np.get() }); }, 'اتضاف المشرف'); if (ok) load(); } }, 'إضافة'));
      box.replaceChildren.apply(box, [E('div', { class: 'cd', style: 'margin-bottom:16px' }, E('b', {}, 'المدير الرئيسي'), ' — بيدخل بالباسورد اللي حاطه في Vercel (ADMIN_PASSWORD) وعنده كل الصلاحيات.')].concat(d.rows.map(function (a) {
          var pb = permBox(a.permissions || []);
          return E('section', { class: 'secbox' }, E('h2', { style: 'margin-bottom:6px' }, a.name), pb.el, E('div', { class: 'rowx' },
            E('button', { class: 'bt mini pr', onclick: function () { run(function () { return api('admins', { action: 'perms', id: a.id, permissions: pb.get() }); }, 'اتحفظت الصلاحيات'); } }, 'حفظ الصلاحيات'),
            E('button', { class: 'bt mini', onclick: function () { var p = prompt('الباسورد الجديد لـ ' + a.name + ' (6 حروف على الأقل):'); if (p) run(function () { return api('admins', { action: 'reset', id: a.id, password: p }); }, 'اتغير الباسورد'); } }, 'تغيير الباسورد'),
            E('button', { class: 'bt mini', onclick: async function () { if (!confirm('تمسح المشرف ' + a.name + '؟')) return; await run(function () { return api('admins', { action: 'delete', id: a.id }); }, 'اتمسح'); load(); } }, 'حذف')));
        }), [addForm]));
    }
    await load(); return box;
  };

  /* ---------- shell ---------- */
  async function stats(el) {
    try {
      var s = await api('data', { action: 'stats' }); S.site = s.site_url || '';
      el.replaceChildren.apply(el, [['ردود جديدة', s.new_responses, '--b'], ['إجمالي الردود', s.responses, '--a'], ['نتايج ظاهرة', s.results, '--d'], ['أسئلة البريف', s.questions, '--c']].map(function (x) { return E('div', { style: 'background:var(' + x[2] + ')' }, x[0], E('b', {}, x[1])); }));
    } catch (e) {}
  }
  async function go(id) {
    S.tab = id;
    document.querySelectorAll('.ni').forEach(function (n) { n.classList.toggle('on', n.dataset.id === id); });
    var view = $('#view'), t = TABS.find(function (x) { return x.id === id; });
    view.replaceChildren(E('p', { class: 'sm' }, 'بيحمّل...'));
    try { view.replaceChildren(await tabView(t)); } catch (e) { view.replaceChildren(E('p', { class: 'bad' }, e.message)); }
  }
  async function boot() {
    app.className = 'd';
    DEF = await fetch('defaults.json').then(function (r) { return r.json(); }).catch(function () { return {}; });
    var tabs = TABS.filter(function (t, i) { if (!t.g) return can(t.p); var nx = TABS.slice(i + 1).find(function (x) { return x.g || true; }); for (var j = i + 1; j < TABS.length && !TABS[j].g; j++) if (can(TABS[j].p)) return true; return false; });
    var nav = E('nav', {}, tabs.map(function (t) { return t.g ? E('div', { class: 'gt' }, t.g) : E('button', { class: 'ni', 'data-id': t.id, onclick: function () { go(t.id); } }, t.t); }), E('div', { class: 'who' }, 'داخل باسم: ' + S.me.name), E('button', { class: 'ni', onclick: logout }, 'تسجيل الخروج'));
    var sts = E('div', { class: 'sts' });
    app.replaceChildren(E('aside', { class: 'sb' }, E('div', { class: 'bn' }, E('i'), 'لوحة التحكم'), nav), E('main', { class: 'mn' }, sts, E('div', { id: 'view' })));
    stats(sts);
    var first = tabs.find(function (t) { return !t.g; });
    if (first) go(first.id); else $('#view').replaceChildren(E('p', { class: 'bad' }, 'مفيش صلاحيات متاحة للحساب ده.'));
  }
  function loginView() {
    app.className = 'lg2';
    var n = E('input', { class: 'in', placeholder: 'اسم المشرف (للمدير اتركه فاضي)', autocomplete: 'username' }), p = E('input', { class: 'in', type: 'password', placeholder: 'الباسورد', autocomplete: 'current-password', required: true }), err = E('p', { class: 'bad' }), b = E('button', { class: 'bt pr', type: 'submit', style: 'width:100%' }, 'دخول');
    app.replaceChildren(E('form', { class: 'lc', onsubmit: async function (ev) {
      ev.preventDefault(); err.textContent = ''; b.disabled = true;
      try {
        var r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: n.value, password: p.value }) }), j = await r.json().catch(function () { return {}; });
        if (!r.ok) throw new Error(j.error || 'حصلت مشكلة');
        S.tok = j.token; S.me = j.me; sessionStorage.setItem('tok', j.token); sessionStorage.setItem('me', JSON.stringify(j.me)); boot();
      } catch (e) { err.textContent = e.message; }
      b.disabled = false;
    } }, E('h1', {}, 'لوحة التحكم'), E('p', { class: 'sm', style: 'margin:0 0 18px' }, 'سجّل دخول عشان تتحكم في الموقع.'), E('label', { class: 'fld' }, E('span', {}, 'الاسم'), n), E('label', { class: 'fld' }, E('span', {}, 'الباسورد'), p), b, err));
  }
  if (S.tok && S.me) boot(); else loginView();
})();
