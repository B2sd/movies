import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdminPanel } from './components/AdminPanel';
import { Filters } from './components/Filters';
import { Hero } from './components/Hero';
import { MediaCard } from './components/MediaCard';
import { MediaModal } from './components/MediaModal';
import { seedComments } from './data/seed';
import { filterAndSortMedia, getPosterUrl, isGeneratedPosterUrl, normalizeText } from './lib/helpers';
import { canUseTMDB, enrichOneFromTMDB } from './lib/tmdb';
import { getAdminStatus, hasSupabaseConfig, loadComments as loadSupaComments, loadGuestRatings, loadMediaItems, loadPendingRatings as loadSupaPendingRatings, loadActivityLogs as loadSupaActivityLogs, submitComment as submitSupaComment, submitGuestRating, approveGuestRating as approveSupaGuestRating, deleteGuestRating as deleteSupaGuestRating, submitActivityLog as submitSupaActivityLog, approveComment as approveSupaComment, deleteComment as deleteSupaComment, saveMediaItem, deleteMediaItem } from './lib/supabase';
import type { ActivityLog, MediaItem, MediaType, PublicComment, PublicRating, SortMode } from './types';
import './App.css';

const STORAGE_MEDIA_KEY = 'karan-media-items-v11';
const STORAGE_COMMENTS_KEY = 'karan-comments-v2';
const STORAGE_RATINGS_QUEUE_KEY = 'karan-ratings-queue-v1';
const STORAGE_LOGS_KEY = 'karan-activity-logs-v1';
const STORAGE_RATED_KEY = 'karan-rated-media-v1';
const PAGE_SIZE = 10000;

function mergeMedia(primary: MediaItem[], secondary: MediaItem[]) {
  const map = new Map<string, MediaItem>();
  [...secondary, ...primary].forEach((item) => {
    const key = normalizeText(item.titleRu);
    const current = map.get(key);
    map.set(key, {
      ...current,
      ...item,
      myRating: current?.myRating ?? item.myRating,
      myReview: current?.myReview ?? item.myReview,
      isFavorite: current?.isFavorite ?? item.isFavorite,
      isTop: current?.isTop ?? item.isTop,
      topRank: current?.topRank ?? item.topRank,
      rewatch: current?.rewatch ?? item.rewatch,
      guestRating: current?.guestRating ?? item.guestRating,
      guestVotes: current?.guestVotes ?? item.guestVotes,
      kinopoiskRating: item.kinopoiskRating ?? current?.kinopoiskRating,
      imdbRating: item.imdbRating ?? current?.imdbRating,
      kinopoiskId: item.kinopoiskId ?? current?.kinopoiskId,
      imdbId: item.imdbId ?? current?.imdbId,
      tmdbId: item.tmdbId ?? current?.tmdbId,
    });
  });
  return Array.from(map.values());
}

const defaultMedia: MediaItem[] = [];

function readStorage<T>(key: string, fallback: T) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [items, setItems] = useState<MediaItem[]>(() => mergeMedia(readStorage(STORAGE_MEDIA_KEY, defaultMedia), defaultMedia));
  const [comments, setComments] = useState<PublicComment[]>(() => readStorage(STORAGE_COMMENTS_KEY, seedComments));
  const [pendingRatings, setPendingRatings] = useState<PublicRating[]>(() => readStorage(STORAGE_RATINGS_QUEUE_KEY, []));
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(() => readStorage(STORAGE_LOGS_KEY, []));
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [autoPosterStatus, setAutoPosterStatus] = useState('');
  const [ratedMediaIds, setRatedMediaIds] = useState<string[]>(() => readStorage(STORAGE_RATED_KEY, []));
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [type, setType] = useState<MediaType | 'all'>('all');
  const [sort, setSort] = useState<SortMode>('rating-desc');
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(() => ['localhost', '127.0.0.1'].includes(window.location.hostname) && localStorage.getItem('karan-admin-unlocked') === 'true');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(value);
      setVisibleCount(PAGE_SIZE);
    }, 250);
  }, []);

  const handleTypeChange = useCallback((nextType: MediaType | 'all') => {
    setType(nextType);
    setVisibleCount(PAGE_SIZE);
  }, []);

  const handleSortChange = useCallback((nextSort: SortMode) => {
    setSort(nextSort);
    setVisibleCount(PAGE_SIZE);
  }, []);

  useEffect(() => {
    localStorage.removeItem('karan-media-items-v2');
    localStorage.removeItem('karan-media-items-v3');
    localStorage.removeItem('karan-media-items-v4');
    localStorage.removeItem('karan-media-items-v5');
    localStorage.removeItem('karan-media-items-v6');
    localStorage.removeItem('karan-media-items-v7');
    localStorage.removeItem('karan-media-items-v8');
    localStorage.removeItem('karan-media-items-v9');
    localStorage.removeItem('karan-media-items-v10');
    return () => clearTimeout(debounceRef.current);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (hasSupabaseConfig) {
      getAdminStatus().then((status) => {
        if (!cancelled) setIsAdminUnlocked(status.isAdmin);
      });
    }
    import('./data/enrichedMedia').then(({ enrichedMedia }) => {
      if (cancelled) return;
      setItems((current) => mergeMedia(enrichedMedia, current));
      setCatalogLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_MEDIA_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem(STORAGE_COMMENTS_KEY, JSON.stringify(comments));
  }, [comments]);

  useEffect(() => {
    localStorage.setItem(STORAGE_RATINGS_QUEUE_KEY, JSON.stringify(pendingRatings));
  }, [pendingRatings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_LOGS_KEY, JSON.stringify(activityLogs));
  }, [activityLogs]);

  useEffect(() => {
    localStorage.setItem(STORAGE_RATED_KEY, JSON.stringify(ratedMediaIds));
  }, [ratedMediaIds]);

  useEffect(() => {
    if (!catalogLoaded || !canUseTMDB()) return;
    const targets = items.filter((item) => isGeneratedPosterUrl(item.posterUrl)).slice(0, 40);
    if (targets.length === 0) return;

    let cancelled = false;
    (async () => {
      setAutoPosterStatus(`Пробую заменить ${targets.length} автопостеров через TMDB...`);
      let updated = 0;
      for (const target of targets) {
        if (cancelled) return;
        try {
          const enriched = await enrichOneFromTMDB(target);
          if (!enriched || isGeneratedPosterUrl(enriched.posterUrl)) continue;
          updated += 1;
          setItems((current) => current.map((item) => item.id === target.id ? { ...item, ...enriched } : item));
          await new Promise((resolve) => setTimeout(resolve, 180));
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
      if (!cancelled) setAutoPosterStatus(updated ? `Обновлено реальных постеров: ${updated}` : 'TMDB не смог заменить автопостеры в этой партии');
    })();

    return () => {
      cancelled = true;
    };
  }, [catalogLoaded, items]);

  useEffect(() => {
    if (!hasSupabaseConfig) return;
    (async () => {
      const [supaItems, ratings, supaComments, supaPendingRatings, supaLogs] = await Promise.all([loadMediaItems(), loadGuestRatings(), loadSupaComments(), loadSupaPendingRatings(), loadSupaActivityLogs()]);
      if (supaItems.length > 0) {
        setItems((current) => mergeMedia(supaItems, current));
      }
      if (Object.keys(ratings).length > 0) {
        setItems((current) => current.map((item) => {
          const r = ratings[item.id];
          if (!r) return item;
          return { ...item, guestRating: r.rating, guestVotes: r.votes };
        }));
      }
      if (supaComments.length > 0) {
        setComments((current) => {
          const existing = new Set(current.map((c) => c.id));
          const newComments = supaComments.filter((c) => !existing.has(c.id));
          return newComments.length > 0 ? [...newComments, ...current] : current;
        });
      }
      if (supaPendingRatings.length > 0) {
        setPendingRatings((current) => {
          const existing = new Set(current.map((r) => r.id));
          const next = supaPendingRatings.filter((r) => !existing.has(r.id));
          return next.length > 0 ? [...next, ...current] : current;
        });
      }
      if (supaLogs.length > 0) {
        setActivityLogs((current) => {
          const existing = new Set(current.map((l) => l.id));
          const next = supaLogs.filter((l) => !existing.has(l.id));
          return next.length > 0 ? [...next, ...current].slice(0, 300) : current;
        });
      }
    })();
  }, []);

  const filteredItems = useMemo(() => filterAndSortMedia([...items], debouncedQuery, type, sort), [items, debouncedQuery, type, sort]);
  const visibleItems = useMemo(() => filteredItems.slice(0, visibleCount), [filteredItems, visibleCount]);
  const topItems = useMemo(() => [...items]
    .filter((item) => item.topRank)
    .sort((a, b) => (a.topRank || 99) - (b.topRank || 99) || (b.myRating || 0) - (a.myRating || 0) || a.titleRu.localeCompare(b.titleRu, 'ru')), [items]);
  const selectedItem = selected ? items.find((item) => item.id === selected.id) || selected : null;
  const approvedCommentsCount = useMemo(() => comments.reduce<Record<string, number>>((acc, comment) => {
    if (comment.status !== 'approved') return acc;
    acc[comment.mediaId] = (acc[comment.mediaId] || 0) + 1;
    return acc;
  }, {}), [comments]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      if (adminOpen) {
        setAdminOpen(false);
        return;
      }
      if (selected) setSelected(null);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [adminOpen, selected]);

  function addLog(action: string, target: string, details?: string, actor = 'Система') {
    const log: ActivityLog = {
      id: `log-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      actor,
      action,
      target,
      details,
      createdAt: new Date().toISOString(),
    };
    setActivityLogs((current) => [log, ...current].slice(0, 300));
    if (hasSupabaseConfig) {
      submitSupaActivityLog({ actor: log.actor, action: log.action, target: log.target, details: log.details, createdAt: log.createdAt });
    }
  }

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisibleCount((c) => Math.min(c + PAGE_SIZE, filteredItems.length));
      }
    }, { rootMargin: '400px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [filteredItems.length]);

  function handleAddComment(comment: Omit<PublicComment, 'id' | 'createdAt' | 'status'>) {
    const newComment: PublicComment = {
      ...comment,
      id: `comment-${Date.now()}`,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    setComments((current) => [newComment, ...current]);
    addLog('Комментарий отправлен на модерацию', itemTitle(comment.mediaId), comment.comment, comment.visitorName.trim());
    if (hasSupabaseConfig) {
      submitSupaComment({ mediaId: comment.mediaId, visitorName: comment.visitorName, comment: comment.comment });
    }
  }

  function itemTitle(mediaId: string) {
    return items.find((item) => item.id === mediaId)?.titleRu || mediaId;
  }

  function handleRate(mediaId: string, rating: number) {
    if (ratedMediaIds.includes(mediaId)) return;

    const newRating: PublicRating = {
      id: `rating-${Date.now()}`,
      mediaId,
      visitorName: 'Гость',
      rating,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    setPendingRatings((current) => [newRating, ...current]);
    setRatedMediaIds((current) => current.includes(mediaId) ? current : [...current, mediaId]);
    addLog('Оценка зрителя отправлена на модерацию', itemTitle(mediaId), `${rating}/10`, 'Гость');
    if (hasSupabaseConfig) submitGuestRating(mediaId, rating);
  }

  function applyApprovedRating(mediaId: string, rating: number) {
    setItems((current) => current.map((item) => {
      if (item.id !== mediaId) return item;
      const votes = item.guestVotes || 0;
      const average = item.guestRating || rating;
      const nextAverage = ((average * votes) + rating) / (votes + 1);
      return { ...item, guestRating: Number(nextAverage.toFixed(1)), guestVotes: votes + 1 };
    }));
  }

  function handleApproveRating(id: string) {
    const rating = pendingRatings.find((entry) => entry.id === id);
    if (!rating) return;
    applyApprovedRating(rating.mediaId, rating.rating);
    setPendingRatings((current) => current.filter((entry) => entry.id !== id));
    addLog('Оценка зрителя одобрена', itemTitle(rating.mediaId), `${rating.rating}/10`, 'Админ');
    if (hasSupabaseConfig) approveSupaGuestRating(id);
  }

  function handleDeleteRating(id: string) {
    const rating = pendingRatings.find((entry) => entry.id === id);
    setPendingRatings((current) => current.filter((entry) => entry.id !== id));
    if (rating) addLog('Оценка зрителя отклонена', itemTitle(rating.mediaId), `${rating.rating}/10`, 'Админ');
    if (hasSupabaseConfig) deleteSupaGuestRating(id);
  }

  function handleAddItem(item: MediaItem) {
    setItems((current) => [item, ...current]);
    addLog('Добавлена карточка', item.titleRu, item.titleOriginal, 'Админ');
    if (hasSupabaseConfig) saveMediaItem(item);
  }

  function handleUpdateItem(updatedItem: MediaItem) {
    setItems((current) => current.map((item) => item.id === updatedItem.id ? updatedItem : item));
    addLog('Обновлена карточка', updatedItem.titleRu, updatedItem.myRating ? `моя оценка: ${updatedItem.myRating}/10` : undefined, 'Админ');
    if (hasSupabaseConfig) saveMediaItem(updatedItem);
  }

  function handleDeleteItem(id: string) {
    const deleted = items.find((item) => item.id === id);
    setItems((current) => current.filter((item) => item.id !== id));
    setComments((current) => current.filter((comment) => comment.mediaId !== id));
    setPendingRatings((current) => current.filter((rating) => rating.mediaId !== id));
    if (selected?.id === id) setSelected(null);
    addLog('Удалена карточка', deleted?.titleRu || id, undefined, 'Админ');
    if (hasSupabaseConfig) deleteMediaItem(id);
  }

  function handleApproveComment(id: string) {
    const comment = comments.find((entry) => entry.id === id);
    setComments((current) => current.map((entry) => entry.id === id ? { ...entry, status: 'approved' } : entry));
    if (comment) addLog('Комментарий одобрен', itemTitle(comment.mediaId), comment.comment, 'Админ');
    if (hasSupabaseConfig) approveSupaComment(id);
  }

  function handleDeleteComment(id: string) {
    const comment = comments.find((entry) => entry.id === id);
    setComments((current) => current.filter((entry) => entry.id !== id));
    if (comment) addLog('Комментарий удален', itemTitle(comment.mediaId), comment.comment, 'Админ');
    if (hasSupabaseConfig) deleteSupaComment(id);
  }

  return (
    <main>
      <Hero items={items} onOpenAdmin={() => setAdminOpen(true)} />

      <section className="container top-section">
        <div className="section-head">
          <div>
            <span className="eyebrow small">Мой топ</span>
          </div>
        </div>
        <div className="top-strip top-rank-board">
          {[1, 2, 3, 4, 5].map((rank) => {
            const rankItems = topItems.filter((entry) => entry.topRank === rank);
            return (
              <div key={rank} className="top-rank-column">
                <span className="top-rank-label">Топ {rank}</span>
                <div className="top-rank-list">
                  {rankItems.length === 0 ? (
                    <div className="top-rank-card top-rank-empty">
                      <div>
                        <strong>Пусто</strong>
                        <small>Выбери фильм</small>
                      </div>
                    </div>
                  ) : rankItems.map((item) => (
                    <button key={item.id} className="top-rank-card" onClick={() => setSelected(item)}>
                      <img
                        src={getPosterUrl(item)}
                        alt={item.titleRu}
                        onError={(event) => {
                          event.currentTarget.src = getPosterUrl({ ...item, posterUrl: '' });
                        }}
                      />
                      <div>
                        <strong>{item.titleRu}</strong>
                        <small>{item.myRating ? `${item.myRating}/10` : item.year || 'без оценки'}</small>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section id="catalog" className="container catalog-section">
        <div className="section-head">
          <div>
            <span className="eyebrow small">Каталог</span>
            <h2>Все просмотренное</h2>
          </div>
          <p>{autoPosterStatus || (catalogLoaded ? `Найдено: ${filteredItems.length} из ${items.length}` : 'Загружаю полный каталог...')}</p>
        </div>

        <Filters selectedType={type} query={query} onQueryChange={handleQueryChange} onTypeChange={handleTypeChange} sort={sort} onSortChange={handleSortChange} />

        {filteredItems.length === 0 ? (
          <div className="empty-state">
            <h3>Ничего не найдено</h3>
            <p>Попробуй изменить поиск или фильтр типа контента.</p>
          </div>
        ) : (
          <>
            <div className="media-grid">
              {visibleItems.map((item) => (
                <MediaCard key={item.id} item={item} commentsCount={approvedCommentsCount[item.id] || 0} onSelect={setSelected} />
              ))}
            </div>
            {visibleCount < filteredItems.length && (
              <div ref={sentinelRef} className="load-more-wrap">
                <div className="load-spinner" />
              </div>
            )}
          </>
        )}
      </section>

      <footer className="footer">
        <strong>Киноархив</strong>
        <span>React + TypeScript + Vite + Supabase + GitHub Pages</span>
      </footer>

      {selectedItem && (
        <MediaModal
          key={selectedItem.id}
          item={selectedItem}
          comments={comments}
          onClose={() => setSelected(null)}
          onAddComment={handleAddComment}
          onRate={handleRate}
          hasRated={ratedMediaIds.includes(selectedItem.id)}
          isAdminUnlocked={isAdminUnlocked}
          onUpdateItem={handleUpdateItem}
          onDeleteItem={handleDeleteItem}
        />
      )}

      {adminOpen && (
        <AdminPanel
          items={items}
          comments={comments}
          pendingRatings={pendingRatings}
          activityLogs={activityLogs}
          onApproveRating={handleApproveRating}
          onDeleteRating={handleDeleteRating}
          onAddItem={handleAddItem}
          onUpdateItem={handleUpdateItem}
          onDeleteItem={handleDeleteItem}
          onApproveComment={handleApproveComment}
          onDeleteComment={handleDeleteComment}
          onAdminUnlockedChange={setIsAdminUnlocked}
          onClose={() => setAdminOpen(false)}
        />
      )}
    </main>
  );
}
