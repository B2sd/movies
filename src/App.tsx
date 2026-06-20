import { useEffect, useMemo, useState } from 'react';
import { AdminPanel } from './components/AdminPanel';
import { Filters } from './components/Filters';
import { Hero } from './components/Hero';
import { MediaCard } from './components/MediaCard';
import { MediaModal } from './components/MediaModal';
import { importedMedia } from './data/importedMedia';
import { seedComments, seedMedia } from './data/seed';
import { filterAndSortMedia, normalizeText } from './lib/helpers';
import type { MediaItem, MediaType, PublicComment, SortMode } from './types';
import './App.css';

const STORAGE_MEDIA_KEY = 'karan-media-items-v2';
const STORAGE_COMMENTS_KEY = 'karan-comments-v2';

function mergeMedia(primary: MediaItem[], secondary: MediaItem[]) {
  const map = new Map<string, MediaItem>();
  [...secondary, ...primary].forEach((item) => {
    map.set(normalizeText(item.titleRu), item);
  });
  return Array.from(map.values());
}

const defaultMedia = mergeMedia(seedMedia, importedMedia);

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
  const [query, setQuery] = useState('');
  const [type, setType] = useState<MediaType | 'all'>('all');
  const [sort, setSort] = useState<SortMode>('added-desc');
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_MEDIA_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem(STORAGE_COMMENTS_KEY, JSON.stringify(comments));
  }, [comments]);

  const filteredItems = useMemo(() => filterAndSortMedia([...items], query, type, sort), [items, query, type, sort]);
  const topItems = useMemo(() => [...items].filter((item) => item.isTop).sort((a, b) => (b.myRating || 0) - (a.myRating || 0)).slice(0, 8), [items]);

  function handleAddComment(comment: Omit<PublicComment, 'id' | 'createdAt' | 'status'>) {
    setComments((current) => [{
      ...comment,
      id: `comment-${Date.now()}`,
      status: 'pending',
      createdAt: new Date().toISOString(),
    }, ...current]);
  }

  function handleRate(mediaId: string, rating: number) {
    setItems((current) => current.map((item) => {
      if (item.id !== mediaId) return item;
      const votes = item.guestVotes || 0;
      const average = item.guestRating || rating;
      const nextAverage = ((average * votes) + rating) / (votes + 1);
      const updated = { ...item, guestRating: Number(nextAverage.toFixed(1)), guestVotes: votes + 1 };
      if (selected?.id === mediaId) setSelected(updated);
      return updated;
    }));
  }

  function handleAddItem(item: MediaItem) {
    setItems((current) => [item, ...current]);
  }

  function handleApproveComment(id: string) {
    setComments((current) => current.map((comment) => comment.id === id ? { ...comment, status: 'approved' } : comment));
  }

  function handleDeleteComment(id: string) {
    setComments((current) => current.filter((comment) => comment.id !== id));
  }

  return (
    <main>
      <Hero items={items} query={query} onQueryChange={setQuery} onOpenAdmin={() => setAdminOpen(true)} />

      <section className="container top-section">
        <div className="section-head">
          <div>
            <span className="eyebrow small">Личный топ</span>
            <h2>Лучшее из архива</h2>
          </div>
          <p>Фильмы и сериалы с максимальной личной оценкой. Позже сюда можно добавить отдельную страницу топов.</p>
        </div>
        <div className="top-strip">
          {topItems.map((item, index) => (
            <button key={item.id} className="top-item" onClick={() => setSelected(item)}>
              <span>{index + 1}</span>
              <img src={item.posterUrl} alt={item.titleRu} />
              <strong>{item.titleRu}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="container catalog-section">
        <div className="section-head">
          <div>
            <span className="eyebrow small">Каталог</span>
            <h2>Все просмотренное</h2>
          </div>
          <p>Найдено: {filteredItems.length} из {items.length}</p>
        </div>

        <Filters selectedType={type} onTypeChange={setType} sort={sort} onSortChange={setSort} />

        {filteredItems.length === 0 ? (
          <div className="empty-state">
            <h3>Ничего не найдено</h3>
            <p>Попробуй изменить поиск или фильтр типа контента.</p>
          </div>
        ) : (
          <div className="media-grid">
            {filteredItems.map((item) => (
              <MediaCard key={item.id} item={item} onSelect={setSelected} />
            ))}
          </div>
        )}
      </section>

      <footer className="footer">
        <strong>Киноархив Карана</strong>
        <span>React + TypeScript + Vite + Supabase-ready + GitHub Pages</span>
      </footer>

      {selected && (
        <MediaModal
          item={selected}
          comments={comments}
          onClose={() => setSelected(null)}
          onAddComment={handleAddComment}
          onRate={handleRate}
        />
      )}

      {adminOpen && (
        <AdminPanel
          items={items}
          comments={comments}
          onAddItem={handleAddItem}
          onApproveComment={handleApproveComment}
          onDeleteComment={handleDeleteComment}
          onClose={() => setAdminOpen(false)}
        />
      )}
    </main>
  );
}
