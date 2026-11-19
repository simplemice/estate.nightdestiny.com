#!/usr/bin/env node
// Per-project content audit from the catalogue (no external data). Writes docs/PROJECT_SEO_AUDIT.md.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(ROOT, 'content/projects');
// Search Console snapshot (16 months to 2026-11-16, see SEO_AUDIT_REPORT.md): impressions per project page
const GSC = { fizz: 53 };
const NOT_INDEXED = new Set(['brisa-patong', 'fizz', 'the-modeva', 'mouana-serenity-cherng-talay', 'banyan-tree-beach-residences-varuna']);
const rows = [];
const sentences = new Map();
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
  const p = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')), slug = f.replace(/\.json$/, '');
  const words = String(p.description || '').split(/\s+/).filter(Boolean).length;
  const gaps = [];
  if (words < 60) gaps.push('short description (<60 words)');
  if (!(p.startingPrice > 0)) gaps.push('no price');
  if (!(p.nearby || []).length) gaps.push('no nearby');
  if (!(p.facilities || []).length) gaps.push('no facilities');
  if (!(p.unitTypes || []).length) gaps.push('no unit types');
  if (!p.cover) gaps.push('no photos');
  if (!p.completionDate) gaps.push('no completion date');
  if (!(p.ownership || []).length) gaps.push('no ownership');
  if (!p.coordinates?.lat) gaps.push('no map');
  if (/…$|[a-z]$/.test(String(p.shortDescription || '')) && !/[.!?]$/.test(String(p.shortDescription || ''))) gaps.push('shortDescription cut off');
  String(p.description || '').split(/(?<=[.!?])\s+/).forEach((s) => { const k = s.trim().toLowerCase(); if (k.length > 30) (sentences.get(k) || sentences.set(k, []).get(k)).push(slug); });
  rows.push({ slug, name: p.name, words, gaps, gsc: GSC[slug] || 0, ni: NOT_INDEXED.has(slug) });
}
const repeated = [...sentences].filter(([, v]) => v.length > 2).sort((a, b) => b[1].length - a[1].length).slice(0, 8);
const out = ['# Project content audit (generated)', '', '78 projects, data from `content/projects`. "GSC" = impressions in the 16-month Search Console snapshot; "not indexed" = in the "crawled – currently not indexed" sample.', '', '| Project | Words | GSC impr. | Not indexed | Data gaps (cannot be filled without verified facts) |', '|---|---|---|---|---|'];
rows.sort((a, b) => b.gsc - a.gsc || (b.ni - a.ni) || b.gaps.length - a.gaps.length).forEach((r) => out.push(`| ${r.name} | ${r.words} | ${r.gsc || ''} | ${r.ni ? 'yes' : ''} | ${r.gaps.join('; ') || '-'} |`));
out.push('', '## Sentences repeated across 3+ projects (generic text)', '', ...repeated.map(([s, v]) => `- (${v.length}×) "${s.slice(0, 120)}"`));
fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'docs/PROJECT_SEO_AUDIT.md'), out.join('\n') + '\n');
const c = (k) => rows.filter((r) => r.gaps.some((g) => g.startsWith(k))).length;
console.log(`projects ${rows.length}; short ${c('short')}; no price ${c('no price')}; no nearby ${c('no nearby')}; no facilities ${c('no facilities')}; no units ${c('no unit')}; no photos ${c('no photos')}; no completion ${c('no completion')}; cut-off ${c('shortDescription')}`);
