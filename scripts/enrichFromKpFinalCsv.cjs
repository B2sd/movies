const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const MEDIA_FILE = path.join(ROOT, 'src', 'data', 'enrichedMedia.ts');
const CSV_FILE = path.join(ROOT, 'kp_final.csv');

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inside = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];
    if (inside && char === '"' && next === '"') {
      cell += '"';
      i++;
      continue;
    }
    if (char === '"') {
      inside = !inside;
      continue;
    }
    if (!inside && char === ',') {
      row.push(cell);
      cell = '';
      continue;
    }
    if (!inside && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') i++;
      row.push(cell);
      if (row.some((value) => value.length)) rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += char;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const header = rows.shift();
  return rows.map((values) => Object.fromEntries(header.map((key, index) => [key, values[index] || ''])));
}

function normalize(value = '') {
  return String(value)
    .toLowerCase()
    .replaceAll('ё', 'е')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/сериал|мини сериал|мультсериал|фильм|тв|tv/gi, ' ')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .trim();
}

function baseName(value = '') {
  return normalize(value).replace(/\b(часть|эпизод|сезон)\b/g, ' ').replace(/\s+/g, ' ').trim();
}

function score(item, row) {
  const itemTitle = normalize(item.titleRu);
  const itemOriginal = normalize(item.titleOriginal || '');
  const rowTitle = normalize(row.name_rus);
  const rowBase = baseName(row.name_rus);
  let value = 0;
  if (itemTitle === rowTitle || itemTitle === rowBase) value += 100;
  if (itemOriginal && itemOriginal === rowTitle) value += 40;
  if (rowTitle.includes(itemTitle) || itemTitle.includes(rowTitle) || rowBase.includes(itemTitle) || itemTitle.includes(rowBase)) value += 35;
  if (item.year && Number(row.movie_year) === Number(item.year)) value += 35;
  if (row.poster) value += 12;
  if (row.description) value += 10;
  if (row.kp_rating) value += 5;
  return value;
}

function readMedia() {
  const source = fs.readFileSync(MEDIA_FILE, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(source.match(/export const enrichedMedia: MediaItem\[] = ([\s\S]*);\s*$/)[1]);
}

function writeMedia(items) {
  fs.writeFileSync(MEDIA_FILE, `import type { MediaItem } from '../types';\n\nexport const enrichedMedia: MediaItem[] = ${JSON.stringify(items, null, 2)};\n`, 'utf8');
}

function isGeneratedPoster(url = '') {
  return String(url).startsWith('data:image/svg+xml');
}

function number(value) {
  const next = Number(String(value).replace(',', '.'));
  return Number.isFinite(next) && next > 0 ? Number(next.toFixed(1)) : undefined;
}

function splitList(value = '') {
  return String(value).split(',').map((part) => part.trim()).filter(Boolean);
}

if (!fs.existsSync(CSV_FILE)) {
  console.error('Не найден kp_final.csv');
  process.exit(1);
}

const rows = parseCsv(fs.readFileSync(CSV_FILE, 'utf8'));
const items = readMedia();
let matched = 0;
let changed = 0;
let replacedPosters = 0;

for (const item of items) {
  const best = rows
    .map((row) => ({ row, score: score(item, row) }))
    .sort((a, b) => b.score - a.score)[0];
  if (!best || best.score < 78) continue;

  matched++;
  const before = JSON.stringify(item);
  const hadGeneratedPoster = isGeneratedPoster(item.posterUrl);
  item.kinopoiskId = item.kinopoiskId || number(best.row.movie_id);
  item.year = item.year || number(best.row.movie_year);
  if (!item.posterUrl || isGeneratedPoster(item.posterUrl)) item.posterUrl = best.row.poster || item.posterUrl;
  if (!item.backdropUrl || isGeneratedPoster(item.backdropUrl)) item.backdropUrl = item.posterUrl;
  item.description = best.row.description || item.description;
  item.genres = best.row.genres ? splitList(best.row.genres) : item.genres;
  item.countries = best.row.countries ? splitList(best.row.countries) : item.countries;
  item.kinopoiskRating = number(best.row.kp_rating) || item.kinopoiskRating;
  if (hadGeneratedPoster && !isGeneratedPoster(item.posterUrl)) replacedPosters++;
  if (JSON.stringify(item) !== before) changed++;
}

writeMedia(items);
console.log(JSON.stringify({ rows: rows.length, matched, changed, replacedPosters }, null, 2));
