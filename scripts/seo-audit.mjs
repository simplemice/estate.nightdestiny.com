// Local SEO audit of the built site (zero dependencies). Usage: node scripts/seo-audit.mjs [--json]
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(import.meta.dirname, '..');
const SITE = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/settings.json'), 'utf8')).siteUrl;
const SKIP = new Set(['node_modules', '.git', 'content', 'scripts', 'assets', 'css', 'js', 'fonts', 'img', 'data', '.github']);
const pages = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(path.join(d, e.name)); }
    else if (e.name === 'index.html' || e.name === '404.html') pages.push(path.join(d, e.name));
  }
})(ROOT);
const rel = (f) => '/' + path.relative(ROOT, f).replace(/index\.html$/, '').replace(/\\/g, '/');
const issues = [];
const add = (sev, url, issue) => issues.push({ sev, url, issue });
const titles = new Map(), descs = new Map();
const ldTypes = {};
const stats = { pages: pages.length, images: 0, noAlt: 0, noDims: 0, links: 0, broken: 0 };
const fileExists = (u) => { const p = decodeURIComponent(u.split('#')[0].split('?')[0]).replace(/^\//, ''); const f = path.join(ROOT, p); return fs.existsSync(f) && (!fs.statSync(f).isDirectory() || fs.existsSync(path.join(f, 'index.html'))); };
for (const f of pages) {
  const h = fs.readFileSync(f, 'utf8'), u = rel(f);
  const g = (re) => (h.match(re) || [])[1];
  const t = g(/<title>([^<]*)<\/title>/), d = g(/<meta name="description" content="([^"]*)"/), c = g(/<link rel="canonical" href="([^"]*)"/);
  if (!t) add('high', u, 'missing <title>'); else { (titles.get(t) || titles.set(t, []).get(t)).push(u); if (t.length > 65) add('low', u, `title long (${t.length})`); if (t.length < 20) add('low', u, 'title short'); }
  if (!d) add('high', u, 'missing meta description'); else { (descs.get(d) || descs.set(d, []).get(d)).push(u); if (d.length > 165) add('low', u, `description long (${d.length})`); if (d.length < 70) add('low', u, `description short (${d.length})`); }
  if (!c) add('high', u, 'missing canonical'); else if (u !== '/404.html' && c !== SITE + u) add('high', u, `canonical mismatch ${c}`);
  const h1 = (h.match(/<h1[ >]/g) || []).length; if (h1 !== 1) add('high', u, `${h1} <h1> tags`);
  for (const k of ['og:title', 'og:description', 'og:image', 'og:url', 'og:site_name']) if (!h.includes(`property="${k}"`)) add('med', u, `missing ${k}`);
  for (const k of ['twitter:card', 'twitter:title', 'twitter:image']) if (!h.includes(`name="${k}"`)) add('low', u, `missing ${k}`);
  if (!/<html lang=/.test(h)) add('med', u, 'missing html lang');
  if (!/<main/.test(h)) add('low', u, 'no <main>');
  const lds = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  if (!lds.length && u !== '/404.html') add('med', u, 'no JSON-LD');
  for (const m of lds) { try { const j = JSON.parse(m[1]); for (const n of (Array.isArray(j) ? j : j['@graph'] || [j])) (ldTypes[n['@type']] ||= new Set()).add(u); } catch { add('high', u, 'invalid JSON-LD'); } }
  if (u !== '/' && u !== '/404.html' && !lds.some((m) => m[1].includes('BreadcrumbList'))) add('med', u, 'no BreadcrumbList');
  for (const m of h.matchAll(/<img\b[^>]*>/g)) { stats.images++; if (!/\salt="[^"]+"/.test(m[0]) && !/\salt=""/.test(m[0])) { stats.noAlt++; add('med', u, 'img without alt'); } if (!/\swidth=/.test(m[0]) || !/\sheight=/.test(m[0])) { stats.noDims++; } if (/alt="(image|img|photo|IMG)[\d_ .-]*"/i.test(m[0])) add('low', u, 'generic alt'); }
  for (const m of h.matchAll(/<a\b[^>]*href="([^"]+)"/g)) { const href = m[1]; if (/^(https?:|mailto:|tel:|#|javascript:)/.test(href)) { if (href.startsWith(SITE)) { stats.links++; if (!fileExists(href.slice(SITE.length) || '/')) { stats.broken++; add('high', u, `broken link ${href}`); } } continue; } stats.links++; if (!fileExists(href)) { stats.broken++; add('high', u, `broken link ${href}`); } }
  if (/rel="nofollow"/.test(h) === false && /target="_blank"(?![^>]*noopener)/.test(h)) add('low', u, 'target=_blank without noopener');
}
for (const [t, us] of titles) if (us.length > 1) add('high', us.join(', '), `duplicate title "${t}"`);
for (const [d, us] of descs) if (us.length > 1) add('high', us.join(', '), `duplicate description`);
// sitemap
let sm = ''; try { sm = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8'); } catch { add('high', '/sitemap.xml', 'missing'); }
const locs = [...sm.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
const smSet = new Set(locs);
for (const l of locs) if (!l.startsWith(SITE) || !fileExists(l.slice(SITE.length))) add('high', l, 'sitemap URL not found locally');
for (const f of pages) { const u = rel(f); if (u !== '/404.html' && !smSet.has(SITE + u)) add('med', u, 'page missing from sitemap'); }
let robots = ''; try { robots = fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8'); } catch { add('high', '/robots.txt', 'missing'); }
if (!robots.includes('Sitemap: ' + SITE + '/sitemap.xml')) add('high', '/robots.txt', 'no Sitemap line');
if (/Crawl-delay/i.test(robots)) add('low', '/robots.txt', 'Crawl-delay is ignored by Google and slows Bing');
if (!fs.existsSync(path.join(ROOT, '404.html'))) add('med', '/404.html', 'missing custom 404 page');
const out = { stats, sitemapUrls: locs.length, ldTypes: Object.fromEntries(Object.entries(ldTypes).map(([k, v]) => [k, v.size])), issues };
if (process.argv.includes('--json')) console.log(JSON.stringify(out, null, 1));
else {
  console.log('STATS', JSON.stringify(stats), 'sitemap urls', locs.length);
  console.log('JSON-LD types (pages):', JSON.stringify(out.ldTypes));
  const by = {}; for (const i of issues) { const k = `${i.sev} | ${i.issue.replace(/https?:\S+|"[^"]*"|\(\d+\)|\/\S*/g, '…')}`; (by[k] ||= []).push(i.url); }
  for (const [k, v] of Object.entries(by).sort()) console.log(`${String(v.length).padStart(4)} × ${k}  e.g. ${v[0]}`);
  console.log(issues.length ? `\n${issues.length} issues` : '\nNo issues');
}
process.exitCode = issues.some((i) => i.sev === 'high') ? 1 : 0;
