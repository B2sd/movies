const fs = require('node:fs');
const file = 'src/data/enrichedMedia.ts';
const cacheFile = 'scripts/kinopoisk-unofficial-cache.json';
const items = JSON.parse(fs.readFileSync(file, 'utf8').match(/export const enrichedMedia: MediaItem\[] = ([\s\S]*);\s*$/)[1]);
const cache = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : { details: {} };
function isGenerated(url='') { return String(url).startsWith('data:image/svg+xml'); }
function norm(v='') { return String(v).toLowerCase().replaceAll('ё','е').replace(/[^a-zа-я0-9]+/gi,' ').trim(); }
let replaced = 0;
let enriched = 0;
const details = Object.values(cache.details || {}).filter(Boolean);
for (const item of items) {
  let d = null;
  if (item.kinopoiskId) d = cache.details?.[String(item.kinopoiskId)];
  if (!d) {
    d = details.find(x => [x.nameRu, x.nameOriginal, x.nameEn].filter(Boolean).map(norm).includes(norm(item.titleRu)));
  }
  if (!d) continue;
  if (isGenerated(item.posterUrl) && d.posterUrl) { item.posterUrl = d.posterUrl; replaced++; }
  if ((!item.backdropUrl || isGenerated(item.backdropUrl)) && (d.coverUrl || d.posterUrl)) item.backdropUrl = d.coverUrl || d.posterUrl;
  if (!item.description && (d.description || d.shortDescription)) item.description = d.description || d.shortDescription;
  if (!item.year && d.year) item.year = Number(d.year);
  if (!item.kinopoiskRating && d.ratingKinopoisk) item.kinopoiskRating = Number(Number(d.ratingKinopoisk).toFixed(1));
  if (!item.imdbRating && d.ratingImdb) item.imdbRating = Number(Number(d.ratingImdb).toFixed(1));
  if (!item.imdbId && d.imdbId) item.imdbId = d.imdbId;
  enriched++;
}
fs.writeFileSync(file, `import type { MediaItem } from '../types';\n\nexport const enrichedMedia: MediaItem[] = ${JSON.stringify(items,null,2)};\n`, 'utf8');
console.log(JSON.stringify({enriched, replaced}, null, 2));
