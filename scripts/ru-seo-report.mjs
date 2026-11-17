#!/usr/bin/env node
// Writes docs/RU_SEO_PAGE_MAP.md: every Russian page with primary keyword (research suggestion, not measured volume), title, description, H1.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ui = JSON.parse(fs.readFileSync(path.join(ROOT, 'locales/ru/ui.json'), 'utf8'));
const STATIC = {
  '/': ['недвижимость на Пхукете', 'купить недвижимость на Пхукете; недвижимость в Таиланде'],
  '/sale/': ['купить недвижимость на Пхукете', 'недвижимость на продажу Пхукет; купить виллу / квартиру на Пхукете'],
  '/projects/': ['новостройки на Пхукете', 'новые жилые комплексы на Пхукете; квартиры от застройщика на Пхукете'],
  '/properties/': ['каталог недвижимости Пхукет', 'виллы, таунхаусы, квартиры Пхукет (cannibalisation risk with /projects/ and /sale/: same 78 projects)'],
  '/properties/villas/': ['купить виллу на Пхукете', 'виллы с бассейном на Пхукете; вилла на продажу Пхукет'],
  '/properties/townhouses/': ['купить таунхаус на Пхукете', 'таунхаусы Пхукет'],
  '/properties/condos/': ['купить квартиру на Пхукете', 'апартаменты на Пхукете; кондоминиум Пхукет'],
  '/rent/': ['аренда недвижимости на Пхукете', 'аренда виллы на Пхукете; аренда квартиры на Пхукете (only 6 generic rentals today)'],
  '/locations/': ['районы Пхукета', 'где купить недвижимость на Пхукете; лучшие районы Пхукета для покупки'],
  '/about/': ['Estate Nightdestiny (brand)', 'агентство недвижимости Пхукет'],
  '/contact/': ['Estate Nightdestiny контакты (brand)', 'недвижимость Пхукет WhatsApp'],
  '/guides/freehold-leasehold/': ['фрихолд и лизхолд в Таиланде', 'freehold leasehold Таиланд; квота 49% кондоминиум'],
};
const rows = [];
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name === 'index.html') rows.push(p); });
walk(path.join(ROOT, 'ru'));
const get = (h, re) => (h.match(re) || [])[1] || '';
const out = ['# Russian page map (generated)', '', 'Primary/secondary keywords are research suggestions based on how Russian-speaking buyers phrase queries; **no search-volume data was available**, so nothing here is a measured opportunity.', '', '| URL | Primary keyword | Title | Description | H1 | Status |', '|---|---|---|---|---|---|'];
for (const f of rows.sort()) {
  const url = '/' + path.relative(ROOT, f).replace(/index\.html$/, '');
  const h = fs.readFileSync(f, 'utf8');
  const neutral = url.replace(/^\/ru/, '');
  const title = get(h, /<title>([^<]*)<\/title>/), desc = get(h, /<meta name="description" content="([^"]*)"/), h1 = get(h, /<h1[^>]*>([^<]*)<\/h1>/);
  const noindex = /noindex/.test(get(h, /<meta name="robots" content="([^"]*)"/));
  let kw = STATIC[neutral]?.[0];
  const loc = neutral.match(/^\/locations\/([^/]+)\/$/);
  if (!kw && loc) kw = h1.replace(/, Пхукет$/, '').toLowerCase();
  if (!kw && /^\/projects\//.test(neutral)) kw = title.replace(/ — /, ' ').replace(/,? Пхукет$/, '').toLowerCase();
  if (!kw && /^\/rent\//.test(neutral)) kw = (h1 + ' аренда Пхукет').toLowerCase();
  if (/404|5xx/.test(url)) continue;
  const e = (x) => String(x).replace(/\|/g, '\\|');
  out.push(`| ${url} | ${e(kw || '-')} | ${e(title)} | ${e(desc)} | ${e(h1)} | ${noindex ? 'noindex (draft)' : 'indexable, unique'} |`);
}
fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'docs/RU_SEO_PAGE_MAP.md'), out.join('\n') + '\n');
console.log(`docs/RU_SEO_PAGE_MAP.md: ${rows.length} pages`);
