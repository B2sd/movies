const fs = require('node:fs');
const file = 'src/data/enrichedMedia.ts';
const search = JSON.parse(fs.readFileSync('tmp-fix-search.json', 'utf8'));
let items = JSON.parse(fs.readFileSync(file, 'utf8').match(/export const enrichedMedia: MediaItem\[] = ([\s\S]*);\s*$/)[1]);

function byId(id) {
  for (const arr of Object.values(search)) {
    const found = arr.find((item) => item.id === id);
    if (found) return found;
  }
  return null;
}

function toMediaType(type) {
  if (type === 'tv-series' || type === 'animated-series') return 'series';
  if (type === 'anime') return 'anime';
  if (type === 'cartoon') return 'cartoon';
  return 'movie';
}

function rating(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Number(number.toFixed(1)) : undefined;
}

function applyByCurrentTitle(currentTitle, data, override = {}) {
  const item = items.find((entry) => entry.titleRu === currentTitle);
  if (!item || !data) return false;
  Object.assign(item, {
    titleRu: data.name || item.titleRu,
    titleOriginal: data.alt || data.name || item.titleOriginal,
    type: toMediaType(data.type),
    year: data.year || item.year,
    posterUrl: data.poster || item.posterUrl,
    backdropUrl: data.poster || item.backdropUrl || item.posterUrl,
    description: data.desc || item.description,
    genres: (data.genres || []).map((genre) => genre.name).filter(Boolean),
    countries: (data.countries || []).map((country) => country.name).filter(Boolean),
    kinopoiskId: data.id,
    imdbId: data.externalId?.imdb,
    tmdbId: data.externalId?.tmdb,
    kinopoiskRating: rating(data.rating?.kp),
    imdbRating: rating(data.rating?.imdb),
  }, override);
  return true;
}

let patched = 0;
patched += applyByCurrentTitle('Кик-Ассия', byId(532800), { titleRu: 'Сорвиголова Кик Бутовски', type: 'cartoon' }) ? 1 : 0;
patched += applyByCurrentTitle('Связь', byId(760829), { type: 'movie' }) ? 1 : 0;
patched += applyByCurrentTitle('Спасатели', byId(468940), { titleRu: 'Спасатели Малибу', type: 'movie' }) ? 1 : 0;
patched += applyByCurrentTitle('Сестры', {
  id: 41109,
  name: 'Сёстры',
  alt: 'Сёстры',
  type: 'movie',
  year: 2001,
  poster: 'https://avatars.mds.yandex.net/get-kinopoisk-image/1600647/d6c4c700-6928-4008-ab48-d17d8f43439c/600x900',
  desc: 'Дина и Света ненавидят друг друга, хотя в них течет одна кровь. После выхода отца из тюрьмы девочки оказываются в опасности и вынуждены держаться вместе.',
  genres: [{ name: 'драма' }, { name: 'криминал' }],
  countries: [{ name: 'Россия' }],
  rating: { kp: 7.814, imdb: 7 },
  externalId: { imdb: 'tt0284492' },
}) ? 1 : 0;
patched += applyByCurrentTitle('Берсерк', byId(257376), { type: 'anime' }) ? 1 : 0;
patched += applyByCurrentTitle('Хантер', byId(647602), { titleRu: 'Хантер х Хантер', type: 'anime' }) ? 1 : 0;
patched += applyByCurrentTitle('Война миров', byId(81289), { type: 'movie' }) ? 1 : 0;
patched += applyByCurrentTitle('Аладдин', byId(2361), { type: 'cartoon' }) ? 1 : 0;
patched += applyByCurrentTitle('Аватар: Легенда об Аанге', byId(401152), { type: 'cartoon' }) ? 1 : 0;
patched += applyByCurrentTitle('Бременские музыканты', byId(46223), { type: 'cartoon' }) ? 1 : 0;
patched += applyByCurrentTitle('Алиса в Стране чудес', byId(405609), { type: 'movie' }) ? 1 : 0;
patched += applyByCurrentTitle('Рапунцель: Запутанная история', byId(84049), { type: 'cartoon' }) ? 1 : 0;
patched += applyByCurrentTitle('Константин: Повелитель тьмы', byId(3793), { type: 'movie' }) ? 1 : 0;
patched += applyByCurrentTitle('Люди в чёрном 2', byId(6379), { titleRu: 'Люди в черном 2', type: 'movie' }) ? 1 : 0;
patched += applyByCurrentTitle('Волчонок', {
  id: 492613,
  name: 'Волчонок',
  alt: 'Teen Wolf',
  type: 'tv-series',
  year: 2011,
  poster: 'https://avatars.mds.yandex.net/get-kinopoisk-image/1599028/8dcafaf4-e78b-470b-bc92-97bfcd79d3a5/600x900',
  desc: 'Старшеклассник Скотт МакКолл после укуса неизвестного зверя становится оборотнем и пытается совместить обычную школьную жизнь с новыми опасными способностями.',
  genres: [{ name: 'фэнтези' }, { name: 'боевик' }, { name: 'триллер' }, { name: 'драма' }],
  countries: [{ name: 'США' }],
  rating: { kp: 8.0, imdb: 7.7 },
  externalId: { imdb: 'tt1567432', tmdb: 34524 },
}, { type: 'series' }) ? 1 : 0;
patched += applyByCurrentTitle('Бесстыжие', byId(571335), { type: 'series' }) ? 1 : 0;
patched += applyByCurrentTitle('Унесенные призраками', byId(370), { titleRu: 'Унесённые призраками', type: 'anime' }) ? 1 : 0;
patched += applyByCurrentTitle('Дюна: Часть вторая', byId(4540126), { type: 'movie' }) ? 1 : 0;

const removeIds = new Set(['media-кармелита-488', 'media-джунгли-447', 'media-харли-квинн-527']);
const before = items.length;
items = items.filter((item) => !removeIds.has(item.id));
const removed = before - items.length;

fs.writeFileSync(file, `import type { MediaItem } from '../types';\n\nexport const enrichedMedia: MediaItem[] = ${JSON.stringify(items, null, 2)};\n`, 'utf8');
console.log(JSON.stringify({ patched, removed, total: items.length }, null, 2));
