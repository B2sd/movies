import type { MediaItem, MediaType } from '../types';
import { normalizeText } from './helpers';

export type ApiSearchSource = 'tmdb' | 'kinopoisk' | 'poiskkino' | 'omdb';

export type ApiSearchResult = {
  source: ApiSearchSource;
  sourceLabel: string;
  sourceId: string;
  titleRu: string;
  titleOriginal?: string;
  type: MediaType;
  year?: number;
  posterUrl?: string;
  backdropUrl?: string;
  description?: string;
  genres?: string[];
  countries?: string[];
  kinopoiskRating?: number;
  imdbRating?: number;
  tmdbId?: number;
  kinopoiskId?: number;
  imdbId?: string;
};

type TMDBCandidate = {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string;
  backdrop_path?: string;
  overview?: string;
  genre_ids?: number[];
  media_type?: string;
  vote_count?: number;
};

type TMDBDetails = TMDBCandidate & {
  genres?: { name: string }[];
  external_ids?: { imdb_id?: string };
};

type KinopoiskSearchItem = {
  filmId: number;
  nameRu?: string;
  nameEn?: string;
  nameOriginal?: string;
  year?: string;
  type?: string;
  posterUrl?: string;
  description?: string;
  genres?: { genre: string }[];
};

type KinopoiskDetails = {
  kinopoiskId: number;
  nameRu?: string;
  nameEn?: string;
  nameOriginal?: string;
  year?: number;
  type?: string;
  posterUrl?: string;
  coverUrl?: string;
  description?: string;
  shortDescription?: string;
  genres?: { genre: string }[];
  countries?: { country: string }[];
  ratingKinopoisk?: number;
  ratingImdb?: number;
  imdbId?: string;
};

type OMDBResult = {
  Title?: string;
  Year?: string;
  Rated?: string;
  Released?: string;
  Runtime?: string;
  Genre?: string;
  Director?: string;
  Writer?: string;
  Actors?: string;
  Plot?: string;
  Language?: string;
  Country?: string;
  Poster?: string;
  imdbRating?: string;
  imdbID?: string;
  Type?: string;
  Response?: string;
  Error?: string;
};

const TMDB_IMAGE = 'https://image.tmdb.org/t/p';
const memoryCache = new Map<string, MediaItem | null>();

const tmdbGenreMap: Record<number, string> = {
  28: 'боевик', 12: 'приключения', 16: 'мультфильм', 35: 'комедия',
  80: 'криминал', 18: 'драма', 10751: 'семейный', 14: 'фэнтези',
  36: 'история', 27: 'ужасы', 10402: 'музыка', 9648: 'детектив',
  10749: 'мелодрама', 878: 'фантастика', 53: 'триллер', 10752: 'военный',
};

function getTMDBKey() {
  return import.meta.env.VITE_TMDB_API_KEY || '';
}

function getTMDBToken() {
  return import.meta.env.VITE_TMDB_READ_TOKEN || '';
}

function getOMDBKey() {
  return import.meta.env.VITE_OMDB_API_KEY || '';
}

function getKinopoiskKey() {
  return import.meta.env.VITE_KINOPOISK_UNOFFICIAL_API_KEY || '';
}

function getPoiskKinoKey() {
  return import.meta.env.VITE_POISKKINO_API_KEY || '';
}

function getHeaders() {
  const token = getTMDBToken();
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

function withApiKey(path: string) {
  const key = getTMDBKey();
  if (!key || getTMDBToken()) return path;
  return `${path}${path.includes('?') ? '&' : '?'}api_key=${key}`;
}

function tmdbType(type: MediaItem['type']) {
  return type === 'series' || type === 'show' ? 'tv' : 'movie';
}

function getYear(value?: string | number) {
  if (!value) return undefined;
  return Number(String(value).slice(0, 4)) || undefined;
}

function imageUrl(path: string | undefined, size: 'w500' | 'w1280') {
  return path ? `${TMDB_IMAGE}/${size}${path}` : '';
}

function numberOrUndefined(value?: string | number) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Number(number.toFixed(1)) : undefined;
}

function kpTypeToMediaType(type?: string): MediaType {
  if (type === 'TV_SERIES' || type === 'MINI_SERIES') return 'series';
  if (type === 'TV_SHOW') return 'show';
  return 'movie';
}

function omdbTypeToMediaType(type?: string): MediaType {
  if (type === 'series') return 'series';
  return 'movie';
}

function score(item: MediaItem, candidate: TMDBCandidate) {
  const query = normalizeText(item.titleRu);
  const original = normalizeText(item.titleOriginal || '');
  const names = [candidate.title, candidate.name, candidate.original_title, candidate.original_name].filter(Boolean).map((name) => normalizeText(String(name)));
  let value = 0;
  if (names.includes(query)) value += 90;
  if (original && names.includes(original)) value += 40;
  if (names.some((name) => name.includes(query) || query.includes(name))) value += 20;
  const year = getYear(candidate.release_date || candidate.first_air_date);
  if (item.year && year === item.year) value += 25;
  if (candidate.poster_path) value += 10;
  if (candidate.overview) value += 8;
  if ((candidate.vote_count || 0) > 100) value += 4;
  return value;
}

async function tmdbFetch<T>(path: string): Promise<T> {
  const response = await fetch(`https://api.themoviedb.org/3${withApiKey(path)}`, { headers: getHeaders() });
  if (!response.ok) throw new Error(`TMDB ${response.status}`);
  return response.json();
}

async function kinopoiskFetch<T>(path: string): Promise<T> {
  const key = getKinopoiskKey();
  if (!key) throw new Error('Нет ключа Kinopoisk');
  const response = await fetch(`https://kinopoiskapiunofficial.tech/api${path}`, {
    headers: {
      'X-API-KEY': key,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) throw new Error(`Kinopoisk ${response.status}`);
  return response.json();
}

function tmdbCandidateToResult(candidate: TMDBCandidate, sourceType: 'movie' | 'tv'): ApiSearchResult {
  return {
    source: 'tmdb',
    sourceLabel: 'TMDB',
    sourceId: String(candidate.id),
    titleRu: candidate.title || candidate.name || '',
    titleOriginal: candidate.original_title || candidate.original_name || candidate.title || candidate.name || '',
    type: sourceType === 'tv' ? 'series' : 'movie',
    year: getYear(candidate.release_date || candidate.first_air_date),
    posterUrl: imageUrl(candidate.poster_path, 'w500'),
    backdropUrl: imageUrl(candidate.backdrop_path, 'w1280'),
    description: candidate.overview || '',
    genres: (candidate.genre_ids || []).map((id) => tmdbGenreMap[id]).filter(Boolean),
    tmdbId: candidate.id,
  };
}

function kinopoiskSearchToResult(item: KinopoiskSearchItem): ApiSearchResult {
  return {
    source: 'kinopoisk',
    sourceLabel: 'Кинопоиск',
    sourceId: String(item.filmId),
    titleRu: item.nameRu || item.nameOriginal || item.nameEn || '',
    titleOriginal: item.nameOriginal || item.nameEn || item.nameRu || '',
    type: kpTypeToMediaType(item.type),
    year: getYear(item.year),
    posterUrl: item.posterUrl || '',
    description: item.description || '',
    genres: (item.genres || []).map((genre) => genre.genre).filter(Boolean),
    kinopoiskId: item.filmId,
  };
}

function kinopoiskDetailsToResult(details: KinopoiskDetails): ApiSearchResult {
  return {
    source: 'kinopoisk',
    sourceLabel: 'Кинопоиск',
    sourceId: String(details.kinopoiskId),
    titleRu: details.nameRu || details.nameOriginal || details.nameEn || '',
    titleOriginal: details.nameOriginal || details.nameEn || details.nameRu || '',
    type: kpTypeToMediaType(details.type),
    year: getYear(details.year),
    posterUrl: details.posterUrl || '',
    backdropUrl: details.coverUrl || details.posterUrl || '',
    description: details.description || details.shortDescription || '',
    genres: (details.genres || []).map((genre) => genre.genre).filter(Boolean),
    countries: (details.countries || []).map((country) => country.country).filter(Boolean),
    kinopoiskRating: numberOrUndefined(details.ratingKinopoisk),
    imdbRating: numberOrUndefined(details.ratingImdb),
    kinopoiskId: details.kinopoiskId,
    imdbId: details.imdbId,
  };
}

type PoiskKinoMovie = {
  id: number;
  name?: string;
  alternativeName?: string;
  enName?: string;
  type?: string;
  year?: number;
  description?: string;
  shortDescription?: string;
  poster?: { url?: string; previewUrl?: string };
  backdrop?: { url?: string; previewUrl?: string };
  genres?: { name: string }[];
  countries?: { name: string }[];
  rating?: { kp?: number; imdb?: number };
  externalId?: { imdb?: string; tmdb?: number };
};

function poiskKinoTypeToMediaType(type?: string): MediaType {
  if (type === 'tv-series' || type === 'animated-series') return 'series';
  if (type === 'anime') return 'anime';
  if (type === 'cartoon') return 'cartoon';
  return 'movie';
}

function poiskKinoToResult(movie: PoiskKinoMovie): ApiSearchResult {
  return {
    source: 'poiskkino',
    sourceLabel: 'ПоискКино',
    sourceId: String(movie.id),
    titleRu: movie.name || movie.alternativeName || movie.enName || '',
    titleOriginal: movie.alternativeName || movie.enName || movie.name || '',
    type: poiskKinoTypeToMediaType(movie.type),
    year: movie.year,
    posterUrl: movie.poster?.url || movie.poster?.previewUrl || '',
    backdropUrl: movie.backdrop?.url || movie.backdrop?.previewUrl || movie.poster?.url || '',
    description: movie.description || movie.shortDescription || '',
    genres: (movie.genres || []).map((genre) => genre.name).filter(Boolean),
    countries: (movie.countries || []).map((country) => country.name).filter(Boolean),
    kinopoiskRating: numberOrUndefined(movie.rating?.kp),
    imdbRating: numberOrUndefined(movie.rating?.imdb),
    kinopoiskId: movie.id,
    imdbId: movie.externalId?.imdb,
    tmdbId: movie.externalId?.tmdb,
  };
}

function omdbToResult(result: OMDBResult): ApiSearchResult | null {
  if (result.Response === 'False') return null;
  return {
    source: 'omdb',
    sourceLabel: 'OMDb',
    sourceId: result.imdbID || result.Title || '',
    titleRu: result.Title || '',
    titleOriginal: result.Title || '',
    type: omdbTypeToMediaType(result.Type),
    year: getYear(result.Year),
    posterUrl: result.Poster && result.Poster !== 'N/A' ? result.Poster : '',
    description: result.Plot && result.Plot !== 'N/A' ? result.Plot : '',
    genres: result.Genre ? result.Genre.split(',').map((genre) => genre.trim()).filter(Boolean) : [],
    countries: result.Country ? result.Country.split(',').map((country) => country.trim()).filter(Boolean) : [],
    imdbRating: numberOrUndefined(result.imdbRating),
    imdbId: result.imdbID,
  };
}

export function canUseTMDB() {
  return Boolean(getTMDBKey() || getTMDBToken());
}

export function canUseKinopoisk() {
  return Boolean(getKinopoiskKey());
}

export function canUseOMDB() {
  return Boolean(getOMDBKey());
}

export function canUsePoiskKino() {
  return Boolean(getPoiskKinoKey());
}

export function mergeApiResultIntoItem(result: ApiSearchResult, base?: MediaItem): MediaItem {
  return {
    id: base?.id || `media-${result.titleRu.toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-').replace(/^-|-$/g, '')}-${Date.now()}`,
    titleRu: result.titleRu || base?.titleRu || 'Без названия',
    titleOriginal: result.titleOriginal || base?.titleOriginal || result.titleRu,
    type: result.type || base?.type || 'movie',
    year: result.year || base?.year,
    posterUrl: result.posterUrl || base?.posterUrl || '',
    backdropUrl: result.backdropUrl || result.posterUrl || base?.backdropUrl || base?.posterUrl || '',
    description: result.description || base?.description || '',
    genres: result.genres?.length ? result.genres : (base?.genres || ['драма']),
    countries: result.countries?.length ? result.countries : base?.countries,
    myRating: base?.myRating,
    myReview: base?.myReview || '',
    watchedAt: base?.watchedAt,
    addedAt: base?.addedAt || new Date().toISOString(),
    isFavorite: base?.isFavorite,
    isTop: base?.isTop,
    rewatch: base?.rewatch,
    guestRating: base?.guestRating,
    guestVotes: base?.guestVotes,
    tmdbId: result.tmdbId || base?.tmdbId,
    kinopoiskId: result.kinopoiskId || base?.kinopoiskId,
    imdbId: result.imdbId || base?.imdbId,
    kinopoiskRating: result.kinopoiskRating || base?.kinopoiskRating,
    imdbRating: result.imdbRating || base?.imdbRating,
  };
}

export async function searchAllMovieApis(query: string): Promise<ApiSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const tasks: Promise<ApiSearchResult[]>[] = [];

  if (canUseTMDB()) {
    tasks.push((async () => {
      const [movieData, tvData] = await Promise.all([
        tmdbFetch<{ results?: TMDBCandidate[] }>(`/search/movie?language=ru-RU&query=${encodeURIComponent(trimmed)}&page=1&include_adult=false`),
        tmdbFetch<{ results?: TMDBCandidate[] }>(`/search/tv?language=ru-RU&query=${encodeURIComponent(trimmed)}&page=1&include_adult=false`),
      ]);
      return [
        ...(movieData.results || []).slice(0, 6).map((item) => tmdbCandidateToResult(item, 'movie')),
        ...(tvData.results || []).slice(0, 4).map((item) => tmdbCandidateToResult(item, 'tv')),
      ];
    })());
  }

  if (canUseKinopoisk()) {
    tasks.push((async () => {
      const data = await kinopoiskFetch<{ films?: KinopoiskSearchItem[] }>(`/v2.1/films/search-by-keyword?keyword=${encodeURIComponent(trimmed)}&page=1`);
      return (data.films || []).slice(0, 8).map(kinopoiskSearchToResult);
    })());
  }

  if (canUsePoiskKino()) {
    tasks.push((async () => {
      const response = await fetch(`https://api.poiskkino.dev/v1.4/movie/search?query=${encodeURIComponent(trimmed)}&limit=8`, {
        headers: { 'X-API-KEY': getPoiskKinoKey() },
      });
      if (!response.ok) return [];
      const data = await response.json() as { docs?: PoiskKinoMovie[] };
      return (data.docs || []).map(poiskKinoToResult);
    })());
  }

  if (canUseOMDB()) {
    tasks.push((async () => {
      const response = await fetch(`https://www.omdbapi.com/?apikey=${getOMDBKey()}&t=${encodeURIComponent(trimmed)}&plot=short`);
      if (!response.ok) return [];
      const result = omdbToResult(await response.json());
      return result ? [result] : [];
    })());
  }

  const settled = await Promise.allSettled(tasks);
  const results = settled.flatMap((entry) => entry.status === 'fulfilled' ? entry.value : []);
  const seen = new Set<string>();
  return results.filter((result) => {
    const key = `${result.source}:${result.sourceId}`;
    if (seen.has(key) || !result.titleRu) return false;
    seen.add(key);
    return true;
  }).slice(0, 18);
}

export async function hydrateApiResult(result: ApiSearchResult): Promise<ApiSearchResult> {
  if (result.source === 'kinopoisk' && result.kinopoiskId && canUseKinopoisk()) {
    const details = await kinopoiskFetch<KinopoiskDetails>(`/v2.2/films/${result.kinopoiskId}`);
    return { ...result, ...kinopoiskDetailsToResult(details) };
  }

  if (result.source === 'tmdb' && result.tmdbId && canUseTMDB()) {
    const type = result.type === 'series' || result.type === 'show' ? 'tv' : 'movie';
    const details = await tmdbFetch<TMDBDetails>(`/${type}/${result.tmdbId}?language=ru-RU&append_to_response=external_ids`);
    return {
      ...result,
      titleRu: details.title || details.name || result.titleRu,
      titleOriginal: details.original_title || details.original_name || result.titleOriginal,
      year: getYear(details.release_date || details.first_air_date) || result.year,
      posterUrl: imageUrl(details.poster_path, 'w500') || result.posterUrl,
      backdropUrl: imageUrl(details.backdrop_path, 'w1280') || result.backdropUrl,
      description: details.overview || result.description,
      genres: details.genres?.length ? details.genres.map((genre) => genre.name) : result.genres,
      imdbId: details.external_ids?.imdb_id || result.imdbId,
    };
  }

  return result;
}

export async function enrichOneFromTMDB(item: MediaItem): Promise<MediaItem | null> {
  if (!canUseTMDB()) return null;
  const cacheKey = `${item.id}:${item.titleRu}:${item.year || ''}`;
  if (memoryCache.has(cacheKey)) return memoryCache.get(cacheKey) || null;

  const type = tmdbType(item.type);
  const yearParam = item.year ? `&${type === 'movie' ? 'year' : 'first_air_date_year'}=${item.year}` : '';
  const search = await tmdbFetch<{ results?: TMDBCandidate[] }>(`/search/${type}?language=ru-RU&query=${encodeURIComponent(item.titleRu)}&page=1&include_adult=false${yearParam}`);
  const best = (search.results || [])
    .map((candidate) => ({ candidate, score: score(item, candidate) }))
    .sort((a, b) => b.score - a.score)[0];

  if (!best || best.score < 55) {
    memoryCache.set(cacheKey, null);
    return null;
  }

  const details = await tmdbFetch<TMDBDetails>(`/${type}/${best.candidate.id}?language=ru-RU&append_to_response=external_ids`);
  const next: MediaItem = {
    ...item,
    titleRu: details.title || details.name || item.titleRu,
    titleOriginal: details.original_title || details.original_name || item.titleOriginal,
    year: getYear(details.release_date || details.first_air_date) || item.year,
    posterUrl: imageUrl(details.poster_path, 'w500') || item.posterUrl,
    backdropUrl: imageUrl(details.backdrop_path, 'w1280') || imageUrl(details.poster_path, 'w500') || item.backdropUrl,
    description: details.overview || item.description,
    genres: details.genres?.length ? details.genres.map((genre) => genre.name) : item.genres,
    tmdbId: details.id || item.tmdbId,
    imdbId: details.external_ids?.imdb_id || item.imdbId,
  };
  memoryCache.set(cacheKey, next);
  return next;
}
