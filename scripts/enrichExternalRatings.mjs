import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const MEDIA_FILE = join(ROOT, 'src', 'data', 'enrichedMedia.ts');
const CACHE_FILE = join(ROOT, 'scripts', 'kp-cache.json');

function normalizeText(value = '') {
  return String(value).toLowerCase().replaceAll('ё', 'е').replace(/[^a-zа-я0-9]+/gi, ' ').trim();
}

function readMedia() {
  const source = readFileSync(MEDIA_FILE, 'utf8').replace(/^\uFEFF/, '');
  const match = source.match(/export const enrichedMedia: MediaItem\[] = ([\s\S]*);\s*$/);
  if (!match) throw new Error('Cannot parse enrichedMedia.ts');
  return JSON.parse(match[1]);
}

function makeIndex(cache) {
  const index = new Map();
  for (const [key, value] of Object.entries(cache)) {
    if (!value || value === '__NOT_FOUND__') continue;
    const [title, type] = key.split('::');
    const names = [title, value.name, value.alternativeName, value.enName, ...(value.names || []).map((entry) => entry.name)].filter(Boolean);
    for (const name of names) index.set(`${normalizeText(name)}::${type}`, value);
  }
  return index;
}

const cache = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
const index = makeIndex(cache);
const items = readMedia();
let removedPersonalRatings = 0;
let ratingHits = 0;
let descriptionHits = 0;

for (const item of items) {
  if ('myRating' in item) {
    delete item.myRating;
    removedPersonalRatings++;
  }

  const kp = index.get(`${normalizeText(item.titleRu)}::${item.type}`);
  if (!kp) continue;

  if (!item.posterUrl && kp.poster?.url) item.posterUrl = kp.poster.url;
  if (!item.backdropUrl && (kp.backdrop?.url || kp.poster?.url)) item.backdropUrl = kp.backdrop?.url || kp.poster.url;
  if (!item.description && (kp.description || kp.shortDescription)) {
    item.description = kp.description || kp.shortDescription;
    descriptionHits++;
  }
  if (!item.year && kp.year) item.year = kp.year;
  if ((!item.genres || item.genres.length <= 1) && kp.genres?.length) item.genres = kp.genres.map((genre) => genre.name || genre).filter(Boolean);
  if (kp.id && !item.kinopoiskId) item.kinopoiskId = kp.id;
  if (kp.externalId?.imdb && !item.imdbId) item.imdbId = kp.externalId.imdb;
  if (kp.externalId?.tmdb && !item.tmdbId) item.tmdbId = kp.externalId.tmdb;
  if (kp.rating?.kp) item.kinopoiskRating = Number(kp.rating.kp.toFixed(1));
  if (kp.rating?.imdb) item.imdbRating = Number(kp.rating.imdb.toFixed(1));
  if (kp.rating?.kp || kp.rating?.imdb) ratingHits++;
}

writeFileSync(MEDIA_FILE, `import type { MediaItem } from '../types';\n\nexport const enrichedMedia: MediaItem[] = ${JSON.stringify(items, null, 2)};\n`, 'utf8');
console.log(JSON.stringify({ items: items.length, removedPersonalRatings, ratingHits, descriptionHits }, null, 2));
