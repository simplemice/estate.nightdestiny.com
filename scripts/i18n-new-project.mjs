#!/usr/bin/env node
// Prepares Russian drafts for projects/properties that have no (or a draft) translation overlay.
//   node scripts/i18n-new-project.mjs            -> lists what needs work
//   node scripts/i18n-new-project.mjs --write    -> creates locales/ru/<...>/<slug>.json drafts (never overwrites an existing file)
// A draft has "status": "draft": its Russian page is generated but noindex, has no hreflang pair and is left out of sitemap.xml.
// To publish: translate the fields, review the SEO suggestions, delete the "status" line, run `npm run build && npm run check:i18n`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WRITE = process.argv.includes('--write');
const rj = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const ui = rj(path.join(ROOT, 'locales/ru/ui.json'));
const AREA_RULES = [[/layan/i, 'Layan'], [/laguna|lakelands/i, 'Laguna'], [/bang\s*tao/i, 'Bang Tao'], [/surin/i, 'Surin'], [/cherng\s*talay|cherngtalay|choeng\s*thale/i, 'Cherng Talay'], [/si\s*sunthon|bang\s*jo/i, 'Si Sunthon'], [/nai\s*yang|naiyang/i, 'Nai Yang'], [/mai\s*khao/i, 'Mai Khao'], [/nai\s*harn/i, 'Nai Harn'], [/kamala/i, 'Kamala'], [/karon/i, 'Karon'], [/kata/i, 'Kata'], [/patong/i, 'Patong'], [/rawai/i, 'Rawai'], [/ko\s*kaeo|koh\s*kaew/i, 'Ko Kaeo'], [/phuket\s*town/i, 'Phuket Town'], [/thalang/i, 'Thalang']];
const canon = (l) => (/kathu/i.test(l) ? 'Kathu-Patong' : (AREA_RULES.find(([re]) => re.test(l)) || [, String(l).split(',')[0].trim()])[1]);
const NN = { Villa: 'виллы', Townhouse: 'таунхаусы', Condominium: 'кондоминиум' };
const KW = { Villa: ['купить виллу', 'виллы с бассейном'], Townhouse: ['купить таунхаус', 'таунхаусы'], Condominium: ['купить квартиру', 'апартаменты', 'кондоминиум'] };

const dir = path.join(ROOT, 'content/projects');
const todo = [];
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
  const slug = f.replace(/\.json$/, '');
  const out = path.join(ROOT, 'locales/ru/projects', `${slug}.json`);
  const exists = fs.existsSync(out);
  const ov = exists ? rj(out) : null;
  if (exists && ov.status !== 'draft') continue;
  todo.push({ slug, exists, out });
  if (!WRITE || exists) continue;
  const p = rj(path.join(dir, f));
  const area = canon(p.location), inn = ui[`area_in.${area}`] || `в районе ${area}`;
  const cat = p.category || (p.projectType === 'Villas' ? 'Villa' : 'Condominium');
  const draft = {
    status: 'draft',
    _hints: {
      url: `/ru/projects/${slug}/`,
      primaryKeyword: `${(KW[cat] || KW.Condominium)[0]} ${inn.replace(/^в районе /, 'в ')} Пхукет`,
      secondaryKeywords: [...(KW[cat] || KW.Condominium).slice(1), `новостройки ${inn}`, `${p.name} Пхукет`],
      seoTitleSuggestion: `${p.name} — ${NN[cat]} ${inn}, Пхукет`,
      altText: 'Описывайте то, что видно на фото; название проекта — один раз, без перечисления ключевых слов.',
      rules: 'Не добавляйте факты, которых нет в content/projects/' + f + ' или в проверенных источниках. Названия проектов и застройщиков не переводятся.',
    },
    shortDescription: `TODO: ${p.shortDescription || ''}`,
    description: `TODO: ${p.description || ''}`,
  };
  for (const k of ['cardDescription', 'seoTitle', 'seoDescription']) if (p[k]) draft[k] = `TODO: ${p[k]}`;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(draft, null, 2) + '\n');
}
console.log(todo.length ? `${todo.length} project(s) without a published Russian translation:` : 'All projects have a published (non-draft) Russian translation; human proofreading is still recommended.');
todo.forEach((t) => console.log(`  ${t.slug}  ${t.exists ? '(draft file exists)' : WRITE ? '(draft created)' : '(no file yet; run with --write)'}`));
