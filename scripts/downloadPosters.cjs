const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = process.cwd();
const MEDIA_FILE = path.join(ROOT, 'src', 'data', 'enrichedMedia.ts');
const OUT_DIR = path.join(ROOT, 'public', 'posters');
const MANIFEST = path.join(ROOT, 'scripts', 'poster-download-manifest.json');

function readMedia() {
  const source = fs.readFileSync(MEDIA_FILE, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(source.match(/export const enrichedMedia: MediaItem\[] = ([\s\S]*);\s*$/)[1]);
}

function writeMedia(items) {
  fs.writeFileSync(MEDIA_FILE, `import type { MediaItem } from '../types';\n\nexport const enrichedMedia: MediaItem[] = ${JSON.stringify(items, null, 2)};\n`, 'utf8');
}

function safeName(item, index) {
  const slug = String(item.titleRu || item.id || index)
    .toLowerCase()
    .replaceAll('ё', 'е')
    .replace(/[^a-zа-я0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70) || `poster-${index}`;
  const hash = crypto.createHash('md5').update(item.id || `${item.titleRu}-${index}`).digest('hex').slice(0, 8);
  return `${slug}-${hash}.jpg`;
}

function isLocal(url = '') {
  return String(url).startsWith('./posters/') || String(url).startsWith('/posters/');
}

function isData(url = '') {
  return String(url).startsWith('data:image');
}

async function download(url, file) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 KaranMovieArchive/1.0',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 1024) throw new Error(`too small ${buffer.length}`);
  fs.writeFileSync(file, buffer);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const items = readMedia();
  const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {};
  let attempted = 0;
  let downloaded = 0;
  let reused = 0;
  let failed = 0;

  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    if (!item.posterUrl || isData(item.posterUrl) || isLocal(item.posterUrl)) continue;
    const sourceUrl = item.posterUrl;
    const fileName = safeName(item, index);
    const fullPath = path.join(OUT_DIR, fileName);
    const publicPath = `./posters/${fileName}`;

    try {
      const cached = manifest[item.id];
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).size > 1024 && cached?.sourceUrl === sourceUrl) {
        item.posterUrl = publicPath;
        item.backdropUrl = item.backdropUrl && item.backdropUrl === sourceUrl ? publicPath : item.backdropUrl;
        reused++;
        continue;
      }
      attempted++;
      await download(sourceUrl, fullPath);
      manifest[item.id] = { title: item.titleRu, sourceUrl, file: publicPath };
      item.posterUrl = publicPath;
      item.backdropUrl = item.backdropUrl && item.backdropUrl === sourceUrl ? publicPath : item.backdropUrl;
      downloaded++;
      if (downloaded % 50 === 0) console.log(`Скачано ${downloaded}, ошибок ${failed}`);
    } catch (error) {
      failed++;
      console.log(`Не скачался постер: ${item.titleRu} | ${error.message}`);
    }
  }

  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2), 'utf8');
  writeMedia(items);
  console.log(JSON.stringify({ attempted, downloaded, reused, failed }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
