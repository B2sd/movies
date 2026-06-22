import { createClient } from '@supabase/supabase-js';
import type { ActivityLog, MediaItem, PublicComment, PublicRating } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export const adminEmail = import.meta.env.VITE_ADMIN_EMAIL || '';

export type AdminStatus = {
  isAdmin: boolean;
  email?: string;
};

export async function getAdminStatus(): Promise<AdminStatus> {
  if (!supabase) return { isAdmin: false };
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) return { isAdmin: false };

    const { data, error } = await supabase
      .from('profiles')
      .select('role, email')
      .eq('id', user.id)
      .single();

    if (error || !data) return { isAdmin: false, email: user.email };
    return { isAdmin: data.role === 'admin', email: data.email || user.email };
  } catch {
    return { isAdmin: false };
  }
}

export async function signInAdmin(email: string, password: string): Promise<boolean> {
  if (!supabase || !email.trim() || !password.trim()) return false;
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim(),
    });
    if (error) return false;

    const status = await getAdminStatus();
    if (!status.isAdmin) {
      await supabase.auth.signOut();
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function signOutAdmin(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

type MediaRow = {
  id: string;
  title_ru: string;
  title_original?: string | null;
  type: MediaItem['type'];
  year?: number | null;
  poster_url?: string | null;
  backdrop_url?: string | null;
  description?: string | null;
  genres?: string[] | null;
  countries?: string[] | null;
  tmdb_id?: number | null;
  kinopoisk_id?: number | null;
  imdb_id?: string | null;
  kinopoisk_rating?: number | null;
  imdb_rating?: number | null;
  my_rating?: number | null;
  my_review?: string | null;
  watched_at?: string | null;
  added_at?: string | null;
  is_favorite?: boolean | null;
  is_top?: boolean | null;
  top_rank?: number | null;
  rewatch?: boolean | null;
  guest_rating?: number | null;
  guest_votes?: number | null;
};

function mapMediaRow(row: MediaRow): MediaItem {
  return {
    id: row.id,
    titleRu: row.title_ru,
    titleOriginal: row.title_original || row.title_ru,
    type: row.type,
    year: row.year || undefined,
    posterUrl: row.poster_url || '',
    backdropUrl: row.backdrop_url || row.poster_url || '',
    description: row.description || '',
    genres: row.genres || [],
    countries: row.countries || [],
    tmdbId: row.tmdb_id || undefined,
    kinopoiskId: row.kinopoisk_id || undefined,
    imdbId: row.imdb_id || undefined,
    kinopoiskRating: row.kinopoisk_rating ? Number(row.kinopoisk_rating) : undefined,
    imdbRating: row.imdb_rating ? Number(row.imdb_rating) : undefined,
    myRating: row.my_rating ? Number(row.my_rating) : undefined,
    myReview: row.my_review || '',
    watchedAt: row.watched_at || undefined,
    addedAt: row.added_at || new Date().toISOString(),
    isFavorite: Boolean(row.is_favorite),
    isTop: Boolean(row.is_top),
    topRank: row.top_rank || undefined,
    rewatch: Boolean(row.rewatch),
    guestRating: row.guest_rating ? Number(row.guest_rating) : undefined,
    guestVotes: row.guest_votes ? Number(row.guest_votes) : 0,
  };
}

export async function loadMediaItems(): Promise<MediaItem[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('media_with_guest_rating')
      .select('*')
      .order('added_at', { ascending: false });
    if (error || !data) return [];
    return (data as MediaRow[]).map(mapMediaRow);
  } catch {
    return [];
  }
}

export async function loadGuestRatings(): Promise<Record<string, { rating: number; votes: number }>> {
  if (!supabase) return {};
  try {
    const { data, error } = await supabase
      .from('public_ratings')
      .select('media_id, rating')
      .eq('status', 'approved');
    if (error || !data) return {};
    const map: Record<string, { rating: number; votes: number }> = {};
    for (const row of data) {
      const id = row.media_id;
      if (!map[id]) map[id] = { rating: 0, votes: 0 };
      map[id].rating += row.rating;
      map[id].votes += 1;
    }
    for (const key of Object.keys(map)) {
      map[key].rating = Number((map[key].rating / map[key].votes).toFixed(1));
    }
    return map;
  } catch {
    return {};
  }
}

export async function submitGuestRating(mediaId: string, rating: number): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('public_ratings')
      .insert({ media_id: mediaId, rating, status: 'pending' });
    return !error;
  } catch {
    return false;
  }
}

export async function saveMediaItem(item: MediaItem): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('media_items')
      .upsert({
        id: item.id,
        title_ru: item.titleRu,
        title_original: item.titleOriginal,
        type: item.type,
        year: item.year,
        poster_url: item.posterUrl || '',
        backdrop_url: item.backdropUrl || item.posterUrl || '',
        description: item.description || '',
        genres: item.genres || [],
        countries: item.countries || [],
        tmdb_id: item.tmdbId,
        kinopoisk_id: item.kinopoiskId,
        imdb_id: item.imdbId,
        kinopoisk_rating: item.kinopoiskRating,
        imdb_rating: item.imdbRating,
        my_rating: item.myRating,
        my_review: item.myReview,
        watched_at: item.watchedAt,
        added_at: item.addedAt,
        is_favorite: item.isFavorite || false,
        is_top: item.isTop || false,
        top_rank: item.topRank,
        rewatch: item.rewatch || false,
      });
    return !error;
  } catch {
    return false;
  }
}

export async function deleteMediaItem(id: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('media_items')
      .delete()
      .eq('id', id);
    return !error;
  } catch {
    return false;
  }
}


export async function loadPendingRatings(): Promise<PublicRating[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('public_ratings')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    return data.map((row) => ({
      id: row.id,
      mediaId: row.media_id,
      visitorName: row.visitor_name || 'Гость',
      rating: Number(row.rating),
      status: row.status as PublicRating['status'],
      createdAt: row.created_at,
    }));
  } catch {
    return [];
  }
}

export async function approveGuestRating(id: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('public_ratings')
      .update({ status: 'approved' })
      .eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

export async function deleteGuestRating(id: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('public_ratings')
      .delete()
      .eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

export async function loadActivityLogs(): Promise<ActivityLog[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300);
    if (error || !data) return [];
    return data.map((row) => ({
      id: row.id,
      actor: row.actor,
      action: row.action,
      target: row.target,
      details: row.details || undefined,
      createdAt: row.created_at,
    }));
  } catch {
    return [];
  }
}

export async function submitActivityLog(log: Omit<ActivityLog, 'id'>): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('activity_logs')
      .insert({
        actor: log.actor,
        action: log.action,
        target: log.target,
        details: log.details,
        created_at: log.createdAt,
      });
    return !error;
  } catch {
    return false;
  }
}

export async function loadComments(): Promise<PublicComment[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    return data.map((row) => ({
      id: row.id,
      mediaId: row.media_id,
      visitorName: row.visitor_name,
      comment: row.comment,
      status: row.status as PublicComment['status'],
      createdAt: row.created_at,
    }));
  } catch {
    return [];
  }
}

export async function submitComment(comment: { mediaId: string; visitorName: string; comment: string }): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('comments')
      .insert({
        media_id: comment.mediaId,
        visitor_name: comment.visitorName,
        comment: comment.comment,
        status: 'pending',
      });
    return !error;
  } catch {
    return false;
  }
}

export async function approveComment(id: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('comments')
      .update({ status: 'approved' })
      .eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

export async function deleteComment(id: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', id);
    return !error;
  } catch {
    return false;
  }
}
