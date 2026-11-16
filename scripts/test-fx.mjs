// Run: node scripts/test-fx.mjs   (no network; fetch/localStorage/DOM are stubbed)
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const mem = {}; const ls = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = v; } };
globalThis.localStorage = ls;
let calls = 0, mode = 'ok';
globalThis.fetch = async (url) => {
  calls++;
  if (mode === 'fail') throw new Error('network');
  if (mode === '429') return { ok: false, status: 429 };
  if (mode === 'bad') return { ok: true, json: async () => ({ rate: 'abc' }) };
  if (mode === 'frankfurter-down' && url.includes('frankfurter')) throw new Error('down');
  if (url.includes('frankfurter')) return { ok: true, json: async () => ({ date: '2026-11-16', rate: 28.55 }) };
  return { ok: true, json: async () => ({ result: 'success', rates: { THB: 28.6 }, time_last_update_utc: 'x' }) };
};
require('../js/fx.js'); const fx = globalThis.NDFX;
const el = (thb, prefix) => ({ attrs: { 'data-thb': thb, ...(prefix ? { 'data-prefix': prefix } : {}) }, textContent: 'x', getAttribute(k) { return this.attrs[k] ?? null; } });
const doc = (els) => ({ querySelectorAll: (s) => (s === '[data-thb]' ? els : []), querySelector: () => els[0] });
let n = 0; const t = (name, f) => f().then(() => console.log('ok  ', name)).catch((e) => { console.log('FAIL', name, e.message); n++; });
const reset = () => { for (const k of Object.keys(mem)) delete mem[k]; calls = 0; mode = 'ok'; };

// pure conversion + formatting
for (const [thb, usd] of [[5e6, '$175,000'], [1e7, '$350,000'], [22840000, '$800,000'], [5e7, '$1,751,000'], [1e8, '$3,503,000']])
  await t(`convert ${thb} @28.55 = ${usd}`, async () => assert.equal(fx.formatUsd(fx.convert(thb, 28.55)), usd));
await t('decimal / string input', async () => { assert.equal(fx.formatUsd(fx.convert('1,234,567.89', 30)), '$41,200'); });
await t('missing price -> null', async () => { for (const v of [null, undefined, '', 0, -5, 'abc', NaN]) assert.equal(fx.convert(v, 30), null); });
await t('invalid rate -> null', async () => { for (const r of [0, -1, NaN, null, undefined, 'x', 1e9, 0.5]) assert.equal(fx.convert(1e7, r), null); });
await t('formatUsd never NaN/0', async () => { for (const v of [NaN, 0, -1, null, 0.001, Infinity]) assert.equal(fx.formatUsd(v), ''); });

// rate service
await t('API success + cached + single in-flight', async () => {
  reset(); const [a, b, c] = await Promise.all([fx.getRate(), fx.getRate(), fx.getRate()]);
  assert.equal(a.rate, 28.55); assert.equal(calls, 1); await fx.getRate(); assert.equal(calls, 1);
});
await t('fallback provider when primary down', async () => { reset(); mode = 'frankfurter-down'; assert.equal((await fx.getRate()).rate, 28.6); });
await t('API failure, no cache -> null', async () => { reset(); mode = 'fail'; assert.equal(await fx.getRate(), null); });
await t('rate limit 429 -> null', async () => { reset(); mode = '429'; assert.equal(await fx.getRate(), null); });
await t('invalid response -> null', async () => { reset(); mode = 'bad'; assert.equal(await fx.getRate(), null); });
await t('expired cache + API ok -> refetch', async () => {
  reset(); mem[fx.config.key] = JSON.stringify({ rate: 30, fetchedAt: Date.now() - 7 * 3600e3, provider: 'old' });
  assert.equal((await fx.getRate()).rate, 28.55); assert.equal(calls, 1);
});
await t('stale cache (<72h) + API down -> cached fallback', async () => {
  reset(); mode = 'fail'; mem[fx.config.key] = JSON.stringify({ rate: 30, fetchedAt: Date.now() - 24 * 3600e3, provider: 'old' });
  assert.equal((await fx.getRate()).rate, 30);
});
await t('too-old cache (>72h) + API down -> null', async () => {
  reset(); mode = 'fail'; mem[fx.config.key] = JSON.stringify({ rate: 30, fetchedAt: Date.now() - 100 * 3600e3, provider: 'old' });
  assert.equal(await fx.getRate(), null);
});
await t('corrupt cache ignored', async () => { reset(); mem[fx.config.key] = '{oops'; assert.equal((await fx.getRate()).rate, 28.55); });

// DOM rendering
await t('render: prefix, missing price, no rate', async () => {
  const els = [el('22840000', 'From '), el(''), el('5000000')];
  fx.render(doc(els), { rate: 28.55, provider: 'p', fetchedAt: Date.now() });
  assert.equal(els[0].textContent, 'From $800,000 USD'); assert.equal(els[1].textContent, ''); assert.equal(els[2].textContent, 'Approx. $175,000 USD');
  fx.render(doc(els), null); assert.ok(els.every((e) => e.textContent === ''));
});
await t('init end-to-end', async () => { reset(); const els = [el('22840000', 'From ')]; const d = doc(els); await fx.init(d); assert.equal(els[0].textContent, 'From $800,000 USD'); });
await t('init with API down leaves THB only', async () => { reset(); mode = 'fail'; const els = [el('22840000', 'From ')]; await fx.init(doc(els)); assert.equal(els[0].textContent, ''); });

console.log(n ? `${n} FAILED` : 'ALL PASSED'); process.exit(n ? 1 : 0);
