// Lightweight i18n for the static build. Zero dependencies.
// Layout of /locales:
//   <lang>/ui.json              interface strings ("key": "text with {vars}" or plural arrays)
//   <lang>/terms/*.json         English -> translation dictionaries for repeated content phrases (facilities, captions, places...)
//   <lang>/projects/<slug>.json per-project text overlay (description, shortDescription, seoTitle, ...)
//   <lang>/properties/<rent|sale>/<slug>.json  per-listing text overlay
// English is the source language: /content/*.json stay English; other languages only add text.
import fs from 'node:fs';
import path from 'node:path';

export const LANGS = ['en', 'ru'];
export const DEFAULT_LANG = 'en';
export const LANG_META = {
  en: { code: 'EN', name: 'English', htmlLang: 'en', hreflang: 'en', ogLocale: 'en_US', prefix: '', intl: 'en-US', flag: 'gb' },
  ru: { code: 'RU', name: 'Русский', htmlLang: 'ru', hreflang: 'ru', ogLocale: 'ru_RU', prefix: '/ru', intl: 'ru-RU', flag: 'ru' },
};

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const readDirJson = (dir) => {
  const out = {};
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) out[f.replace(/\.json$/, '')] = readJson(path.join(dir, f));
  return out;
};

/* ---------- plural rules ---------- */
const pluralIdx = {
  en: (n) => (n === 1 ? 0 : 1),
  ru: (n) => { const a = Math.abs(n) % 100, b = a % 10; if (a > 10 && a < 20) return 2; if (b > 1 && b < 5) return 1; return b === 1 ? 0 : 2; },
};

/* ---------- Russian pattern translators (for repeated structured strings) ---------- */
const bedWord = (n) => { const a = n % 100, b = n % 10; return a > 10 && a < 20 ? 'спален' : b === 1 ? 'спальня' : b > 1 && b < 5 ? 'спальни' : 'спален'; };

const DIST_RULES = [
  [/\(sources differ\)/g, '(данные источников расходятся)'],
  [/\(description\) \/ \(FAQ\)/g, '(описание) / (FAQ)'],
  [/\(description\)/g, '(описание)'],
  [/\bper one portal\b/g, 'по данным одного из порталов'],
  [/\bper developer presentation\b/g, 'по презентации застройщика'],
  [/\(Aster of Asia listing\)/g, '(объявление Aster of Asia)'],
  [/\(Aster of Asia text\)/g, '(текст Aster of Asia)'],
  [/\bNearby \(no distance published\)/g, 'Рядом (расстояние не указано)'],
  [/\bNear, within Laguna Phuket\b/g, 'Рядом, в пределах Laguna Phuket'],
  [/\bBeachfront \(Laguna Phuket\)/g, 'На первой линии (Laguna Phuket)'],
  [/\bshort walk\b/g, 'недалеко, пешком'],
  [/\bwalking distance\b/g, 'в пешей доступности'],
  [/\bnext door\b/g, 'по соседству'],
  [/\bBeachfront\b/g, 'На первой линии'],
  [/\bNear\b/g, 'Рядом'],
  [/\bwithin\b/g, 'в пределах'],
  [/\bstraight-line\b/g, 'по прямой'],
  [/\bby car\b/g, 'на машине'],
  [/\b(\d+(?:[.,]\d+)?) ?(?:min|minutes?) walk\b/g, '$1 мин пешком'],
  [/\bwalk\b/g, 'пешком'],
  [/\bnorth\b/g, 'к северу'],
  [/\bsouth\b/g, 'к югу'],
  [/\babout\b/g, 'около'],
  [/\bvs\b/g, 'против'],
  [/\bminutes?\b/g, 'мин'],
  [/\bmin\b/g, 'мин'],
  [/(\d)\.(\d)/g, '$1,$2'],
  [/\bkm\b/g, 'км'],
  [/(\d) ?m\b/g, '$1 м'],
  [/(\d)-(\d)/g, '$1–$2'],
];
const ruDist = (s) => DIST_RULES.reduce((r, [re, to]) => r.replace(re, to), s);

const UNIT_WORDS = [
  [/\bPool Villa\b/gi, 'вилла с бассейном'], [/\bVilla\b/gi, 'вилла'], [/\bTownhouse\b/gi, 'таунхаус'], [/\bDuplex\b/gi, 'дуплекс'],
  [/\bPenthouse\b/gi, 'пентхаус'], [/\bStudio\b/gi, 'студия'], [/\bMulti-Flex House\b/gi, 'дом Multi-Flex'], [/\bpool access\b/gi, 'с доступом к бассейну'],
  [/\bgarden\/pool view\b/gi, 'вид на сад и бассейн'], [/\bmountain view\b/gi, 'вид на горы'], [/\bgarden view\b/gi, 'вид на сад'], [/\bpool view\b/gi, 'вид на бассейн'],
  [/\bprivate pool\b/gi, 'с частным бассейном'], [/\bcourtyard-facing\b/gi, 'окна во двор'], [/\bwith garden access\b/gi, 'с выходом в сад'],
  [/\bground floor\b/gi, 'первый этаж'], [/\bfloor (\d+)\b/gi, '$1 этаж'], [/\blarge plot\b/gi, 'большой участок'], [/\bWaterfront\b/gi, 'у воды'],
  [/\bLuxury\b/gi, 'люкс'], [/\bSuper Luxury\b/gi, 'супер-люкс'], [/\bStandard\b/gi, 'стандарт'], [/\bDeluxe\b/gi, 'делюкс'], [/\bTypical\b/gi, 'типовая'],
  [/\blisted as 4 beds\b/gi, 'указана как 4 спальни'], [/\blisting\b/gi, 'объявление'],
  [/\boffice space\b/gi, 'с рабочим кабинетом'], [/\bportal listing\b/gi, 'объявление на портале'], [/\bBuilding\b/gi, 'корпус'], [/\bZone\b/gi, 'зона'],
  [/\b2-storey townhouse\b/gi, '2-этажный таунхаус'], [/\blikely a larger\/penthouse unit\b/gi, 'вероятно, более крупный юнит или пентхаус'],
  [/\bunit (\d+)\b/gi, '№ $1'], [/\bType ([A-Z]\d?)\b/g, 'тип $1'], [/\bPlus\b/g, 'Plus'], [/\bUnit (\d+)\b/g, 'Юнит № $1'], [/\bChapter\b/g, 'Chapter'],
];
function ruUnit(s) {
  let r = s, beds = '';
  r = r.replace(/\b(\d)\s?(?:BR|bedrooms?)\b/i, (_, n) => { beds = `${n} ${bedWord(+n)}`; return ''; });
  if (!beds && /^(\d)B$/.test(s)) return s; // unit codes such as 2B stay as they are
  UNIT_WORDS.forEach(([re, to]) => { r = r.replace(re, to); });
  r = r.replace(/\s+/g, ' ').replace(/\s+,/g, ',').trim().replace(/^[,/ ]+|[,/ ]+$/g, '');
  const type = (r.match(/(?:^|\s)(тип [A-Z]\d?)/) || [])[1];
  if (type && beds) r = r.replace(type, '').replace(/\s+/g, ' ').trim();
  const rest = r.replace(/\(\s*\)/g, '').trim();
  let out = beds ? (rest ? (rest.startsWith('(') ? `${beds} ${rest}` : `${beds}, ${rest}`) : beds) : rest;
  if (type && beds) out += ` (${type})`;
  out = out || s;
  return out.charAt(0).toUpperCase() + out.slice(1);
}

const MONTHS = { Jan: 'январь', Feb: 'февраль', Mar: 'март', Apr: 'апрель', May: 'май', Jun: 'июнь', Jul: 'июль', Aug: 'август', Sep: 'сентябрь', Oct: 'октябрь', Nov: 'ноябрь', Dec: 'декабрь' };
const FURN = { 'fully furnished': 'полностью с мебелью', 'partly furnished': 'частично с мебелью', unfurnished: 'без мебели' };
const ruPl = (n, f) => { const a = n % 100, b = n % 10; return a > 10 && a < 20 ? f[2] : b === 1 ? f[0] : b > 1 && b < 5 ? f[1] : f[2]; };
// Generic caption patterns ("<Project> photo 3", "Brochure page 14").
const PATTERNS = [
  [/^(.+?) (?:photo|gallery(?: image)?) (\d+)$/, (m) => `${m[1]}, фото ${m[2]}`],
  [/^(.+?) gallery (\d+)$/, (m) => `${m[1]}, фото ${m[2]}`],
  [/^Brochure page (\d+)(?: \(unverified content; may include text\))?$/, (m) => `Страница брошюры ${m[1]}${/unverified/.test(m.input) ? ' (содержание не проверено, возможен текст)' : ''}`],
  [/^Exterior (\d+)$/, (m) => `Фасад ${m[1]}`],
  [/^([A-Z][a-z]{2}) (\d{4}) \(agent listings\)$/, (m) => `${MONTHS[m[1]] || m[1]} ${m[2]} (по объявлениям агентов)`],
  [/^Parking ratio (\d+)% of units$/, (m) => `Парковка: ${m[1]}% от числа юнитов`],
  [/^Varies by unit: (.+)$/, (m) => `Зависит от юнита: ${m[1].split(', ').map((x) => FURN[x] || x).join(', ')}`],
  [/^(\d+) buildings, (\d+) storeys each$/, (m) => `${m[1]} ${ruPl(+m[1], ['корпус', 'корпуса', 'корпусов'])} по ${m[2]} ${ruPl(+m[2], ['этаж', 'этажа', 'этажей'])}`],
  [/^Bedroom (\d+)$/, (m) => `Спальня ${m[1]}`],
  [/^Living (\d+)$/, (m) => `Гостиная ${m[1]}`],
  [/^Aerial view (\d+)$/, (m) => `Вид с высоты птичьего полёта ${m[1]}`],
];
const QUARTER = /^Q([1-4]) (\d{4})(.*)$/;
function ruQuarter(s) {
  const m = s.match(QUARTER);
  if (!m) return null;
  return `${m[1]} кв. ${m[2]}${m[3].replace('(advertised, not confirmed by developer)', '(по рекламным данным, застройщиком не подтверждено)').replace('(agent listings)', '(по объявлениям агентов)')}`;
}

/* ---------- loader ---------- */
export function loadLanguage(ROOT, lang) {
  const base = path.join(ROOT, 'locales', lang);
  const ui = fs.existsSync(path.join(base, 'ui.json')) ? readJson(path.join(base, 'ui.json')) : {};
  const terms = {};
  Object.values(readDirJson(path.join(base, 'terms'))).forEach((d) => Object.assign(terms, d));
  const termsLc = new Map(Object.entries(terms).map(([k, v]) => [k.toLowerCase(), v]));
  const over = { projects: readDirJson(path.join(base, 'projects')), rent: readDirJson(path.join(base, 'properties/rent')), sale: readDirJson(path.join(base, 'properties/sale')), locations: readDirJson(path.join(base, 'locations')), guides: readDirJson(path.join(base, 'guides')) };
  const missing = new Map(); // English string -> where it was needed
  const meta = LANG_META[lang];
  const isEn = lang === 'en';

  const fmtNum = (n) => new Intl.NumberFormat(meta.intl).format(n);
  const L = {
    lang, meta, ui, terms, over, missing,
    t(key, vars = {}) {
      let v = ui[key];
      if (v === undefined) throw new Error(`i18n: missing UI key "${key}" for ${lang}`);
      if (Array.isArray(v)) v = v[Math.min(pluralIdx[lang](vars.n ?? 0), v.length - 1)];
      return String(v).replace(/\{(\w+)\}/g, (_, k) => (vars[k] === undefined ? `{${k}}` : vars[k]));
    },
    has: (key) => ui[key] !== undefined,
    fmtNum,
    // Translate a content phrase (English source) via dictionary, then patterns; falls back to the English text and records it.
    tx(s, where = '') {
      if (isEn || s === undefined || s === null || s === '') return s;
      const str = String(s);
      if (terms[str] !== undefined) return /^[A-Z]/.test(str) ? terms[str].charAt(0).toUpperCase() + terms[str].slice(1) : terms[str];
      const lc = termsLc.get(str.toLowerCase());
      if (lc !== undefined) return /^[A-ZА-Я]/.test(str) ? lc.charAt(0).toUpperCase() + lc.slice(1) : lc;
      const q = ruQuarter(str);
      if (q) return q;
      for (const [re, fn] of PATTERNS) { const m = str.match(re); if (m) return fn(m); }
      if (!/[A-Za-z]{2,}/.test(str)) return str; // numbers only
      missing.set(str, where);
      return str;
    },
    dist(s) { if (isEn || !s) return s; return terms[s] !== undefined ? terms[s] : ruDist(String(s)); },
    unit(s) { if (isEn || !s) return s; return terms[s] !== undefined ? terms[s] : ruUnit(String(s)); },
    sqm: (v) => `${v} ${isEn ? 'sqm' : 'м²'}`,
    money(v, cur = 'THB') {
      const n = Number(v);
      if (isEn) return cur === 'THB' ? `฿${fmtNum(n)}` : cur === 'USD' ? `$${fmtNum(n)}` : `${fmtNum(n)} ${cur}`;
      return `${fmtNum(n)} ${cur === 'THB' ? '฿' : cur === 'USD' ? '$' : cur}`;
    },
    date(d) {
      if (!d || isNaN(Date.parse(d))) return '';
      if (isEn) return new Date(d).toISOString().slice(0, 10);
      return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(d));
    },
    plural: (n, forms) => forms[Math.min(pluralIdx[lang](n), forms.length - 1)],
  };
  return L;
}
