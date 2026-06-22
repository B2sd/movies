import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const ENRICHED_FILE = join(ROOT, 'src', 'data', 'enrichedMedia.ts');
const SEED_FILE = join(ROOT, 'src', 'data', 'seed.ts');

function normalizeText(value = '') {
  return String(value)
    .toLowerCase()
    .replaceAll('ё', 'е')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .trim();
}

function readTsArray(file, exportName) {
  if (!existsSync(file)) return [];
  let src = readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  src = src.replace(/import type[^;]+;\s*/g, '');
  src = src.replace(/const poster = \(path: string\) => `https:\/\/image\.tmdb\.org\/t\/p\/w500\$\{path\}`;\s*/,
    'const poster = (path) => `https://image.tmdb.org/t/p/w500${path}`;');
  src = src.replace(/const backdrop = \(path: string\) => `https:\/\/image\.tmdb\.org\/t\/p\/w1280\$\{path\}`;\s*/,
    'const backdrop = (path) => `https://image.tmdb.org/t/p/w1280${path}`;');
  src = src.replace(new RegExp(`export const ${exportName}: [^=]+ =`), `exports.${exportName} =`);
  src = src.replace(/export const seedComments: [^=]+ =/, 'exports.seedComments =');
  const exports = {};
  Function('exports', `${src}; return exports;`)(exports);
  return exports[exportName] || [];
}

function isGeneratedPoster(item) {
  return String(item.posterUrl || '').startsWith('data:image/svg+xml');
}

function isBadPoster(item) {
  return !item.posterUrl || /placeholder|placehold|dummyimage|picsum/i.test(item.posterUrl);
}

function hasBadDescription(item) {
  return !String(item.description || '').trim();
}

function byCount(items, field) {
  return items.reduce((acc, item) => {
    const key = item[field] || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function findDuplicates(items) {
  const seen = new Map();
  const dupes = [];
  for (const item of items) {
    const key = normalizeText(item.titleRu);
    if (seen.has(key)) {
      dupes.push({ key, first: seen.get(key), second: item });
    } else {
      seen.set(key, item);
    }
  }
  return dupes;
}

function findSuspicious(items) {
  const checks = [
    { title: 'Гнев человеческий', shouldIncludeOriginal: 'Wrath of Man', shouldYear: 2021 },
    { title: 'Джентльмены', shouldIncludeOriginal: 'The Gentlemen', shouldYear: 2019 },
    { title: 'Помни', shouldIncludeOriginal: 'Memento', shouldYear: 2000 },
    { title: 'Игры разума', shouldIncludeOriginal: 'A Beautiful Mind', shouldYear: 2001 },
    { title: 'Бесславные ублюдки', shouldIncludeOriginal: 'Inglourious Basterds', shouldYear: 2009 },
    { title: 'Молчание ягнят', shouldIncludeOriginal: 'The Silence of the Lambs', shouldYear: 1991 },
  ];

  const result = [];
  for (const check of checks) {
    const item = items.find((entry) => normalizeText(entry.titleRu) === normalizeText(check.title));
    if (!item) {
      result.push({ status: 'missing', check });
      continue;
    }
    const originalOk = normalizeText(item.titleOriginal).includes(normalizeText(check.shouldIncludeOriginal));
    const yearOk = !check.shouldYear || Number(item.year) === check.shouldYear;
    if (!originalOk || !yearOk) {
      result.push({ status: 'suspicious', check, item });
    }
  }
  return result;
}

const enriched = readTsArray(ENRICHED_FILE, 'enrichedMedia');
const seed = readTsArray(SEED_FILE, 'seedMedia');
const merged = new Map();
[...enriched, ...seed].forEach((item) => merged.set(normalizeText(item.titleRu), item));
const all = [...merged.values()];

const enrichedDupes = findDuplicates(enriched);
const allDupes = findDuplicates(all);
const missingPoster = enriched.filter(isBadPoster);
const generatedPosters = enriched.filter(isGeneratedPoster);
const missingDescription = enriched.filter(hasBadDescription);
const missingYear = enriched.filter((item) => !item.year);
const personalRatings = enriched.filter((item) => typeof item.myRating === 'number');
const externalRatings = enriched.filter((item) => typeof item.kinopoiskRating === 'number' || typeof item.imdbRating === 'number');
const suspicious = findSuspicious(enriched);

const report = {
  generatedAt: new Date().toISOString(),
  counts: {
    enriched: enriched.length,
    seed: seed.length,
    mergedOnSite: all.length,
    enrichedTypes: byCount(enriched, 'type'),
    mergedTypes: byCount(all, 'type'),
    missingPoster: missingPoster.length,
    generatedPosters: generatedPosters.length,
    missingDescription: missingDescription.length,
    missingYear: missingYear.length,
    personalRatings: personalRatings.length,
    externalRatings: externalRatings.length,
    duplicateTitlesInEnriched: enrichedDupes.length,
    duplicateTitlesAfterMerge: allDupes.length,
    suspiciousMatches: suspicious.length,
  },
  duplicateSamples: enrichedDupes.slice(0, 30).map((dupe) => ({
    first: dupe.first.titleRu,
    second: dupe.second.titleRu,
  })),
  suspicious,
  missingPosterSample: missingPoster.slice(0, 100).map((item) => ({ titleRu: item.titleRu, year: item.year, type: item.type })),
  missingYearSample: missingYear.slice(0, 100).map((item) => ({ titleRu: item.titleRu, type: item.type })),
};

console.log(JSON.stringify(report, null, 2));
