import { Heart, MessageCircle, RotateCcw, Star } from 'lucide-react';
import type { MediaItem } from '../types';
import { getRatingClass, mediaTypeLabels } from '../lib/helpers';

type Props = {
  item: MediaItem;
  onSelect: (item: MediaItem) => void;
};

export function MediaCard({ item, onSelect }: Props) {
  return (
    <article className="media-card" onClick={() => onSelect(item)}>
      <div className="poster-wrap">
        <img src={item.posterUrl} alt={item.titleRu} loading="lazy" />
        <div className={`rating-pill ${getRatingClass(item.myRating)}`}>
          <Star size={14} fill="currentColor" />
          {item.myRating ? `${item.myRating}/10` : 'без оценки'}
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
        </div>
        <h3>{item.titleRu}</h3>
        <p>{item.description}</p>

        <div className="card-footer">
          <div>
            <strong>{item.guestRating ? item.guestRating.toFixed(1) : 'нет'}</strong>
            <span>оценка гостей</span>
          </div>
          <div>
            <MessageCircle size={16} />
            <span>{item.guestVotes || 0}</span>
          </div>
        </div>
      </div>
    </article>
  );
}
