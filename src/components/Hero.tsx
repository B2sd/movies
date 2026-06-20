import { Film, GitBranch, Lock, Search, Sparkles } from 'lucide-react';
import type { MediaItem } from '../types';
import { getStats } from '../lib/helpers';

type Props = {
  items: MediaItem[];
  query: string;
  onQueryChange: (value: string) => void;
  onOpenAdmin: () => void;
};

export function Hero({ items, query, onQueryChange, onOpenAdmin }: Props) {
  const stats = getStats(items);

  return (
    <section className="hero">
      <div className="hero-glow hero-glow-one" />
      <div className="hero-glow hero-glow-two" />

      <div className="hero-content">
        <div className="eyebrow">
          <Sparkles size={16} />
          Личный киноархив, рецензии и рейтинги
        </div>

        <h1>Киноархив Карана</h1>
        <p className="hero-text">
          Красивый каталог всего, что уже посмотрено: фильмы, сериалы, мультфильмы, аниме и шоу. Здесь можно искать по названию, сортировать по оценкам, читать рецензии и оставлять комментарии.
        </p>

        <div className="hero-actions">
          <label className="search-box hero-search">
            <Search size={20} />
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Найти фильм, сериал, жанр или год"
            />
          </label>
          <button className="button primary" onClick={onOpenAdmin}>
            <Lock size={18} />
            Админка
          </button>
          <a className="button ghost" href="https://GitBranch.com" target="_blank" rel="noreferrer">
            <GitBranch size={18} />
            GitBranch Pages
          </a>
        </div>

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
            <p>в личном топе</p>
          </div>
          <div className="stat-card">
            <span>{stats.series}</span>
            <p>сериалов</p>
          </div>
        </div>
      </div>

      <div className="hero-poster-stack" aria-hidden>
        {items.slice(0, 5).map((item, index) => (
          <img key={item.id} src={item.posterUrl} alt="" style={{ '--i': index } as React.CSSProperties} />
        ))}
        <div className="hero-mini-card">
          <Film size={18} />
          <strong>4 попытки</strong>
          <span>Основа готова</span>
        </div>
      </div>
    </section>
  );
}

