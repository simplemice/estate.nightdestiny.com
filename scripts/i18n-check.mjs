#!/usr/bin/env node
// Verifies the generated multilingual site (run after `npm run build`). Exit code 1 on any hard error.
//   node scripts/i18n-check.mjs [--latin]   (--latin lists Latin words left in Russian visible text, for human review)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LANGS, LANG_META, DEFAULT_LANG } from './i18n.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/settings.json'), 'utf8')).siteUrl.replace(/\/$/, '');
const errors = [];
const err = (f, m) => errors.push(`${f}: ${m}`);

const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!['node_modules', '.git', 'assets', 'img', 'css', 'js', 'fonts', 'content', 'scripts', 'locales', 'docs', 'Source', 'data'].includes(e.name) || dir !== ROOT) walk(p, out); }
    else if (e.name.endsWith('.html')) out.push(path.relative(ROOT, p));
  }
  return out;
};
const all = walk(ROOT);
const langOf = (f) => (f.startsWith('ru/') ? 'ru' : 'en');
const neutral = (f) => f.replace(/^ru\//, '');
const en = new Set(all.filter((f) => langOf(f) === 'en').map(neutral));
const ru = new Set(all.filter((f) => langOf(f) === 'ru').map(neutral));
for (const f of en) if (!ru.has(f)) err(f, 'no Russian counterpart');
const RU_ONLY = (f) => /^guides\//.test(f); // language-specific articles
for (const f of ru) if (!en.has(f) && !RU_ONLY(f)) err('ru/' + f, 'no English counterpart');

const urlToFile = (u) => { const p = u.replace(SITE, '').split('#')[0].split('?')[0]; const rel = p.endsWith('/') ? p + 'index.html' : p; return rel.replace(/^\//, ''); };
const attr = (tag, name) => (tag.match(new RegExp(`${name}="([^"]*)"`)) || [])[1];
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const visible = (html) => html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<head[\s\S]*?<\/head>/, ' ').replace(/<[^>]+>/g, ' ');
const latinReport = new Map();

let linkCount = 0;
for (const f of all) {
  const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const lang = langOf(f);
  const meta = LANG_META[lang];
  const isError = /(^|\/)(404|5xx)\.html$/.test(f);
  if (!html.includes(`<html lang="${meta.htmlLang}">`)) err(f, `wrong <html lang> (expected ${meta.htmlLang})`);

  const canon = (html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
  const expectedUrl = SITE + '/' + (f.endsWith('index.html') ? f.slice(0, -'index.html'.length) : f);
  if (!canon) err(f, 'missing canonical');
  else if (canon !== expectedUrl) err(f, `canonical ${canon} != ${expectedUrl}`);
  const ogUrl = (html.match(/<meta property="og:url" content="([^"]+)"/) || [])[1];
  if (ogUrl !== canon) err(f, 'og:url differs from canonical');
  if (!html.includes(`<meta property="og:locale" content="${meta.ogLocale}">`)) err(f, 'wrong og:locale');

  const alts = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)].map((m) => [m[1], m[2]]);
  const robotsMeta = (html.match(/<meta name="robots" content="([^"]*)"/) || [])[1] || '';
  const single = RU_ONLY(neutral(f)) || (/noindex/.test(robotsMeta) && !isError) || (lang === 'en' && alts.length === 0 && !isError);
  if (/<title>[^<]{71,}<\/title>/.test(html)) err(f, 'title longer than 70 characters');
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) { try { JSON.parse(m[1]); } catch (e) { err(f, 'invalid JSON-LD: ' + e.message); } }
  if (isError) { if (alts.length) err(f, 'error pages must not declare hreflang'); }
  else if (single) { if (alts.length) err(f, 'single-language/draft page must not declare hreflang'); }
  else {
    const want = [...LANGS.map((l) => LANG_META[l].hreflang), 'x-default'];
    if (alts.map((a) => a[0]).join() !== want.join()) err(f, `hreflang set ${alts.map((a) => a[0])} != ${want}`);
    const here = neutral(f);
    for (const [h, u] of alts) {
      const l = h === 'x-default' ? DEFAULT_LANG : LANGS.find((x) => LANG_META[x].hreflang === h);
      const target = (LANG_META[l].prefix ? LANG_META[l].prefix.slice(1) + '/' : '') + here;
      if (u !== SITE + '/' + (target.endsWith('index.html') ? target.slice(0, -10) : target)) err(f, `hreflang ${h} -> ${u} is not the equivalent page`);
      if (!exists(urlToFile(u))) err(f, `hreflang ${h} target missing: ${u}`);
    }
    // the title/description must be independent per language (not identical copies)
    if (lang === 'ru' && !single) {
      const enHtml = fs.readFileSync(path.join(ROOT, here), 'utf8');
      const t = (h) => (h.match(/<title>([^<]*)<\/title>/) || [])[1];
      const d = (h) => (h.match(/<meta name="description" content="([^"]*)"/) || [])[1];
      if (t(html) === t(enHtml) && !/^(wynn|fizz)/.test(here)) err(f, 'Russian <title> identical to English');
      if (d(html) === d(enHtml)) err(f, 'Russian meta description identical to English');
      if (!/[А-Яа-я]/.test(t(html) || '')) err(f, 'Russian <title> has no Cyrillic');
      if (!/[А-Яа-я]/.test(d(html) || '')) err(f, 'Russian meta description has no Cyrillic');
    }
  }

  // switcher present, exactly one active link, targets exist
  const sw = [...html.matchAll(/<nav class="lang-switch [^"]*"[^>]*>([\s\S]*?)<\/nav>/g)];
  if (sw.length !== 3) err(f, `expected 3 language switchers, found ${sw.length}`);
  sw.forEach((m) => { const links = [...m[1].matchAll(/<a href="([^"]+)"([^>]*)>/g)]; if (links.length !== LANGS.length) err(f, 'switcher link count'); if (links.filter((l) => /is-active/.test(l[2])).length !== 1) err(f, 'switcher must mark exactly one active language'); links.forEach((l) => { if (!exists(urlToFile(l[1]))) err(f, `switcher target missing: ${l[1]}`); }); });

  // internal links: must exist, and Russian pages must stay inside /ru/
  const body = html.slice(html.indexOf('<body'));
  const bodyNoSwitch = body.replace(/<nav class="lang-switch[\s\S]*?<\/nav>/g, '');
  for (const m of bodyNoSwitch.matchAll(/<a\b[^>]*\shref="([^"#]*)(#[^"]*)?"/g)) {
    const h = m[1];
    if (!h || /^(https?:|mailto:|tel:|javascript:)/.test(h)) continue;
    linkCount++;
    if (!h.startsWith('/')) { err(f, `relative link ${h}`); continue; }
    const p = h.split('?')[0];
    const rel = p.endsWith('/') ? p + 'index.html' : p.replace(/^\//, '');
    const file = p.endsWith('/') ? rel.replace(/^\//, '') : rel;
    if (!exists(file)) err(f, `broken internal link ${h}`);
    if (lang === 'ru' && !isError && /\.(css|js|jpg|jpeg|png|webp|svg|ico)$/i.test(p) === false && !p.startsWith('/ru/')) err(f, `Russian page links to non-Russian URL ${h}`);
    if (lang === 'en' && p.startsWith('/ru/')) err(f, `English page links to Russian URL ${h}`);
  }

  if (lang === 'ru') {
    const text = visible(html);
    for (const w of text.match(/[A-Za-z][A-Za-z'’-]{3,}/g) || []) latinReport.set(w, (latinReport.get(w) || 0) + 1);
  }
}

// sitemap
const sm = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
const locs = [...sm.matchAll(/<url><loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const dup = locs.filter((u, i) => locs.indexOf(u) !== i);
if (dup.length) err('sitemap.xml', `duplicate <loc>: ${dup.slice(0, 3)}`);
locs.forEach((u) => { if (!exists(urlToFile(u))) err('sitemap.xml', `URL has no file: ${u}`); });
const indexable = all.filter((f) => !/(^|\/)(404|5xx)\.html$/.test(f) && !/noindex/.test(fs.readFileSync(path.join(ROOT, f), 'utf8').match(/<meta name="robots" content="([^"]*)"/)?.[1] || ''));
indexable.forEach((f) => { const u = SITE + '/' + (f.endsWith('index.html') ? f.slice(0, -10) : f); if (!locs.includes(u)) err('sitemap.xml', `indexable page missing from sitemap: ${u}`); });
for (const m of sm.matchAll(/<url><loc>([^<]+)<\/loc>[\s\S]*?<\/url>/g)) {
  const h = [...m[0].matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)];
  if (h.length === 0) continue; // single-language URL (e.g. guide, or a translation awaiting review): no alternates by design
  if (h.length !== LANGS.length + 1) err('sitemap.xml', `${m[1]}: expected ${LANGS.length + 1} xhtml alternates, found ${h.length}`);
  if (!h.some(([, , u]) => u === m[1])) err('sitemap.xml', `${m[1]}: not listed among its own alternates`);
}
const robots = fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8');
if (/Disallow:\s*\/ru\/?\s*$/m.test(robots)) err('robots.txt', 'blocks /ru/');
if (!/^Allow:\s*\/\s*$/m.test(robots)) err('robots.txt', 'does not allow /');

console.log(`${all.length} pages (${en.size} EN, ${ru.size} RU), ${locs.length} sitemap URLs, ${linkCount} internal links checked.`);
if (process.argv.includes('--latin')) console.log([...latinReport].sort((a, b) => b[1] - a[1]).map(([w, n]) => `${w}(${n})`).join(' '));
if (errors.length) { console.error(`\n${errors.length} problem(s):\n  ` + errors.slice(0, 60).join('\n  ')); process.exit(1); }
console.log('i18n check passed.');
