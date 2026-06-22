import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const MEDIA_FILE = join(ROOT, 'src', 'data', 'enrichedMedia.ts');
const CACHE_FILE = join(ROOT, 'scripts', 'kinopoisk-unofficial-cache.json');
const API_BASE = 'https://kinopoiskapiunofficial.tech/api';
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function readEnv() {
  const env = { ...process.env };
  const file = join(ROOT, '.env');
  if (!existsSync(file)) return env;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const index = trimmed.indexOf('=');
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1).replace(/^['"]|['"]$/g, '');
  }
  return env;
}

function readMedia() {
  const source = readFileSync(MEDIA_FILE, 'utf8').replace(/^\uFEFF/, '');
  const match = source.match(/export const enrichedMedia: MediaItem\[] = ([\s\S]*);\s*$/);
  if (!match) throw new Error('Не удалось разобрать enrichedMedia.ts');
  return JSON.parse(match[1]);
}

function writeMedia(items) {
  writeFileSync(MEDIA_FILE, `import type { MediaItem } from '../types';\n\nexport const enrichedMedia: MediaItem[] = ${JSON.stringify(items, null, 2)};\n`, 'utf8');
}

function readCache() {
  if (!existsSync(CACHE_FILE)) return { search: {}, details: {} };
  try {
    return JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
  } catch {
    return { search: {}, details: {} };
  }
}

function saveCache(cache) {
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
}

function normalize(value = '') {
  return String(value)
    .toLowerCase()
    .replaceAll('ё', 'е')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .trim();
}

function numberOrUndefined(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function isGeneratedPoster(url = '') {
  return String(url).startsWith('data:image/svg+xml');
}

function isMissingData(item) {
  return !item.posterUrl || isGeneratedPoster(item.posterUrl) || !item.description || !item.year || !item.kinopoiskRating || !item.imdbRating || !item.kinopoiskId || !item.imdbId;
}

function typeScore(item, candidate) {
  const type = candidate.type || '';
  if (item.type === 'series' && ['TV_SERIES', 'MINI_SERIES'].includes(type)) return 25;
  if (item.type === 'show' && type === 'TV_SHOW') return 25;
  if (['movie', 'cartoon', 'anime'].includes(item.type) && type === 'FILM') return 18;
  return 0;
}

function scoreCandidate(item, candidate) {
  const query = normalize(item.titleRu);
  const original = normalize(item.titleOriginal);
  const names = [candidate.nameRu, candidate.nameEn, candidate.nameOriginal]
    .filter(Boolean)
    .map(normalize);
  let score = 0;
  if (names.includes(query)) score += 90;
  if (original && names.includes(original)) score += 35;
  if (names.some((name) => name.includes(query) || query.includes(name))) score += 20;
  if (item.year && Number(candidate.year) === Number(item.year)) score += 25;
  if (candidate.posterUrl) score += 8;
  if (candidate.description) score += 6;
  score += typeScore(item, candidate);
  return score;
}

function pickBest(item, films = []) {
  const scored = films
    .map((candidate) => ({ candidate, score: scoreCandidate(item, candidate) }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best || best.score < 55) return null;
  return best.candidate;
}

async function apiGet(path, apiKey) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
  });
  if (response.status === 402 || response.status === 429) {
    throw new Error(`Лимит API или слишком много запросов: ${response.status}`);
  }
  if (!response.ok) throw new Error(`Kinopoisk API ${response.status}`);
  return response.json();
}

async function searchItem(item, cache, apiKey) {
  const searchKey = `${item.titleRu}::${item.type}::${item.year || ''}`;
  if (!(searchKey in cache.search)) {
    cache.search[searchKey] = await apiGet(`/v2.1/films/search-by-keyword?keyword=${encodeURIComponent(item.titleRu)}&page=1`, apiKey);
    await delay(180);
  }
  const best = pickBest(item, cache.search[searchKey].films || []);
  if (!best?.filmId) return null;
  const detailKey = String(best.filmId);
  if (!(detailKey in cache.details)) {
    cache.details[detailKey] = await apiGet(`/v2.2/films/${best.filmId}`, apiKey);
    await delay(180);
  }
  return cache.details[detailKey];
}

function applyDetails(item, details) {
  if (!details) return false;
  const before = JSON.stringify(item);
  item.titleRu = details.nameRu || item.titleRu;
  item.titleOriginal = details.nameOriginal || details.nameEn || item.titleOriginal || item.titleRu;
  item.year = numberOrUndefined(details.year) || item.year;
  if (!item.posterUrl || isGeneratedPoster(item.posterUrl)) item.posterUrl = details.posterUrl || item.posterUrl || '';
  if (!item.backdropUrl || isGeneratedPoster(item.backdropUrl)) item.backdropUrl = details.coverUrl || item.posterUrl || '';
  item.description = item.description || details.description || details.shortDescription || '';
  item.genres = details.genres?.length ? details.genres.map((genre) => genre.genre).filter(Boolean) : item.genres;
  item.countries = details.countries?.length ? details.countries.map((country) => country.country).filter(Boolean) : item.countries;
  item.kinopoiskId = details.kinopoiskId || item.kinopoiskId;
  item.imdbId = details.imdbId || item.imdbId;
  item.kinopoiskRating = numberOrUndefined(details.ratingKinopoisk) || item.kinopoiskRating;
  item.imdbRating = numberOrUndefined(details.ratingImdb) || item.imdbRating;
  return JSON.stringify(item) !== before;
}

async function main() {
  const env = readEnv();
  const apiKey = env.KINOPOISK_UNOFFICIAL_API_KEY;
  if (!apiKey) {
    console.error('Нет KINOPOISK_UNOFFICIAL_API_KEY в .env');
    process.exit(1);
  }

  const items = readMedia();
  const cache = readCache();
  cache.search ||= {};
  cache.details ||= {};

  const max = Number(process.env.MAX_ITEMS || process.argv.find((arg) => arg.startsWith('--max='))?.split('=')[1] || 600);
  const targets = items.filter(isMissingData).slice(0, max);
  let found = 0;
  let changed = 0;
  let processed = 0;

  for (const item of targets) {
    processed++;
    try {
      const details = await searchItem(item, cache, apiKey);
      if (details) found++;
      if (applyDetails(item, details)) changed++;
      if (processed % 10 === 0) {
        saveCache(cache);
        writeMedia(items);
        console.log(`Обработано ${processed}/${targets.length}, найдено ${found}, обновлено ${changed}`);
      }
    } catch (error) {
      console.log(`Остановка на "${item.titleRu}": ${error.message}`);
      break;
    }
  }

  saveCache(cache);
  writeMedia(items);
  console.log(JSON.stringify({ targets: targets.length, processed, found, changed }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
