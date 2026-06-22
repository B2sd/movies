const fs = require('node:fs');

function countInFile(file, marker) {
  if (!fs.existsSync(file)) return 0;
  const content = fs.readFileSync(file, 'utf8');
  return content.split(marker).length - 1;
}

console.log('Enriched items:', countInFile('src/data/enrichedMedia.ts', '"id":'));

for (const cacheFile of ['scripts/kp-cache.json', 'scripts/tmdb-cache.json', 'scripts/omdb-cache.json']) {
  if (!fs.existsSync(cacheFile)) {
    console.log(`${cacheFile}: missing`);
    continue;
  }

  try {
    const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    const values = Object.values(cache);
    const total = Object.keys(cache).length;
    const found = values.filter((value) => value && value !== '__NOT_FOUND__').length;
    const notFound = values.filter((value) => value === '__NOT_FOUND__').length;
    console.log(`${cacheFile}: total=${total}, found=${found}, notFound=${notFound}`);
  } catch (error) {
    console.log(`${cacheFile}: failed to parse (${error.message})`);
  }
}
