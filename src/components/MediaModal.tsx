import { MessageCircle, Send, Star, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { MediaItem, PublicComment } from '../types';
import { formatDate, getRatingClass, mediaTypeLabels } from '../lib/helpers';

type Props = {
  item: MediaItem;
  comments: PublicComment[];
  onClose: () => void;
  onAddComment: (comment: Omit<PublicComment, 'id' | 'createdAt' | 'status'>) => void;
  onRate: (mediaId: string, rating: number) => void;
};

export function MediaModal({ item, comments, onClose, onAddComment, onRate }: Props) {
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const [rating, setRating] = useState(10);
  const approved = useMemo(() => comments.filter((entry) => entry.mediaId === item.id && entry.status === 'approved'), [comments, item.id]);

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

        <div className="modal-hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(8, 11, 22, .98), rgba(8, 11, 22, .74)), url(${item.backdropUrl || item.posterUrl})` }}>
          <img src={item.posterUrl} alt={item.titleRu} />
          <div>
            <div className="media-meta large">
              <span>{mediaTypeLabels[item.type]}</span>
              <span>{item.year}</span>
              <span>добавлено {formatDate(item.addedAt)}</span>
            </div>
            <h2>{item.titleRu}</h2>
            {item.titleOriginal && <p className="original-title">{item.titleOriginal}</p>}
            <p className="modal-description">{item.description}</p>
            <div className="genre-row">
              {item.genres.map((genre) => <span key={genre}>{genre}</span>)}
            </div>
            <div className="modal-ratings">
              <div className={`big-rating ${getRatingClass(item.myRating)}`}>
                <Star fill="currentColor" />
                <strong>{item.myRating || 'нет'}</strong>
                <span>моя оценка</span>
              </div>
              <div className="big-rating guest">
                <MessageCircle />
                <strong>{item.guestRating ? item.guestRating.toFixed(1) : 'нет'}</strong>
                <span>{item.guestVotes || 0} голосов</span>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-grid">
          <section className="review-panel">
            <h3>Моя рецензия</h3>
            <p>{item.myReview || 'Рецензия пока не написана. Ее можно добавить в админке.'}</p>
          </section>

          <aside className="rating-panel">
            <h3>Поставить оценку</h3>
            <div className="rating-slider">
              <input min="1" max="10" type="range" value={rating} onChange={(event) => setRating(Number(event.target.value))} />
              <strong>{rating}/10</strong>
            </div>
            <button className="button primary full" onClick={() => onRate(item.id, rating)}>
              <Star size={18} fill="currentColor" />
              Отправить оценку
            </button>
            <p className="hint">В демо оценка сохраняется в браузере. После подключения Supabase она будет уходить в базу.</p>
          </aside>
        </div>

        <section className="comments-section">
          <div className="section-head compact">
            <div>
              <h3>Комментарии</h3>
              <p>Публикуются после модерации в админке.</p>
            </div>
          </div>

          <form className="comment-form" onSubmit={submitComment}>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ваше имя" />
            <textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Комментарий к рецензии" />
            <button className="button primary" type="submit">
              <Send size={18} />
              Отправить на модерацию
            </button>
          </form>

          <div className="comments-list">
            {approved.length === 0 && <p className="empty-text">Одобренных комментариев пока нет.</p>}
            {approved.map((entry) => (
              <div className="comment" key={entry.id}>
                <strong>{entry.visitorName}</strong>
                <span>{formatDate(entry.createdAt)}</span>
                <p>{entry.comment}</p>
              </div>
            ))}
          </div>
        </section>
      </article>
    </div>
  );
}
