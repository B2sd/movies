import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const FETCH_FILE = join(ROOT, 'scripts', 'fetchMedia.mjs');
const CACHE_FILE = join(ROOT, 'scripts', 'kp-cache.json');
const OUTPUT_FILE = join(ROOT, 'src', 'data', 'enrichedMedia.ts');

function normalizeText(value = '') {
  return String(value).toLowerCase().replaceAll('ё', 'е').replace(/[^a-zа-я0-9]+/gi, ' ').trim();
}

function slugify(title) {
  return title.toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-').replace(/^-|-$/g, '');
}

const fetchSource = readFileSync(FETCH_FILE, 'utf8');
const start = fetchSource.indexOf('const seriesSet = new Set');
const end = fetchSource.indexOf('async function searchKP');
if (start === -1 || end === -1) throw new Error('Cannot extract title data from fetchMedia.mjs');

const extracted = fetchSource.slice(start, end)
  .replace('const allTitles =', 'exports.allTitles =')
  .replace('function detectType', 'exports.detectType = function detectType');
const exportsObject = {};
Function('exports', `${extracted}; return exports;`)(exportsObject);

const allTitles = [...new Set(exportsObject.allTitles)];
const detectType = exportsObject.detectType;
const cache = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));

function isSafeMatch(title, kp) {
  if (!kp) return false;
  const query = normalizeText(title);
  const names = [kp.name, kp.alternativeName, kp.enName, ...(kp.names || []).map((entry) => entry.name)]
    .filter(Boolean)
    .map(normalizeText);
  return names.some((name) => name === query);
}

function getCache(title, type) {
  const value = cache[`${title}::${type}`];
  if (!value || value === '__NOT_FOUND__') return null;
  return isSafeMatch(title, value) ? value : null;
}

function fallbackGenre(type) {
  if (type === 'series') return 'сериал';
  if (type === 'anime') return 'аниме';
  if (type === 'cartoon') return 'мультфильм';
  if (type === 'show') return 'шоу';
  return 'фильм';
}

function buildMediaItem(title, type, kp, index) {
  const posterUrl = kp?.poster?.url || '';
  const backdropUrl = kp?.backdrop?.url || posterUrl;
  const description = kp?.description || kp?.shortDescription || '';
  const genres = (kp?.genres || []).map((genre) => genre.name || genre).filter(Boolean);
  const safeSameName = kp && normalizeText(kp.name) === normalizeText(title);

  return {
    id: `media-${slugify(title)}-${index}`,
    titleRu: safeSameName ? kp.name : title,
    titleOriginal: kp?.alternativeName || kp?.enName || title,
    type,
    year: kp?.year || undefined,
    posterUrl,
    backdropUrl,
    description,
    genres: genres.length ? genres : [fallbackGenre(type)],
    guestVotes: 0,
    myReview: '',
    addedAt: new Date(Date.UTC(2026, 5, 21, 12, 0, index)).toISOString(),
    kinopoiskId: kp?.id,
    imdbId: kp?.externalId?.imdb,
    kinopoiskRating: kp?.rating?.kp ? Number(kp.rating.kp.toFixed(1)) : undefined,
    imdbRating: kp?.rating?.imdb ? Number(kp.rating.imdb.toFixed(1)) : undefined,
  };
}

let cacheHits = 0;
let unsafeSkipped = 0;
const items = allTitles.map((title, index) => {
  const type = detectType(title);
  const raw = cache[`${title}::${type}`];
  const kp = getCache(title, type);
  if (kp) cacheHits++;
  else if (raw && raw !== '__NOT_FOUND__') unsafeSkipped++;
  return buildMediaItem(title, type, kp, index);
});

const deduped = [];
const seen = new Set();
const removed = [];
for (const item of items) {
  const key = normalizeText(item.titleRu);
  if (seen.has(key)) {
    removed.push(item.titleRu);
    continue;
  }
  seen.add(key);
  deduped.push(item);
}

const output = `import type { MediaItem } from '../types';\n\nexport const enrichedMedia: MediaItem[] = ${JSON.stringify(deduped, null, 2)};\n`;
writeFileSync(OUTPUT_FILE, output, 'utf8');
console.log(JSON.stringify({ titles: allTitles.length, cacheHits, unsafeSkipped, final: deduped.length, removedDuplicateCount: removed.length, removedDuplicateSamples: removed.slice(0, 20) }, null, 2));
