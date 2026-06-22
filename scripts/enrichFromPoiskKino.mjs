import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const MEDIA_FILE = join(ROOT, 'src', 'data', 'enrichedMedia.ts');
const CACHE_FILE = join(ROOT, 'scripts', 'poiskkino-cache.json');
const API = 'https://api.poiskkino.dev/v1.4/movie/search';
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function readEnv() {
  const env = { ...process.env };
  const file = join(ROOT, '.env');
  if (!existsSync(file)) return env;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const index = line.indexOf('=');
    if (index > 0) env[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return env;
}

function readMedia() {
  const source = readFileSync(MEDIA_FILE, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(source.match(/export const enrichedMedia: MediaItem\[] = ([\s\S]*);\s*$/)[1]);
}

function writeMedia(items) {
  writeFileSync(MEDIA_FILE, `import type { MediaItem } from '../types';\n\nexport const enrichedMedia: MediaItem[] = ${JSON.stringify(items, null, 2)};\n`, 'utf8');
}

function readCache() {
  if (!existsSync(CACHE_FILE)) return {};
  try { return JSON.parse(readFileSync(CACHE_FILE, 'utf8')); } catch { return {}; }
}

function saveCache(cache) {
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
}

function normalize(value = '') {
  return String(value).toLowerCase().replaceAll('ё', 'е').replace(/[^a-zа-я0-9]+/gi, ' ').trim();
}

function isGenerated(url = '') {
  return String(url).startsWith('data:image/svg+xml');
}

function cleanQuery(title) {
  return title.replace(/:.*$/g, '').replace(/\s*\(.+?\)/g, '').trim();
}

function isTypeCompatible(item, movie) {
  if (item.type === 'show') return movie.type === 'tv-show' || movie.type === 'tv-series';
  if (item.type === 'series') return movie.isSeries || movie.type === 'tv-series' || movie.type === 'animated-series';
  if (item.type === 'anime') return ['anime', 'animated-series'].includes(movie.type);
  if (item.type === 'cartoon') return ['cartoon', 'animated-series'].includes(movie.type) || (movie.genres || []).some((genre) => genre.name === 'мультфильм');
  return !movie.isSeries && movie.type !== 'tv-series' && movie.type !== 'animated-series' && movie.type !== 'tv-show';
}

function score(item, movie) {
  if (!isTypeCompatible(item, movie)) return -1000;
  if (item.year && movie.year && Math.abs(Number(movie.year) - Number(item.year)) > 2) return -500;
  const query = normalize(item.titleRu);
  const original = normalize(item.titleOriginal || '');
  const names = [movie.name, movie.alternativeName, movie.enName, ...(movie.names || []).map((entry) => entry.name)].filter(Boolean).map(normalize);
  let value = 0;
  if (names.includes(query)) value += 100;
  if (original && names.includes(original)) value += 45;
  if (names.some((name) => name.includes(query) || query.includes(name))) value += 28;
  if (item.year && Number(movie.year) === Number(item.year)) value += 30;
  if (movie.poster?.url) value += 20;
  if (movie.description) value += 8;
  if (movie.rating?.kp || movie.rating?.imdb) value += 5;
  if (item.type === 'series' && movie.isSeries) value += 20;
  if (item.type !== 'series' && !movie.isSeries) value += 8;
  return value;
}

function pickBest(item, docs = []) {
  const best = docs.map((movie) => ({ movie, score: score(item, movie) })).sort((a, b) => b.score - a.score)[0];
  if (!best || best.score < 58) return null;
  return best.movie;
}

async function search(item, cache, key) {
  const cacheKey = `${item.titleRu}::${item.year || ''}`;
  if (!(cacheKey in cache)) {
    const url = `${API}?query=${encodeURIComponent(cleanQuery(item.titleRu))}&limit=10`;
    const response = await fetch(url, { headers: { 'X-API-KEY': key } });
    if (!response.ok) throw new Error(`PoiskKino ${response.status}`);
    cache[cacheKey] = await response.json();
    await delay(220);
  }
  return pickBest(item, cache[cacheKey].docs || []);
}

function n(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Number(number.toFixed(1)) : undefined;
}

function apply(item, movie) {
  if (!movie) return false;
  const before = JSON.stringify(item);
  item.titleRu = movie.name || item.titleRu;
  item.titleOriginal = movie.alternativeName || item.titleOriginal || item.titleRu;
  item.year = movie.year || item.year;
  if (!item.posterUrl || isGenerated(item.posterUrl)) item.posterUrl = movie.poster?.url || item.posterUrl || '';
  if (!item.backdropUrl || isGenerated(item.backdropUrl)) item.backdropUrl = movie.backdrop?.url || movie.poster?.url || item.backdropUrl || item.posterUrl;
  item.description = movie.description || movie.shortDescription || item.description;
  item.genres = movie.genres?.length ? movie.genres.map((genre) => genre.name || genre).filter(Boolean) : item.genres;
  item.countries = movie.countries?.length ? movie.countries.map((country) => country.name || country).filter(Boolean) : item.countries;
  item.kinopoiskId = movie.id || item.kinopoiskId;
  item.imdbId = movie.externalId?.imdb || item.imdbId;
  item.tmdbId = movie.externalId?.tmdb || item.tmdbId;
  item.kinopoiskRating = n(movie.rating?.kp) || item.kinopoiskRating;
  item.imdbRating = n(movie.rating?.imdb) || item.imdbRating;
  return JSON.stringify(item) !== before;
}

async function main() {
  const env = readEnv();
  const key = env.POISKKINO_API_KEY || env.KINOPOISK_API_KEY;
  if (!key) throw new Error('Нет POISKKINO_API_KEY');
  const items = readMedia();
  const cache = readCache();
  const targets = items.filter((item) => isGenerated(item.posterUrl)).concat(items.filter((item) => !isGenerated(item.posterUrl) && (!item.kinopoiskId || !item.imdbId || !item.tmdbId))); 
  let processed = 0, found = 0, changed = 0, replacedPosters = 0;
  for (const item of targets) {
    const wasGenerated = isGenerated(item.posterUrl);
    try {
      const movie = await search(item, cache, key);
      processed++;
      if (movie) found++;
      if (apply(item, movie)) changed++;
      if (wasGenerated && !isGenerated(item.posterUrl)) replacedPosters++;
      if (processed % 20 === 0) {
        saveCache(cache);
        writeMedia(items);
        console.log(`Обработано ${processed}/${targets.length}, найдено ${found}, заменено постеров ${replacedPosters}`);
      }
    } catch (error) {
      console.log(`Остановка на ${item.titleRu}: ${error.message}`);
      break;
    }
  }
  saveCache(cache);
  writeMedia(items);
  console.log(JSON.stringify({ targets: targets.length, processed, found, changed, replacedPosters }, null, 2));
}

main().catch((error) => { console.error(error); process.exit(1); });
