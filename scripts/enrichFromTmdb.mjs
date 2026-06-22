import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const MEDIA_FILE = join(ROOT, 'src', 'data', 'enrichedMedia.ts');
const CACHE_FILE = join(ROOT, 'scripts', 'tmdb-enrich-cache.json');

const TMDB_IMAGE = 'https://image.tmdb.org/t/p';
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

function normalize(value = '') {
  return String(value).toLowerCase().replaceAll('ё', 'е').replace(/[^a-zа-я0-9]+/gi, ' ').trim();
}

function yearFromDate(date) {
  return date ? Number(String(date).slice(0, 4)) || undefined : undefined;
}

function tmdbType(type) {
  return type === 'series' || type === 'show' ? 'tv' : 'movie';
}

function url(path, size) {
  return path ? `${TMDB_IMAGE}/${size}${path}` : '';
}

function readCache() {
  if (!existsSync(CACHE_FILE)) return {};
  try {
    return JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveCache(cache) {
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
}

function scoreCandidate(item, candidate) {
  const title = normalize(item.titleRu);
  const original = normalize(item.titleOriginal);
  const names = [candidate.title, candidate.name, candidate.original_title, candidate.original_name].filter(Boolean).map(normalize);
  let score = 0;
  if (names.includes(title)) score += 80;
  if (original && names.includes(original)) score += 35;
  if (names.some((name) => name.includes(title) || title.includes(name))) score += 20;
  const candidateYear = yearFromDate(candidate.release_date || candidate.first_air_date);
  if (item.year && candidateYear === item.year) score += 25;
  if (candidate.poster_path) score += 8;
  if (candidate.overview) score += 8;
  if (candidate.vote_count > 100) score += 3;
  return score;
}

async function tmdbFetch(path, env) {
  const headers = env.VITE_TMDB_READ_TOKEN ? { Authorization: `Bearer ${env.VITE_TMDB_READ_TOKEN}` } : {};
  const separator = path.includes('?') ? '&' : '?';
  const fullPath = env.VITE_TMDB_READ_TOKEN ? path : `${path}${separator}api_key=${env.VITE_TMDB_API_KEY}`;
  const response = await fetch(`https://api.themoviedb.org/3${fullPath}`, { headers });
  if (!response.ok) throw new Error(`TMDB ${response.status}`);
  return response.json();
}

async function searchItem(item, env) {
  const type = tmdbType(item.type);
  const query = encodeURIComponent(item.titleRu);
  const yearParam = item.year ? `&${type === 'movie' ? 'year' : 'first_air_date_year'}=${item.year}` : '';
  const search = await tmdbFetch(`/search/${type}?language=ru-RU&query=${query}&page=1&include_adult=false${yearParam}`, env);
  const candidates = (search.results || [])
    .map((candidate) => ({ candidate, score: scoreCandidate(item, candidate) }))
    .sort((a, b) => b.score - a.score);
  const best = candidates[0];
  if (!best || best.score < 55) return null;

  const details = await tmdbFetch(`/${type}/${best.candidate.id}?language=ru-RU&append_to_response=external_ids`, env);
  return { type, search: best.candidate, details };
}

function applyTmdb(item, data) {
  if (!data) return false;
  const details = data.details || {};
  const titleRu = details.title || details.name || item.titleRu;
  const titleOriginal = details.original_title || details.original_name || item.titleOriginal || titleRu;
  const year = yearFromDate(details.release_date || details.first_air_date) || item.year;
  const genres = (details.genres || []).map((genre) => genre.name).filter(Boolean);
  const before = JSON.stringify(item);

  item.titleRu = titleRu;
  item.titleOriginal = titleOriginal;
  item.year = year;
  item.posterUrl = item.posterUrl || url(details.poster_path, 'w500');
  item.backdropUrl = item.backdropUrl || url(details.backdrop_path, 'w1280') || item.posterUrl;
  item.description = item.description || details.overview || '';
  item.genres = genres.length ? genres : item.genres;
  item.tmdbId = details.id || item.tmdbId;
  item.imdbId = details.external_ids?.imdb_id || item.imdbId;
  return JSON.stringify(item) !== before;
}

async function main() {
  const env = readEnv();
  if (!env.VITE_TMDB_API_KEY && !env.VITE_TMDB_READ_TOKEN) {
    console.error('Нет VITE_TMDB_API_KEY или VITE_TMDB_READ_TOKEN');
    process.exit(1);
  }

  const items = readMedia();
  const cache = readCache();
  const targets = items.filter((item) => !item.posterUrl || !item.description || !item.year || !item.tmdbId || !item.imdbId);
  let searched = 0;
  let changed = 0;
  let found = 0;

  for (const item of targets) {
    const key = `${item.id}::${item.titleRu}::${item.year || ''}`;
    try {
      if (!(key in cache)) {
        searched++;
        cache[key] = await searchItem(item, env) || null;
        if (searched % 10 === 0) saveCache(cache);
        await delay(260);
      }
      if (cache[key]) found++;
      if (applyTmdb(item, cache[key])) changed++;
    } catch (error) {
      console.log(`Не удалось загрузить: ${item.titleRu}, ${error.message}`);
      await delay(800);
    }
  }

  saveCache(cache);
  writeMedia(items);
  console.log(JSON.stringify({ targets: targets.length, searched, found, changed }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
