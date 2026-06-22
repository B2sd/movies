import { Lock, Sparkles } from 'lucide-react';
import type { MediaItem } from '../types';
import { getPosterUrl, getStats } from '../lib/helpers';

type Props = {
  items: MediaItem[];
  onOpenAdmin: () => void;
};

export function Hero({ items, onOpenAdmin }: Props) {
  const stats = getStats(items);
  const featuredTitles = ['Интерстеллар', 'Бойцовский клуб', 'Побег из Шоушенка', 'Зеленая миля', 'Остров проклятых', 'Джентльмены', 'Криминальное чтиво', 'Темный рыцарь'];
  const featuredItems = featuredTitles
    .map((title) => items.find((item) => item.titleRu === title))
    .filter((item): item is MediaItem => Boolean(item));
  const posterItems = featuredItems.length >= 6 ? featuredItems : items.slice(0, 8);

  return (
    <section className="hero">
      <div className="hero-glow hero-glow-one" />
      <div className="hero-glow hero-glow-two" />

      <div className="hero-content">
        <div className="eyebrow">
          <Sparkles size={16} />
          Темный личный архив просмотренного
        </div>

        <h1>Киноархив</h1>
        <div className="stats-grid">
          <div className="stat-card">
            <span>{stats.total}</span>
            <p>карточек в архиве</p>
          </div>
          <div className="stat-card">
            <span>{stats.average}</span>
            <p>средняя моя оценка</p>
          </div>
          <div className="stat-card">
            <span>{stats.top}</span>
            <p>с моей оценкой</p>
          </div>
          <div className="stat-card">
            <span>{stats.series}</span>
            <p>сериалов</p>
          </div>
          <button className="stat-card admin-stat-card" onClick={onOpenAdmin} aria-label="Открыть админку" title="Админка">
            <Lock size={24} />
          </button>
        </div>
      </div>

      <div className="hero-poster-stack" aria-hidden>
        {posterItems.map((item, index) => (
          <img
            key={item.id}
            src={getPosterUrl(item)}
            alt=""
            style={{ '--i': index } as React.CSSProperties}
            onError={(event) => {
              event.currentTarget.src = getPosterUrl({ ...item, posterUrl: '' });
            }}
          />
        ))}
        <div className="hero-mini-card">
          <strong>{stats.total} карточек</strong>
          <span>в темном архиве</span>
        </div>
      </div>
    </section>
  );
}

