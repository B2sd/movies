import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const MEDIA_FILE = join(ROOT, 'src', 'data', 'enrichedMedia.ts');
const CACHE_FILE = join(ROOT, 'scripts', 'kinopoisk-unofficial-cache.json');

function normalize(value = '') {
  return String(value).toLowerCase().replaceAll('ё', 'е').replace(/[^a-zа-я0-9]+/gi, ' ').trim();
}

function numberOrUndefined(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
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
  const names = [candidate.nameRu, candidate.nameEn, candidate.nameOriginal].filter(Boolean).map(normalize);
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
  const scored = films.map((candidate) => ({ candidate, score: scoreCandidate(item, candidate) })).sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best || best.score < 45) return null;
  return best.candidate;
}

function findSearchResult(item, cache) {
  const keys = [
    `${item.titleRu}::${item.type}::${item.year || ''}`,
    ...Object.keys(cache.search || {}).filter((key) => key.startsWith(`${item.titleRu}::${item.type}::`)),
  ];
  for (const key of [...new Set(keys)]) {
    const search = cache.search?.[key];
    if (!search?.films?.length) continue;
    const best = pickBest(item, search.films);
    if (best) return best;
  }
  return null;
}

function applyCandidate(item, candidate) {
  if (!candidate) return false;
  const before = JSON.stringify(item);
  item.titleRu = candidate.nameRu || item.titleRu;
  item.titleOriginal = candidate.nameEn || item.titleOriginal || item.titleRu;
  item.year = numberOrUndefined(candidate.year) || item.year;
  item.posterUrl = item.posterUrl || candidate.posterUrl || '';
  item.description = item.description || candidate.description || '';
  item.kinopoiskId = candidate.filmId || item.kinopoiskId;
  return JSON.stringify(item) !== before;
}

if (!existsSync(CACHE_FILE)) {
  console.log('Нет кэша Kinopoisk Unofficial.');
  process.exit(0);
}

const items = readMedia();
const cache = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
let changed = 0;
let found = 0;

for (const item of items) {
  if (item.posterUrl && item.description && item.year) continue;
  const candidate = findSearchResult(item, cache);
  if (candidate) found++;
  if (applyCandidate(item, candidate)) changed++;
}

writeMedia(items);
console.log(JSON.stringify({ found, changed }, null, 2));
