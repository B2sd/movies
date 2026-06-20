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

export function getRatingClass(rating?: number) {
  if (!rating) return 'rating-none';
  if (rating >= 9) return 'rating-gold';
  if (rating >= 7) return 'rating-green';
  if (rating >= 5) return 'rating-yellow';
  return 'rating-red';
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
  const rated = items.filter((item) => typeof item.myRating === 'number');
  const average = rated.length
    ? rated.reduce((sum, item) => sum + (item.myRating || 0), 0) / rated.length
    : 0;

  return {
    total: items.length,
    favorites: items.filter((item) => item.isFavorite).length,
    top: items.filter((item) => item.isTop).length,
    average: Number(average.toFixed(1)),
    series: items.filter((item) => item.type === 'series').length,
  };
}

export function formatDate(date?: string) {
  if (!date) return 'не указано';
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(date));
}
