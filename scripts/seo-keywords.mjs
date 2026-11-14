// Writes docs/SEO_PROJECT_KEYWORDS.md - qualitative keyword map per project (no search volumes: none were measured).
// CMS fields primaryKeyword / secondaryKeywords override the generated defaults.
import fs from 'node:fs'; import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dir = path.join(ROOT, 'content/projects');
const areaOf = (l) => String(l || 'Phuket').replace(/\s*\([^)]*\)/g, '').split('/')[0].split(',')[0].trim();
const NOUN = { Villa: 'villas', Townhouse: 'townhouses', Condominium: 'condos' };
const rows = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => ({ slug: f.slice(0, -5), ...JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) }))
  .filter((p) => p.published !== false).sort((a, b) => a.name.localeCompare(b.name));
const seen = new Map(); const out = [];
for (const p of rows) {
  const a = areaOf(p.location), n = NOUN[p.category] || 'condos';
  const primary = p.primaryKeyword || `${p.name} Phuket`;
  const sec = p.secondaryKeywords?.length ? p.secondaryKeywords : [`${p.name} price`, `${n} for sale in ${a}`, `${a} ${n.replace(/s$/, '')} for sale`, ...(p.developer ? [`${p.developer.replace(/\s*\([^)]*\)/g, '')} Phuket`] : [])];
  const lt = [p.floorPlans?.length ? `${p.name} floor plans` : '', p.unitTypes?.length ? `${p.name} available units` : '', `buy ${n.replace(/s$/, '')} in ${a} Phuket`, p.constructionStatus === 'Under construction' || p.constructionStatus === 'Pre-sale' ? `off-plan ${n.replace(/s$/, '')} ${a}` : ''].filter(Boolean);
  if (seen.has(primary.toLowerCase())) console.warn('DUPLICATE primary keyword:', primary, seen.get(primary.toLowerCase()), p.slug);
  seen.set(primary.toLowerCase(), p.slug);
  out.push(`| [${p.name}](/projects/${p.slug}/) | ${primary} | ${sec.join('; ')} | ${lt.join('; ')} | Commercial: price, units, floor plans, enquiry |`);
}
const md = `# Project keyword map (qualitative)\n\nGenerated ${new Date().toISOString().slice(0, 10)} by scripts/seo-keywords.mjs. **No search-volume or difficulty data was used or invented**; validate in Google Search Console / a keyword tool before relying on it. Each project's primary keyword is its own name, so projects do not compete with each other; area-level terms ("condos for sale in Rawai") are targeted by the location and category pages instead.\n\n| Project | Primary | Secondary | Long-tail | Search intent |\n|---|---|---|---|---|\n${out.join('\n')}\n`;
fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'docs/SEO_PROJECT_KEYWORDS.md'), md);
console.log('wrote docs/SEO_PROJECT_KEYWORDS.md', rows.length, 'projects');
