// Publishes APPROVED marketing drafts through official platform APIs. Dry run by default.
// Usage: node scripts/marketing-publish.mjs <draft-id> --channel facebook|pinterest|instagram [--send]
// Hard rules: draft must be approval=approved and have no unresolved needsReview flag; credentials come from environment
// variables only (never stored in the repo); without --send nothing leaves this machine.
// STATUS: written against the official docs but UNTESTED (no credentials were available). LinkedIn (OAuth member/org
// token) and YouTube Shorts (video upload via Data API + OAuth) are intentionally not implemented here; see docs/marketing/README.md.
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(import.meta.dirname, '..');
const [id, ...rest] = process.argv.slice(2);
const opt = (n) => { const i = rest.indexOf('--' + n); return i >= 0 ? rest[i + 1] : undefined; };
const SEND = rest.includes('--send'), channel = opt('channel');
const die = (m) => { console.error('REFUSED: ' + m); process.exit(1); };
if (!id || !channel) die('usage: marketing-publish.mjs <draft-id> --channel facebook|pinterest|instagram [--send]');
const f = path.join(ROOT, 'content/marketing/drafts', `${id}.json`);
if (!fs.existsSync(f)) die(`no draft ${id}`);
const d = JSON.parse(fs.readFileSync(f, 'utf8'));
if (d.approval.state !== 'approved') die('draft is not approved (use marketing.mjs approve)');
if (d.publishing.scheduledAt && Date.parse(d.publishing.scheduledAt) > Date.now()) die(`scheduled for ${d.publishing.scheduledAt}, not due yet`);
const c = d.channels[channel]; if (!c) die(`draft has no ${channel} variant`);
const env = (k) => process.env[k] || die(`missing environment variable ${k}`);
const post = async (url, body, json = true, extra = {}) => {
  const r = await fetch(url, { method: 'POST', headers: { ...(json ? { 'content-type': 'application/json' } : { 'content-type': 'application/x-www-form-urlencoded' }), ...extra }, body: json ? JSON.stringify(body) : new URLSearchParams(body) });
  const t = await r.json().catch(() => ({})); if (!r.ok) throw new Error(`${r.status} ${JSON.stringify(t).slice(0, 300)}`); return t;
};
const SITE = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/settings.json'), 'utf8')).siteUrl;
const abs = (u) => (u && u.startsWith('/') ? SITE + u : u);
const plan = { facebook: 'POST graph.facebook.com/{page-id}/feed (message + link)', pinterest: 'POST api.pinterest.com/v5/pins (board, link, image)', instagram: 'POST graph.facebook.com/{ig-user-id}/media then /media_publish (needs a public image URL)' }[channel];
if (!plan) die(`channel ${channel} is not implemented`);
console.log(`Draft ${id} -> ${channel}\nAPI call: ${plan}\n---\n${c.text || c.description}\n---`);
if (!SEND) { console.log('DRY RUN: nothing sent. Add --send to post.'); process.exit(0); }
if (d.needsReview.length && !rest.includes('--reviewed')) die('draft still has needsReview items; confirm they are resolved and pass --reviewed');
let res;
if (channel === 'facebook') res = await post(`https://graph.facebook.com/v19.0/${env('FB_PAGE_ID')}/feed`, { message: c.text, access_token: env('FB_PAGE_TOKEN') }, false);
if (channel === 'pinterest') res = await post('https://api.pinterest.com/v5/pins', { board_id: env('PINTEREST_BOARD_ID'), title: c.title, description: c.text, link: c.destination, media_source: { source_type: 'image_url', url: abs(c.image) || die('no image') } }, true, { authorization: `Bearer ${env('PINTEREST_TOKEN')}` }).catch((e) => die(e.message));
if (channel === 'instagram') {
  const ig = env('IG_USER_ID'), tok = env('IG_TOKEN'); if (!c.image) die('no image');
  const m = await post(`https://graph.facebook.com/v19.0/${ig}/media`, { image_url: abs(c.image), caption: c.text, access_token: tok }, false);
  res = await post(`https://graph.facebook.com/v19.0/${ig}/media_publish`, { creation_id: m.id, access_token: tok }, false);
}
d.publishing.state = 'published'; d.publishing.publishedAt = new Date().toISOString(); d.publishing.postUrls[channel] = res.id || res.permalink || 'ok'; d.status = 'published';
d.history.push({ at: new Date().toISOString().slice(0, 10), action: `published:${channel}`, by: 'marketing-publish.mjs', note: String(res.id || '') });
fs.writeFileSync(f, JSON.stringify(d, null, 2) + '\n'); console.log('Posted.', res);
