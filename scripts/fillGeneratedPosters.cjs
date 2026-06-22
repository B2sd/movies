const fs = require('node:fs');
const file = 'src/data/enrichedMedia.ts';
const source = fs.readFileSync(file, 'utf8');
const items = JSON.parse(source.match(/export const enrichedMedia: MediaItem\[] = ([\s\S]*);\s*$/)[1]);

const labels = {
  movie: 'ФИЛЬМ',
  series: 'СЕРИАЛ',
  cartoon: 'МУЛЬТФИЛЬМ',
  anime: 'АНИМЕ',
  show: 'ШОУ',
};

function escapeXml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function wrap(title) {
  const words = String(title || 'Без названия').split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > 18 && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 4);
}

function hash(value) {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = ((h << 5) - h + value.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function poster(item) {
  const palettes = [
    ['#1f2a56', '#070914', '#f5c451'],
    ['#3a174a', '#080914', '#fb7185'],
    ['#12372f', '#070914', '#34d399'],
    ['#38220f', '#080914', '#f59e0b'],
    ['#102a43', '#070914', '#38bdf8'],
    ['#3b1d1d', '#080914', '#f87171'],
  ];
  const [a, b, accent] = palettes[hash(item.titleRu) % palettes.length];
  const titleLines = wrap(item.titleRu);
  const title = titleLines.map((line, index) => `<text x="250" y="${325 + index * 42}" text-anchor="middle" font-family="Arial, sans-serif" font-size="33" font-weight="800" fill="#f8fafc">${escapeXml(line)}</text>`).join('');
  const year = item.year ? `<text x="250" y="568" text-anchor="middle" font-family="Arial, sans-serif" font-size="25" font-weight="700" fill="#cbd5e1">${item.year}</text>` : '';
  const type = labels[item.type] || 'КИНО';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="750" viewBox="0 0 500 750"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient><radialGradient id="r" cx="50%" cy="18%" r="70%"><stop offset="0" stop-color="${accent}" stop-opacity=".42"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient></defs><rect width="500" height="750" rx="34" fill="url(#g)"/><rect width="500" height="750" rx="34" fill="url(#r)"/><circle cx="250" cy="178" r="80" fill="#0f172a" opacity=".72"/><path d="M222 132v92l82-46z" fill="${accent}"/><text x="250" y="86" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="800" fill="${accent}" letter-spacing="3">${type}</text>${title}${year}<text x="250" y="674" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#94a3b8">постер будет обновлен</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

let filled = 0;
for (const item of items) {
  if (!item.posterUrl) {
    item.posterUrl = poster(item);
    item.backdropUrl = item.backdropUrl || item.posterUrl;
    filled++;
  }
}

fs.writeFileSync(file, `import type { MediaItem } from '../types';\n\nexport const enrichedMedia: MediaItem[] = ${JSON.stringify(items, null, 2)};\n`, 'utf8');
console.log(JSON.stringify({ filled }, null, 2));
