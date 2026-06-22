const fs = require('node:fs');
const path = require('node:path');

const poster = (p) => `https://image.tmdb.org/t/p/w500${p}`;
const backdrop = (p) => `https://image.tmdb.org/t/p/w1280${p}`;

function evalArray(src) {
  return Function('poster', 'backdrop', `return (${src});`)(poster, backdrop);
}

function stripPersonal(items) {
  for (const item of items) {
    delete item.myRating;
    delete item.myReview;
    delete item.guestRating;
    delete item.guestVotes;
    delete item.isTop;
    delete item.isFavorite;
    delete item.rewatch;
  }
  return items;
}

const enrichedFile = path.join('src', 'data', 'enrichedMedia.ts');
let enrichedSource = fs.readFileSync(enrichedFile, 'utf8').replace(/^\uFEFF/, '');
let enrichedMatch = enrichedSource.match(/export const enrichedMedia: MediaItem\[] = ([\s\S]*);\s*$/);
if (!enrichedMatch) throw new Error('Cannot parse enrichedMedia.ts');
const enriched = stripPersonal(evalArray(enrichedMatch[1]));
fs.writeFileSync(enrichedFile, `import type { MediaItem } from '../types';\n\nexport const enrichedMedia: MediaItem[] = ${JSON.stringify(enriched, null, 2)};\n`, 'utf8');

const seedFile = path.join('src', 'data', 'seed.ts');
let seedSource = fs.readFileSync(seedFile, 'utf8').replace(/^\uFEFF/, '');
const seedMatch = seedSource.match(/export const seedMedia: MediaItem\[] = ([\s\S]*?);\s*export const seedComments/);
if (!seedMatch) throw new Error('Cannot parse seed.ts');
const seedMedia = stripPersonal(evalArray(seedMatch[1]));
const commentsPart = seedSource.slice(seedSource.indexOf('export const seedComments'));
fs.writeFileSync(seedFile, `import type { MediaItem, PublicComment } from '../types';\n\nexport const seedMedia: MediaItem[] = ${JSON.stringify(seedMedia, null, 2)};\n\n${commentsPart}`, 'utf8');

console.log(JSON.stringify({ enriched: enriched.length, seedMedia: seedMedia.length }, null, 2));
