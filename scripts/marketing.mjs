// Marketing draft generator. Builds channel-specific DRAFTS from real site data (content/ + data/projects.json).
// Nothing is ever published by this script. Every draft starts as status "draft" / approval "pending".
// Usage: node scripts/marketing.mjs <command> [options]   (run `node scripts/marketing.mjs help`)
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'content/marketing/drafts');
const settings = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/settings.json'), 'utf8'));
const SITE = settings.siteUrl;
const today = new Date().toISOString().slice(0, 10);
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const dirJson = (d) => (fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith('.json')).map((f) => ({ slug: f.slice(0, -5), ...readJson(path.join(d, f)) })) : []);

// ---- data access ----
const built = fs.existsSync(path.join(ROOT, 'data/projects.json')) ? readJson(path.join(ROOT, 'data/projects.json')) : [];
const urlOf = (slug) => (built.find((b) => b.id === slug) || {}).url || `/projects/${slug}/`;
const projects = dirJson(path.join(ROOT, 'content/projects')).filter((p) => p.published !== false && p.noindex !== true);
const rentals = dirJson(path.join(ROOT, 'content/properties/rent')).filter((p) => p.published !== false);
const guides = dirJson(path.join(ROOT, 'locales/en/guides'));
const locSlug = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const THB = (n) => `THB ${Math.round(n).toLocaleString('en-US')}`;
const money = (n, cur = 'THB') => (cur === 'THB' ? THB(n) : `${cur} ${Math.round(n).toLocaleString('en-US')}`);
const num = (v) => (v === undefined || v === null || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const range = (a, b, unit = '') => (a === null ? null : b === null || a === b ? `${a}${unit}` : `${a}-${b}${unit}`);
const full = (u) => SITE + u;
const WA = `https://wa.me/${settings.whatsappNumber}`;
const tag = (s) => '#' + s.replace(/[^A-Za-z0-9]+/g, '');
const clip = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…');

// Facts are collected once and every channel text is built from them. A missing fact is never replaced by a guess:
// it is left out of the text and listed in `needsReview`.
function projectFacts(p) {
  const review = [];
  const price = num(p.startingPrice);
  if (price === null) review.push('No advertised price: the text says "price on request".');
  if (p.priceStatus && p.priceStatus !== 'advertised' && price !== null) review.push(`Price status is "${p.priceStatus}": confirm before posting.`);
  const lv = p.lastVerified || null;
  if (!lv) review.push('lastVerified date missing: check price and availability.');
  else if ((Date.parse(today) - Date.parse(lv)) / 864e5 > 45) review.push(`Data last verified ${lv} (over 45 days ago): re-check price and availability.`);
  const beds = range(num(p.bedroomsMin) === 0 ? 1 : num(p.bedroomsMin), num(p.bedroomsMax));
  if (!beds) review.push('Bedrooms not recorded.');
  const area = range(num(p.builtUpMin), num(p.builtUpMax), ' sqm');
  const completion = p.completionDate || null;
  if (!completion) review.push('Completion date not recorded: not mentioned in the text.');
  if (!p.constructionStatus || /on request/i.test(p.constructionStatus)) review.push('Construction status not confirmed.');
  const fac = (p.facilities || []).slice(0, 5);
  if (!fac.length) review.push('No facilities recorded.');
  if (/render/i.test(p.imageCredit || '')) review.push('Images are mostly artist renders: say "render" in the post or use an "illustrative" label.');
  const beach = (p.nearby || []).find((n) => /beach/i.test(n.place) && /\d/.test(n.distance || ''));
  return {
    name: p.name, location: p.location, developer: p.developer || null, type: p.projectType || 'Condominium',
    status: /on request/i.test(p.constructionStatus || '') ? null : p.constructionStatus || null, completion, price, currency: p.currency || 'THB',
    beds, area, ownership: (p.ownership || []).join(' / ') || null, facilities: fac, beach: beach ? `${beach.place} (${beach.distance}${beach.mode === 'straight line' ? ', straight line' : ''})` : null,
    units: p.totalUnits || null, url: urlOf(p.slug), image: p.cover || null, review,
  };
}
const factLines = (f) => [
  f.type && `${f.type} in ${f.location}, Phuket`, f.status && `Status: ${f.status}`, f.completion && `Completion: ${f.completion}`,
  f.beds && `Bedrooms: ${f.beds}`, f.area && `Size: ${f.area}`, f.ownership && `Ownership: ${f.ownership}`, f.beach && `Nearest beach: ${f.beach}`,
  f.price !== null && `From ${money(f.price, f.currency)} (lowest advertised price, can change)`,
].filter(Boolean);
const priceTxt = (f) => (f.price !== null ? `from ${money(f.price, f.currency)}` : 'price on request');
const DISCLAIMER = 'Prices and availability can change; check the project page or ask us for the current details. Images may be developer renders.';
const locTags = (loc) => [tag(`${loc}Phuket`), tag('PhuketRealEstate'), tag('PhuketProperty'), tag('ThailandProperty')];

// ---- channel formatters (each channel has its own length, tone and structure) ----
function channelsForProject(f) {
  const lines = factLines(f), link = full(f.url);
  const fac = f.facilities.length ? `Facilities include ${f.facilities.slice(0, 4).join(', ').toLowerCase()}.` : '';
  return {
    facebook: {
      note: 'Page post. Link in text; Facebook generates the preview card.',
      text: `${f.name}: ${f.type.toLowerCase()} in ${f.location}, Phuket\n\n${lines.slice(1).map((l) => `• ${l}`).join('\n')}${fac ? `\n\n${fac}` : ''}\n\nPhotos, floor plans and details: ${link}\nQuestions? Message us on WhatsApp: ${WA}\n\n${DISCLAIMER}`,
      image: f.image,
    },
    instagram: {
      note: 'Instagram captions do not make links clickable: say "link in bio" and keep the URL in the bio. Use 1 cover image or a carousel.',
      text: `${f.name} | ${f.location}, Phuket\n${f.beds ? `${f.beds} bedroom${f.beds === '1' ? '' : 's'} · ` : ''}${priceTxt(f)}${f.status ? ` · ${f.status}` : ''}\n\n${f.beach ? `Nearest beach: ${f.beach}.\n` : ''}${fac}\n\nFull details: link in bio. Ask us on WhatsApp.\n\n${locTags(f.location).concat([tag(f.name), tag('CondoForSale')]).join(' ')}`,
      image: f.image,
    },
    linkedin: {
      note: 'Company page post. Professional tone, no emojis, one link.',
      text: `${f.name} is a ${f.type.toLowerCase()} project in ${f.location}, Phuket${f.developer ? `, developed by ${f.developer}` : ''}.\n\n${lines.slice(1, 7).map((l) => `- ${l}`).join('\n')}\n\nBuyer context: ownership type and foreign quota status should be confirmed with the developer and an independent lawyer before reservation.\n\nProject details: ${link}\n\n${tag('PhuketRealEstate')} ${tag('ThailandProperty')} ${tag(f.location + 'Phuket')}`,
      image: f.image,
    },
    pinterest: {
      note: 'Pin. Use a vertical crop (2:3) of the cover image; the pin links to the project page.',
      title: clip(`${f.name} ${f.type} in ${f.location}, Phuket`, 100),
      text: clip(`${f.type} in ${f.location}, Phuket. ${f.beds ? `${f.beds} bedrooms. ` : ''}${f.beach ? `Nearest beach: ${f.beach}. ` : ''}${f.price !== null ? `From ${money(f.price, f.currency)}. ` : ''}View photos and details on ${new URL(SITE).hostname}.`, 500),
      destination: link, board: `Phuket ${f.type}s`, image: f.image,
    },
    youtube_shorts: {
      note: 'Vertical video 15-40 s. Needs real footage or photos of this project; do not use stock footage. Shorts descriptions can hold the link.',
      title: clip(`${f.name}, ${f.location} Phuket: quick look`, 100),
      script: [
        `0-3s HOOK (on screen): "${f.name}, ${f.location}" over the best exterior or render shot.`,
        `3-10s: Say: "${f.type} in ${f.location}${f.status ? `, ${f.status.toLowerCase()}` : ''}${f.beach ? `, ${f.beach.split(' (')[0]} is the nearest beach` : ''}."`,
        f.beds || f.area ? `10-18s: Show interior/floor plan. Say: "${[f.beds && `${f.beds} bedrooms`, f.area].filter(Boolean).join(', ')}."` : '10-18s: Show the interior or floor plan (no specs recorded: do not state any).',
        `18-25s: ${f.price !== null ? `Say: "${priceTxt(f)}, prices can change."` : 'Say: "Ask us for current prices."'}`,
        `25-30s CTA: "Details on our website or WhatsApp us." Show the website name on screen.`,
      ],
      description: `${f.name} in ${f.location}, Phuket.\nDetails: ${link}\nWhatsApp: ${WA}\n${DISCLAIMER}`,
      hashtags: ['#Shorts', ...locTags(f.location).slice(0, 2)],
    },
  };
}

// ---- draft builders ----
const baseDraft = (type, id, title, source, destination, channels, review, facts) => ({
  id, type, title, status: 'draft',
  approval: { state: 'pending', approvedBy: null, approvedAt: null, note: '' },
  publishing: { state: 'unpublished', scheduledAt: null, publishedAt: null, postUrls: {} },
  source, destinationUrl: destination, generatedAt: today, needsReview: [...new Set(review)], facts, channels,
  history: [{ at: today, action: 'generated', by: 'scripts/marketing.mjs', note: 'Auto-generated draft from site data. Not reviewed.' }],
});
const bySlug = (s) => projects.find((p) => p.slug === s) || null;

function projectIntro(slug) {
  const p = bySlug(slug); if (!p) throw new Error(`unknown project ${slug}`);
  const f = projectFacts(p);
  return baseDraft('project_intro', `${today}-project-intro-${slug}`, `Project introduction: ${f.name}`, { kind: 'project', slug }, f.url, channelsForProject(f), f.review, f);
}
function propertyPromotion(slug) {
  const r = rentals.find((x) => x.slug === slug); if (!r) throw new Error(`unknown rental ${slug}`);
  const review = [];
  const price = num(r.price); if (price === null) review.push('Rental price missing.');
  review.push('Rental price is a "from" price per night; availability is by request: do not promise dates.');
  const cap = num(r.bedrooms) ? `${Number(r.bedrooms) * 2} guests recommended` : null;
  const link = `${SITE}/rent/${slug}/`;
  const spec = [r.propertyType, num(r.bedrooms) && `${r.bedrooms} bedrooms`, num(r.livingArea) && `${r.areaUpTo ? 'up to ' : ''}${r.livingArea} sqm`, cap].filter(Boolean).join(' · ');
  const from = price !== null ? `from ${money(price, r.currency)} per ${r.pricePeriod || 'night'}` : 'price on request';
  const ch = {
    facebook: { note: 'Page post.', text: `${r.title}, Phuket\n${spec}\n${from}\n\nSend an availability request (no payment taken online): ${link}\nOr WhatsApp: ${WA}\n\nPrices are starting prices and depend on season and dates.`, image: r.cover },
    instagram: { note: 'Link in bio.', text: `${r.title} · Phuket\n${spec}\n${from}\n\nRequest availability: link in bio.\n\n${[tag('PhuketRental'), tag('PhuketVilla'), tag('PhuketHolidays'), tag('ThailandTravel')].join(' ')}`, image: r.cover },
    linkedin: { note: 'Optional: only for corporate or long-stay audiences.', text: `${r.title} in Phuket: ${spec}. Available ${from}. Enquiries and availability requests: ${link}`, image: r.cover },
    pinterest: { note: 'Vertical crop recommended.', title: clip(`${r.title} for rent in Phuket`, 100), text: clip(`${spec}. ${from}. Request availability on ${new URL(SITE).hostname}.`, 500), destination: link, board: 'Phuket rentals', image: r.cover },
    youtube_shorts: { note: 'Needs real footage of the property.', title: clip(`${r.title} Phuket: quick tour`, 100), script: ['0-3s HOOK: best exterior or pool shot with the property name.', `3-12s: Say: "${spec}."`, `12-20s: Say: "${from.replace('from ', 'Starting at ')}, depends on season and dates."`, '20-25s CTA: "Send an availability request on our website."'], description: `${r.title}, Phuket\n${link}\nWhatsApp: ${WA}`, hashtags: ['#Shorts', tag('PhuketRental')] },
  };
  return baseDraft('property_promotion', `${today}-property-promotion-${slug}`, `Property promotion: ${r.title}`, { kind: 'rent', slug }, `/rent/${slug}/`, ch, review, { title: r.title, spec, from });
}
function locationGuide(slug) {
  const name = slug.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
  const file = path.join(ROOT, 'locales/en/locations', `${slug}.json`);
  const overview = fs.existsSync(file) ? (readJson(file).overview || '') : '';
  const ps = projects.filter((p) => locSlug(p.location) === slug);
  if (!ps.length && !overview) throw new Error(`unknown location ${slug}`);
  const prices = ps.map((p) => num(p.startingPrice)).filter((n) => n !== null).sort((a, b) => a - b);
  const review = []; if (!overview) review.push('No location overview text: only project counts used.');
  const first = overview.split(/(?<=\.)\s+/).slice(0, 2).join(' ');
  const stat = `${ps.length} project${ps.length === 1 ? '' : 's'} listed${prices.length ? `, advertised starting prices from ${THB(prices[0])}` : ''}`;
  const link = `${SITE}/locations/${slug}/`;
  const ch = {
    facebook: { note: 'Page post.', text: `Buying in ${name}, Phuket?\n\n${first}\n\nWe currently list ${stat}.\nArea guide with projects, nearby places and FAQs: ${link}\nWhatsApp: ${WA}\n\n${DISCLAIMER}`, image: ps[0]?.cover || null },
    instagram: { note: 'Link in bio. Carousel: 1 cover + 4 project images.', text: `${name}, Phuket: area guide\n${first}\n\n${stat}.\nFull guide: link in bio.\n\n${locTags(name).join(' ')}`, image: ps[0]?.cover || null },
    linkedin: { note: 'Company page post.', text: `${name} area guide for Phuket property buyers\n\n${first}\n\n${stat}. The guide covers ownership types, construction status and nearby places per project.\n\n${link}\n\n${tag('PhuketRealEstate')} ${tag(name + 'Phuket')}`, image: ps[0]?.cover || null },
    pinterest: { note: 'Infographic-style pin recommended.', title: clip(`${name} Phuket property guide`, 100), text: clip(`${first} ${stat}.`, 500), destination: link, board: 'Phuket areas', image: ps[0]?.cover || null },
    youtube_shorts: { note: 'Needs real footage of the area.', title: clip(`${name}, Phuket in 30 seconds`, 100), script: ['0-3s HOOK: strongest beach or street shot of the area.', `3-15s: Read the first overview sentence: "${first.split('. ')[0]}."`, `15-25s: Say: "${stat}."`, '25-30s CTA: "Full area guide on our website."'], description: `${name} area guide: ${link}\nWhatsApp: ${WA}`, hashtags: ['#Shorts', ...locTags(name).slice(0, 2)] },
  };
  return baseDraft('location_guide', `${today}-location-guide-${slug}`, `Location guide: ${name}`, { kind: 'location', slug }, `/locations/${slug}/`, ch, review, { name, projects: ps.length, from: prices[0] ?? null });
}
function projectComparison(a, b) {
  const pa = bySlug(a), pb = bySlug(b); if (!pa || !pb) throw new Error('unknown project in comparison');
  const fa = projectFacts(pa), fb = projectFacts(pb);
  const row = (k, f) => f[k] ?? 'not recorded';
  const cmp = `${fa.name} vs ${fb.name}\n\n` + [['Location', 'location'], ['Status', 'status'], ['Bedrooms', 'beds'], ['Size', 'area'], ['Ownership', 'ownership']].map(([l, k]) => `${l}: ${row(k, fa)} | ${row(k, fb)}`).join('\n') + `\nStarting price: ${fa.price !== null ? money(fa.price, fa.currency) : 'on request'} | ${fb.price !== null ? money(fb.price, fb.currency) : 'on request'}`;
  const links = `${full(fa.url)}\n${full(fb.url)}`;
  const review = [...fa.review, ...fb.review, 'Comparison states recorded facts only: add a neutral conclusion only after review.'];
  const ch = {
    facebook: { note: 'Page post.', text: `${cmp}\n\nDetails:\n${links}\n\n${DISCLAIMER}`, image: fa.image },
    instagram: { note: 'Carousel: slide 1 title, slide 2 table, slide 3 CTA.', text: `${fa.name} or ${fb.name}?\n${cmp.split('\n\n')[1]}\n\nLinks in bio.\n\n${[tag('PhuketRealEstate'), tag('PhuketCondo'), tag('PropertyComparison')].join(' ')}`, image: fa.image },
    linkedin: { note: 'Company page post.', text: `${cmp}\n\nProject pages:\n${links}\n\nBefore deciding, compare ownership terms, payment plan and developer track record.`, image: fa.image },
  };
  return baseDraft('project_comparison', `${today}-project-comparison-${a}-vs-${b}`, `Comparison: ${fa.name} vs ${fb.name}`, { kind: 'comparison', slugs: [a, b] }, fa.url, ch, review, { a: fa, b: fb });
}
function marketUpdate() {
  const priced = projects.filter((p) => num(p.startingPrice) !== null);
  const by = {};
  priced.forEach((p) => { (by[p.location] ||= []).push(num(p.startingPrice)); });
  const top = Object.entries(by).filter(([, v]) => v.length >= 3).map(([l, v]) => [l, v.length, Math.min(...v)]).sort((x, y) => y[1] - x[1]).slice(0, 5);
  const all = priced.map((p) => num(p.startingPrice));
  const review = ['Counts and prices describe OUR catalogue only, not the whole Phuket market. Do not describe them as market trends.'];
  const txt = `Our Phuket catalogue this month (${today}): ${projects.length} projects listed, ${priced.length} with an advertised starting price, lowest advertised price ${THB(Math.min(...all))}.\n\nAreas with most priced projects:\n${top.map(([l, n, m]) => `- ${l}: ${n} projects, from ${THB(m)}`).join('\n')}\n\nThese are the lowest advertised prices per project, not averages, and not a forecast. Browse: ${SITE}/sale/`;
  const ch = { facebook: { note: 'Page post.', text: txt, image: null }, linkedin: { note: 'Company page post.', text: txt + '\n\n' + tag('PhuketRealEstate'), image: null } };
  return baseDraft('market_update', `${today}-market-update`, `Catalogue update ${today}`, { kind: 'catalogue' }, '/sale/', ch, review, { projects: projects.length, priced: priced.length, top });
}
function buyingGuide(slug) {
  const g = guides.find((x) => x.slug === slug); if (!g) throw new Error(`unknown guide ${slug}`);
  const link = `${SITE}/guides/${slug}/`;
  const heads = g.sections.map((s) => s.h2);
  const review = ['Legal topic: have a licensed Thai lawyer review the guide and every derived post before publishing.', ...(g.status === 'needs-legal-review' ? ['Guide status is needs-legal-review.'] : [])];
  const ch = {
    facebook: { note: 'Page post.', text: `${g.h1}\n\n${g.intro}\n\nIn the guide:\n${heads.map((h) => `• ${h}`).join('\n')}\n\nRead it: ${link}\n\n${g.disclaimer}`, image: null },
    linkedin: { note: 'Company page article teaser.', text: `${g.h1}\n\n${g.intro}\n\n${link}\n\n${tag('ThailandProperty')} ${tag('PhuketRealEstate')}`, image: null },
    pinterest: { note: 'Text-on-image pin recommended.', title: clip(g.h1, 100), text: clip(g.description, 500), destination: link, board: 'Phuket buyer guides', image: null },
    youtube_shorts: { note: 'Explainer short; needs a presenter or text slides.', title: clip(g.h1, 100), script: ['0-3s HOOK: ' + g.h1, ...heads.slice(0, 3).map((h, i) => `${3 + i * 8}-${11 + i * 8}s: Slide "${h}" with one sentence from the guide.`), `27-30s CTA: "Full guide on our website. Not legal advice."`], description: `${g.description}\n${link}`, hashtags: ['#Shorts', tag('PhuketProperty')] },
  };
  return baseDraft('buying_guide', `${today}-buying-guide-${slug}`, `Buying guide: ${g.h1}`, { kind: 'guide', slug }, `/guides/${slug}/`, ch, review, { headings: heads });
}
// Types that are derived views of a channel text (the same project data, different packaging).
const ALIASES = { social_post: 'project_intro', short_video_script: 'project_intro', pinterest_description: 'project_intro', linkedin_article: 'buying_guide' };

// ---- storage ----
function save(d, force) {
  fs.mkdirSync(OUT, { recursive: true });
  const f = path.join(OUT, `${d.id}.json`);
  if (fs.existsSync(f) && !force) return `kept (exists, not overwritten): ${d.id}`;
  fs.writeFileSync(f, JSON.stringify(d, null, 2) + '\n');
  return `${fs.existsSync(f) ? 'wrote' : 'wrote'}: ${d.id}`;
}
const load = (id) => { const f = path.join(OUT, `${id}.json`); if (!fs.existsSync(f)) throw new Error(`no draft ${id}`); return [readJson(f), f]; };
const allDrafts = () => (fs.existsSync(OUT) ? fs.readdirSync(OUT).filter((f) => f.endsWith('.json')).map((f) => readJson(path.join(OUT, f))) : []);
const stamp = (d, action, by, note = '') => d.history.push({ at: today, action, by: by || 'unknown', note });

function previewHtml() {
  const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const ds = allDrafts();
  const card = (d) => `<section><h2>${esc(d.title)} <small>${esc(d.type)} · ${esc(d.status)} · approval: ${esc(d.approval.state)} · publishing: ${esc(d.publishing.state)}</small></h2><p>Source: ${esc(JSON.stringify(d.source))} · destination: <a href="${esc(SITE + d.destinationUrl)}">${esc(d.destinationUrl)}</a></p>${d.needsReview.length ? `<div class="rv"><strong>Needs review</strong><ul>${d.needsReview.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}<div class="g">${Object.entries(d.channels).map(([c, v]) => `<article><h3>${esc(c)}</h3><p class="n">${esc(v.note)}</p>${v.title ? `<p><b>${esc(v.title)}</b></p>` : ''}<pre>${esc(v.text || (v.script || []).join('\n') + (v.description ? '\n\n' + v.description : ''))}</pre>${v.image ? `<img src="${esc(v.image)}" alt="" loading="lazy">` : ''}</article>`).join('')}</div></section>`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Marketing drafts (internal)</title><style>body{font:15px/1.5 system-ui;margin:1.5rem;background:#f6f6f4;color:#222}section{background:#fff;border:1px solid #ddd;border-radius:8px;padding:1rem;margin-bottom:1.5rem}small{font-weight:400;color:#666;font-size:.7em}.g{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1rem}article{border:1px solid #eee;padding:.7rem;border-radius:6px}pre{white-space:pre-wrap;font:inherit;background:#fafafa;padding:.5rem}.n{color:#666;font-size:.85em}.rv{background:#fff4e0;border:1px solid #f0c27a;padding:.5rem 1rem;border-radius:6px}img{max-width:100%}</style></head><body><h1>Marketing drafts (internal, not published)</h1><p>${ds.length} drafts. Generated ${today}. Nothing here has been posted.</p>${ds.map(card).join('')}</body></html>`;
  fs.mkdirSync(path.join(ROOT, 'content/marketing'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'content/marketing/preview.html'), html);
  return ds.length;
}

// ---- CLI ----
const [cmd, ...rest] = process.argv.slice(2);
const opt = (n) => { const i = rest.indexOf('--' + n); return i >= 0 ? rest[i + 1] : undefined; };
const force = rest.includes('--force');
try {
  if (cmd === 'generate') {
    const type = ALIASES[opt('type')] || opt('type'), slug = opt('slug');
    const make = { project_intro: () => projectIntro(slug), property_promotion: () => propertyPromotion(slug), location_guide: () => locationGuide(slug), project_comparison: () => projectComparison(...(opt('slugs') || '').split(',')), market_update: () => marketUpdate(), buying_guide: () => buyingGuide(slug) }[type];
    if (!make) throw new Error('--type one of: project_intro, property_promotion, location_guide, project_comparison (--slugs a,b), market_update, buying_guide (also aliases: social_post, short_video_script, pinterest_description -> project_intro; linkedin_article -> buying_guide)');
    console.log(save(make(), force));
  } else if (cmd === 'batch') {
    const n = Number(opt('limit') || 5), res = [];
    const priced = projects.filter((p) => num(p.startingPrice) !== null).sort((a, b) => String(b.lastVerified).localeCompare(String(a.lastVerified)) || a.slug.localeCompare(b.slug)).slice(0, n);
    priced.forEach((p) => res.push(save(projectIntro(p.slug), force)));
    rentals.forEach((r) => res.push(save(propertyPromotion(r.slug), force)));
    ['rawai', 'bang-tao', 'kamala'].forEach((s) => res.push(save(locationGuide(s), force)));
    res.push(save(marketUpdate(), force));
    guides.forEach((g) => res.push(save(buyingGuide(g.slug), force)));
    console.log(res.join('\n'));
  } else if (cmd === 'list') {
    allDrafts().forEach((d) => console.log(`${d.id}\t${d.type}\t${d.status}\tapproval=${d.approval.state}\tpublishing=${d.publishing.state}\treview=${d.needsReview.length}`));
  } else if (cmd === 'approve' || cmd === 'reject') {
    const [d, f] = load(rest[0]); const by = opt('by'); if (!by) throw new Error('--by "<reviewer name>" is required');
    if (cmd === 'approve' && d.needsReview.length && !rest.includes('--reviewed')) throw new Error(`draft has ${d.needsReview.length} needs-review item(s); fix/confirm them, then re-run with --reviewed`);
    d.approval = { state: cmd === 'approve' ? 'approved' : 'rejected', approvedBy: by, approvedAt: today, note: opt('note') || '' };
    if (cmd === 'approve') d.status = 'approved'; stamp(d, cmd, by, opt('note')); fs.writeFileSync(f, JSON.stringify(d, null, 2) + '\n'); console.log(`${cmd}d ${d.id}`);
  } else if (cmd === 'schedule') {
    const [d, f] = load(rest[0]); if (d.approval.state !== 'approved') throw new Error('only approved drafts can be scheduled');
    const at = opt('at'); if (!at || isNaN(Date.parse(at))) throw new Error('--at <ISO date-time> required');
    d.publishing.state = 'scheduled'; d.publishing.scheduledAt = at; stamp(d, 'scheduled', opt('by'), at); fs.writeFileSync(f, JSON.stringify(d, null, 2) + '\n'); console.log(`scheduled ${d.id} for ${at} (scheduling is a field only: nothing posts automatically)`);
  } else if (cmd === 'preview') {
    console.log(`wrote content/marketing/preview.html (${previewHtml()} drafts)`);
  } else {
    console.log(`Marketing draft generator (drafts only, never publishes)\n  generate --type <t> [--slug s | --slugs a,b] [--force]\n  batch [--limit N]        sample set from real data\n  list\n  approve <id> --by "Name" [--reviewed] [--note ..]\n  reject <id> --by "Name"\n  schedule <id> --at 2026-12-01T09:00:00+07:00 --by "Name"\n  preview                   writes content/marketing/preview.html (noindex)\nPost with scripts/marketing-publish.mjs (dry run unless --send and credentials).`);
  }
} catch (e) { console.error('ERROR: ' + e.message); process.exit(1); }
