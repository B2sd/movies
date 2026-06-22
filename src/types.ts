export type MediaType = 'movie' | 'series' | 'cartoon' | 'anime' | 'show';

export type CommentStatus = 'pending' | 'approved' | 'rejected';

export type ActivityLog = {
  id: string;
  actor: string;
  action: string;
  target: string;
  details?: string;
  createdAt: string;
};

export type MediaItem = {
  id: string;
  titleRu: string;
  titleOriginal?: string;
  type: MediaType;
  year?: number;
  posterUrl: string;
  backdropUrl?: string;
  description: string;
  genres: string[];
  countries?: string[];
  myRating?: number;
  guestRating?: number;
  guestVotes?: number;
  kinopoiskRating?: number;
  imdbRating?: number;
  myReview?: string;
  watchedAt?: string;
  addedAt: string;
  isFavorite?: boolean;
  isTop?: boolean;
  rewatch?: boolean;
  tmdbId?: number;
  kinopoiskId?: number;
  imdbId?: string;
};

export type PublicComment = {
  id: string;
  mediaId: string;
  visitorName: string;
  comment: string;
  status: CommentStatus;
  createdAt: string;
};

export type PublicRating = {
  id: string;
  mediaId: string;
  visitorName?: string;
  rating: number;
  status: CommentStatus;
  createdAt: string;
};

export type SortMode = 'added-desc' | 'rating-desc' | 'year-desc' | 'guest-rating-desc' | 'title-asc';
