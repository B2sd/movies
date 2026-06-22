import { Heart, MessageCircle, RotateCcw, Star } from 'lucide-react';
import type { MediaItem } from '../types';
import { formatDate, formatRating, getPosterUrl, getRatingClass, mediaTypeLabels } from '../lib/helpers';

type Props = {
  item: MediaItem;
  commentsCount: number;
  onSelect: (item: MediaItem) => void;
};

export function MediaCard({ item, commentsCount, onSelect }: Props) {
  return (
    <article className="media-card" onClick={() => onSelect(item)}>
      <div className="poster-wrap">
        <img
          src={getPosterUrl(item)}
          alt={item.titleRu}
          loading="eager"
          onError={(event) => {
            event.currentTarget.src = getPosterUrl({ ...item, posterUrl: '' });
          }}
        />
        <div className={`rating-pill ${getRatingClass(item.myRating)}`}>
          <Star size={14} fill="currentColor" />
          {item.myRating ? `моя ${formatRating(item.myRating)}` : 'не оценено'}
        </div>
        <div className="poster-flags">
          {item.isFavorite && <span><Heart size={13} fill="currentColor" /> любимое</span>}
          {item.rewatch && <span><RotateCcw size={13} /> пересмотреть</span>}
        </div>
      </div>

      <div className="media-card-body">
        <div className="media-meta">
          <span>{item.year || 'год?'}</span>
          <span>{mediaTypeLabels[item.type]}</span>
          <span className="added-badge">добавлен {formatDate(item.addedAt)}</span>
        </div>
        <h3>{item.titleRu}</h3>
        <p>{item.description || 'Официальное описание пока не загружено.'}</p>

        <div className="card-footer">
          <div>
            <strong>{item.guestRating ? `гости ${formatRating(item.guestRating)}` : 'гости —'}</strong>
            <span>{item.guestVotes || 0} голосов</span>
          </div>
          <div title="Одобренные комментарии">
            <MessageCircle size={16} />
            <span>{commentsCount}</span>
          </div>
        </div>

        {(item.kinopoiskId || item.imdbId) && (
          <div className="source-links card-source-links" onClick={(event) => event.stopPropagation()}>
            {item.kinopoiskId && <a href={`https://www.kinopoisk.ru/film/${item.kinopoiskId}/`} target="_blank" rel="noreferrer">КП</a>}
            {item.imdbId && <a href={`https://www.imdb.com/title/${item.imdbId}/`} target="_blank" rel="noreferrer">IMDb</a>}
          </div>
        )}
      </div>
    </article>
  );
}
