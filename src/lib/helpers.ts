import type { MediaItem, MediaType, SortMode } from '../types';

export const mediaTypeLabels: Record<MediaType | 'all', string> = {
  all: 'Все',
  movie: 'Фильмы',
  series: 'Сериалы',
  cartoon: 'Мультфильмы',
  anime: 'Аниме',
  show: 'Шоу',
};

export const sortLabels: Record<SortMode, string> = {
  'added-desc': 'По дате добавления',
  'rating-desc': 'По моей оценке',
  'year-desc': 'По году выхода',
  'guest-rating-desc': 'По оценке гостей',
  'title-asc': 'По алфавиту',
};

function escapeSvgText(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function wrapTitle(title = '') {
  const words = title.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > 20 && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 4);
}

function makeFallbackPoster(item: Pick<MediaItem, 'titleRu' | 'type' | 'year'>) {
  const titleLines = wrapTitle(item.titleRu || 'Без названия');
  const label = mediaTypeLabels[item.type] || 'Кино';
  const titleSvg = titleLines.map((line, index) => (
    `<text x="250" y="${330 + index * 42}" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="800" fill="#f6f7fb">${escapeSvgText(line)}</text>`
  )).join('');
  const year = item.year ? `<text x="250" y="570" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#9aa3c7">${item.year}</text>` : '';
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="500" height="750" viewBox="0 0 500 750">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1f2a56"/>
      <stop offset=".55" stop-color="#12172f"/>
      <stop offset="1" stop-color="#070914"/>
    </linearGradient>
    <radialGradient id="r" cx="50%" cy="22%" r="65%">
      <stop offset="0" stop-color="#f5c451" stop-opacity=".38"/>
      <stop offset="1" stop-color="#f5c451" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="500" height="750" rx="34" fill="url(#g)"/>
  <rect width="500" height="750" rx="34" fill="url(#r)"/>
  <circle cx="250" cy="185" r="78" fill="#232a4d" opacity=".95"/>
  <path d="M221 140v90l82-45z" fill="#f5c451"/>
  <text x="250" y="86" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#f5c451" letter-spacing="3">${escapeSvgText(label.toUpperCase())}</text>
  ${titleSvg}
  ${year}
  <text x="250" y="675" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#6f789d">постер будет обновлен</text>
</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function isGeneratedPosterUrl(url?: string) {
  return String(url || '').startsWith('data:image/svg+xml');
}

export function getPosterUrl(item: Pick<MediaItem, 'posterUrl' | 'titleRu' | 'type' | 'year'>) {
  return item.posterUrl?.trim() || makeFallbackPoster(item);
}

export function getBackdropUrl(item: Pick<MediaItem, 'posterUrl' | 'backdropUrl' | 'titleRu' | 'type' | 'year'>) {
  return item.backdropUrl?.trim() || getPosterUrl(item);
}

export function getRatingClass(rating?: number) {
  if (!rating) return 'rating-none';
  if (rating >= 9) return 'rating-gold';
  if (rating >= 7) return 'rating-green';
  if (rating >= 5) return 'rating-yellow';
  return 'rating-red';
}

export function formatRating(rating?: number) {
  if (!rating) return '—';
  return Number(rating).toFixed(1);
}

export function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replaceAll('ё', 'е')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .trim();
}

export function filterAndSortMedia(items: MediaItem[], query: string, type: MediaType | 'all', sort: SortMode) {
  const normalizedQuery = normalizeText(query);

  const filtered = items.filter((item) => {
    const byType = type === 'all' || item.type === type;
    const haystack = normalizeText([
      item.titleRu,
      item.titleOriginal,
      item.year,
      item.genres.join(' '),
      item.description,
    ].filter(Boolean).join(' '));
    return byType && (!normalizedQuery || haystack.includes(normalizedQuery));
  });

  return filtered.sort((a, b) => {
    if (sort === 'rating-desc') return (b.myRating || 0) - (a.myRating || 0);
    if (sort === 'year-desc') return (b.year || 0) - (a.year || 0);
    if (sort === 'guest-rating-desc') return (b.guestRating || 0) - (a.guestRating || 0);
    if (sort === 'title-asc') return a.titleRu.localeCompare(b.titleRu, 'ru');
    return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
  });
}

export function getStats(items: MediaItem[]) {
  const ratedByMe = items.filter((item) => typeof item.myRating === 'number');
  const average = ratedByMe.length
    ? ratedByMe.reduce((sum, item) => sum + (item.myRating || 0), 0) / ratedByMe.length
    : 0;
  return {
    total: items.length,
    favorites: items.filter((item) => item.isFavorite).length,
    top: ratedByMe.length,
    average: Number(average.toFixed(1)),
    series: items.filter((item) => item.type === 'series').length,
  };
}

export function formatDate(date?: string) {
  if (!date) return 'не указано';
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(date));
}

export function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: unknown[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}
