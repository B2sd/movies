import { MessageCircle, Send, Star, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { MediaItem, PublicComment } from '../types';
import { formatDate, formatRating, getBackdropUrl, getPosterUrl, mediaTypeLabels } from '../lib/helpers';

type Props = {
  item: MediaItem;
  comments: PublicComment[];
  onClose: () => void;
  onAddComment: (comment: Omit<PublicComment, 'id' | 'createdAt' | 'status'>) => void;
  onRate: (mediaId: string, rating: number) => void;
  hasRated: boolean;
  isAdminUnlocked: boolean;
  onUpdateItem: (item: MediaItem) => void;
};

export function MediaModal({ item, comments, onClose, onAddComment, onRate, hasRated, isAdminUnlocked, onUpdateItem }: Props) {
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const [rating, setRating] = useState(10);
  const [adminRating, setAdminRating] = useState(item.myRating ? String(item.myRating) : '');
  const [adminReview, setAdminReview] = useState(item.myReview || '');
  const [adminFavorite, setAdminFavorite] = useState(Boolean(item.isFavorite));
  const [adminTop, setAdminTop] = useState(Boolean(item.isTop));
  const [adminRewatch, setAdminRewatch] = useState(Boolean(item.rewatch));
  const approved = useMemo(() => comments.filter((entry) => entry.mediaId === item.id && entry.status === 'approved'), [comments, item.id]);


  function submitAdminReview(event: React.FormEvent) {
    event.preventDefault();
    const ratingValue = adminRating.trim() ? Number(adminRating) : undefined;
    onUpdateItem({
      ...item,
      myRating: Number.isFinite(ratingValue) ? ratingValue : undefined,
      myReview: adminReview.trim(),
      isFavorite: adminFavorite,
      isTop: adminTop,
      rewatch: adminRewatch,
    });
  }

  function submitComment(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !comment.trim()) return;
    onAddComment({ mediaId: item.id, visitorName: name.trim(), comment: comment.trim() });
    setName('');
    setComment('');
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <article className="media-modal" onClick={(event) => event.stopPropagation()}>
        <button className="icon-button close-button" onClick={onClose} aria-label="Закрыть">
          <X />
        </button>

        <div className="modal-hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(8, 11, 22, .98), rgba(8, 11, 22, .74)), url(${getBackdropUrl(item)})` }}>
          <img
            src={getPosterUrl(item)}
            alt={item.titleRu}
            onError={(event) => {
              event.currentTarget.src = getPosterUrl({ ...item, posterUrl: '' });
            }}
          />
          <div>
            <div className="media-meta large">
              <span>{mediaTypeLabels[item.type]}</span>
              {item.year && <span>{item.year}</span>}
              {item.countries && item.countries.length > 0 && <span>{item.countries.join(', ')}</span>}
              <span className="added-badge">добавлено {formatDate(item.addedAt)}</span>
            </div>
            <h2>{item.titleRu}</h2>
            {item.titleOriginal && item.titleOriginal !== item.titleRu && <p className="original-title">{item.titleOriginal}</p>}
            <p className="modal-description">{item.description || 'Официальное описание пока не загружено.'}</p>
            {item.genres.length > 0 && (
              <div className="genre-row">
                {item.genres.map((genre) => <span key={genre}>{genre}</span>)}
              </div>
            )}
            <div className="modal-ratings">
              <div className="big-rating personal">
                <Star fill="currentColor" />
                <strong>{formatRating(item.myRating)}</strong>
                <span>моя оценка</span>
              </div>
              <div className="big-rating guest">
                <Star fill="currentColor" />
                <strong>{formatRating(item.kinopoiskRating)}</strong>
                <span>Кинопоиск, не моя</span>
              </div>
              <div className="big-rating guest">
                <Star fill="currentColor" />
                <strong>{formatRating(item.imdbRating)}</strong>
                <span>IMDb, не моя</span>
              </div>
              <div className="big-rating guest">
                <MessageCircle />
                <strong>{item.guestRating ? item.guestRating.toFixed(1) : '—'}</strong>
                <span>{item.guestVotes || 0} голосов гостей</span>
              </div>
            </div>
            {(item.kinopoiskId || item.imdbId) && (
              <div className="source-links modal-source-links">
                {item.kinopoiskId && <a href={`https://www.kinopoisk.ru/film/${item.kinopoiskId}/`} target="_blank" rel="noreferrer">Открыть на Кинопоиске</a>}
                {item.imdbId && <a href={`https://www.imdb.com/title/${item.imdbId}/`} target="_blank" rel="noreferrer">Открыть на IMDb</a>}
              </div>
            )}
          </div>
        </div>

        <div className="modal-grid">
          <section className="review-panel">
            <h3>Моя рецензия</h3>
            {isAdminUnlocked ? (
              <form className="inline-admin-review" onSubmit={submitAdminReview}>
                <div className="personal-rating-editor">
                  <div className="rating-editor-head">
                    <span>Моя оценка</span>
                    <strong>{adminRating ? `${adminRating}/10` : 'без оценки'}</strong>
                  </div>
                  <input
                    className="rating-range"
                    value={adminRating || '0'}
                    onChange={(event) => setAdminRating(event.target.value)}
                    min="0"
                    max="10"
                    step="0.5"
                    type="range"
                    style={{ '--progress': `${(Number(adminRating || 0) / 10) * 100}%` } as React.CSSProperties}
                  />
                  <div className="rating-scale"><span>0</span><span>5</span><span>10</span></div>
                  <button className="mini-reset" type="button" onClick={() => setAdminRating('')}>Убрать мою оценку</button>
                </div>
                <textarea value={adminReview} onChange={(event) => setAdminReview(event.target.value)} placeholder="Моя рецензия прямо здесь" rows={5} />
                <label className="checkbox-line"><input type="checkbox" checked={adminFavorite} onChange={(event) => setAdminFavorite(event.target.checked)} /> Избранное</label>
                <label className="checkbox-line"><input type="checkbox" checked={adminTop} onChange={(event) => setAdminTop(event.target.checked)} /> В топ</label>
                <label className="checkbox-line"><input type="checkbox" checked={adminRewatch} onChange={(event) => setAdminRewatch(event.target.checked)} /> Пересмотреть</label>
                <button className="button primary full" type="submit">Сохранить мою рецензию</button>
              </form>
            ) : item.myReview ? (
              <p className="review-text">{item.myReview}</p>
            ) : (
              <p className="empty-text">Рецензия пока не написана. Войди в админку, чтобы добавить ее прямо здесь.</p>
            )}
          </section>

          <aside className="rating-panel">
            <h3>Оценка зрителей</h3>
            {item.guestRating ? (
              <div className="guest-rating-visual">
                <div className="guest-rating-bar">
                  <div className="guest-rating-fill" style={{ width: `${(item.guestRating / 10) * 100}%` }} />
                </div>
                <div className="guest-rating-numbers">
                  <span>{item.guestRating.toFixed(1)}</span>
                  <span>/ 10</span>
                </div>
              </div>
            ) : (
              <p className="empty-text">Пока нет оценок от зрителей.</p>
            )}
            <div className="rating-slider">
              <div className="rating-editor-head">
                <span className="rating-slider-label">Твоя оценка</span>
                <strong className="rating-slider-value">{rating}/10</strong>
              </div>
              <input
                className="rating-range"
                min="1"
                max="10"
                step="0.5"
                type="range"
                value={rating}
                onChange={(event) => setRating(Number(event.target.value))}
                style={{ '--progress': `${((rating - 1) / 9) * 100}%` } as React.CSSProperties}
              />
              <div className="rating-scale"><span>1</span><span>5</span><span>10</span></div>
            </div>
            <button className="button primary full" onClick={() => onRate(item.id, rating)} disabled={hasRated}>
              <Star size={18} fill="currentColor" />
              {hasRated ? 'Оценка отправлена на модерацию' : 'Отправить оценку на модерацию'}
            </button>
            {hasRated && <p className="hint">Оценка появится на сайте после одобрения в админке.</p>}
          </aside>
        </div>

        <section className="comments-section">
          <div className="section-head compact">
            <div>
              <h3>Комментарии ({approved.length})</h3>
              <p>Публикуются после модерации.</p>
            </div>
          </div>

          <form className="comment-form" onSubmit={submitComment}>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ваше имя" />
            <textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Комментарий к рецензии" rows={3} />
            <button className="button primary" type="submit">
              <Send size={18} />
              Отправить на модерацию
            </button>
          </form>

          <div className="comments-list">
            {approved.length === 0 && <p className="empty-text">Комментариев пока нет. Будь первым!</p>}
            {approved.map((entry) => (
              <div className="comment" key={entry.id}>
                <div className="comment-header">
                  <strong>{entry.visitorName}</strong>
                  <span>{formatDate(entry.createdAt)}</span>
                </div>
                <p>{entry.comment}</p>
              </div>
            ))}
          </div>
        </section>
      </article>
    </div>
  );
}
