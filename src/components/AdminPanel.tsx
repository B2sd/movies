import { Check, LogIn, LogOut, Plus, Shield, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { MediaItem, MediaType, PublicComment } from '../types';
import { adminEmail, hasSupabaseConfig } from '../lib/supabase';

type Props = {
  items: MediaItem[];
  comments: PublicComment[];
  onAddItem: (item: MediaItem) => void;
  onApproveComment: (id: string) => void;
  onDeleteComment: (id: string) => void;
  onClose: () => void;
};

const emptyItem = {
  titleRu: '',
  titleOriginal: '',
  type: 'movie' as MediaType,
  year: new Date().getFullYear(),
  posterUrl: '',
  backdropUrl: '',
  description: '',
  genres: 'драма',
  myRating: 8,
  myReview: '',
};

export function AdminPanel({ items, comments, onAddItem, onApproveComment, onDeleteComment, onClose }: Props) {
  const [email, setEmail] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(() => localStorage.getItem('karan-admin-unlocked') === 'true');
  const [form, setForm] = useState(emptyItem);

  const pendingComments = useMemo(() => comments.filter((comment) => comment.status === 'pending'), [comments]);

  function login(event: React.FormEvent) {
    event.preventDefault();
    const byCode = accessCode.trim() === (import.meta.env.VITE_ADMIN_DEMO_CODE || 'karan');
    const byEmail = adminEmail && email.trim().toLowerCase() === adminEmail.toLowerCase();
    if (byCode || byEmail || !hasSupabaseConfig) {
      localStorage.setItem('karan-admin-unlocked', 'true');
      setIsUnlocked(true);
    }
  }

  function logout() {
    localStorage.removeItem('karan-admin-unlocked');
    setIsUnlocked(false);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.titleRu.trim() || !form.posterUrl.trim()) return;

    onAddItem({
      id: `${form.titleRu.toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-')}-${Date.now()}`,
      titleRu: form.titleRu.trim(),
      titleOriginal: form.titleOriginal.trim(),
      type: form.type,
      year: Number(form.year),
      posterUrl: form.posterUrl.trim(),
      backdropUrl: form.backdropUrl.trim() || form.posterUrl.trim(),
      description: form.description.trim() || 'Описание будет добавлено позже.',
      genres: form.genres.split(',').map((genre) => genre.trim()).filter(Boolean),
      myRating: Number(form.myRating),
      guestRating: undefined,
      guestVotes: 0,
      myReview: form.myReview.trim(),
      addedAt: new Date().toISOString(),
    });
    setForm(emptyItem);
  }

  return (
    <div className="admin-shell">
      <div className="admin-card">
        <div className="section-head compact">
          <div>
            <span className="eyebrow small"><Shield size={15} /> закрытая зона</span>
            <h2>Админ-панель</h2>
            <p>Добавление фильмов, будущая интеграция с TMDB или Кинопоиском и модерация комментариев.</p>
          </div>
          <div className="admin-actions">
            {isUnlocked && <button className="button ghost" onClick={logout}><LogOut size={18} /> Выйти</button>}
            <button className="button ghost" onClick={onClose}>Закрыть</button>
          </div>
        </div>

        {!isUnlocked ? (
          <form className="login-form" onSubmit={login}>
            <p className="hint">
              Сейчас включен демо-вход. Код по умолчанию: <strong>karan</strong>. После подключения Supabase доступ будет только по твоему email или magic link.
            </p>
            <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Твой email" />
            <input value={accessCode} onChange={(event) => setAccessCode(event.target.value)} placeholder="Секретный код" type="password" />
            <button className="button primary" type="submit"><LogIn size={18} /> Войти</button>
          </form>
        ) : (
          <div className="admin-grid">
            <form className="admin-form" onSubmit={submit}>
              <h3><Plus size={18} /> Добавить карточку вручную</h3>
              <div className="form-grid">
                <input value={form.titleRu} onChange={(event) => setForm({ ...form, titleRu: event.target.value })} placeholder="Русское название" />
                <input value={form.titleOriginal} onChange={(event) => setForm({ ...form, titleOriginal: event.target.value })} placeholder="Оригинальное название" />
                <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as MediaType })}>
                  <option value="movie">Фильм</option>
                  <option value="series">Сериал</option>
                  <option value="cartoon">Мультфильм</option>
                  <option value="anime">Аниме</option>
                  <option value="show">Шоу</option>
                </select>
                <input value={form.year} onChange={(event) => setForm({ ...form, year: Number(event.target.value) })} placeholder="Год" type="number" />
                <input className="wide" value={form.posterUrl} onChange={(event) => setForm({ ...form, posterUrl: event.target.value })} placeholder="URL постера" />
                <input className="wide" value={form.backdropUrl} onChange={(event) => setForm({ ...form, backdropUrl: event.target.value })} placeholder="URL фона, необязательно" />
                <input className="wide" value={form.genres} onChange={(event) => setForm({ ...form, genres: event.target.value })} placeholder="Жанры через запятую" />
                <input value={form.myRating} onChange={(event) => setForm({ ...form, myRating: Number(event.target.value) })} min="0" max="10" step="0.5" type="number" placeholder="Моя оценка" />
                <textarea className="wide" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Описание" />
                <textarea className="wide" value={form.myReview} onChange={(event) => setForm({ ...form, myReview: event.target.value })} placeholder="Моя рецензия" />
              </div>
              <button className="button primary" type="submit"><Plus size={18} /> Сохранить карточку</button>
              <p className="hint">Карточка сохранится в localStorage. После Supabase будет сохранение в таблицу media_items.</p>
            </form>

            <section className="moderation-panel">
              <h3>Модерация комментариев</h3>
              {pendingComments.length === 0 && <p className="empty-text">Новых комментариев нет.</p>}
              {pendingComments.map((comment) => {
                const item = items.find((entry) => entry.id === comment.mediaId);
                return (
                  <div className="moderation-item" key={comment.id}>
                    <span>{item?.titleRu || 'Неизвестный фильм'}</span>
                    <strong>{comment.visitorName}</strong>
                    <p>{comment.comment}</p>
                    <div>
                      <button className="mini-button approve" onClick={() => onApproveComment(comment.id)}><Check size={16} /> Одобрить</button>
                      <button className="mini-button reject" onClick={() => onDeleteComment(comment.id)}><Trash2 size={16} /> Удалить</button>
                    </div>
                  </div>
                );
              })}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
