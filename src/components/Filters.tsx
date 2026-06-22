import { Search } from 'lucide-react';
import type { MediaType, SortMode } from '../types';
import { mediaTypeLabels, sortLabels } from '../lib/helpers';

const types: Array<MediaType | 'all'> = ['all', 'movie', 'series', 'cartoon', 'anime', 'show'];
const sorts: SortMode[] = ['added-desc', 'rating-desc', 'year-desc', 'guest-rating-desc', 'title-asc'];

type Props = {
  selectedType: MediaType | 'all';
  query: string;
  onQueryChange: (value: string) => void;
  onTypeChange: (type: MediaType | 'all') => void;
  sort: SortMode;
  onSortChange: (sort: SortMode) => void;
};

export function Filters({ selectedType, query, onQueryChange, onTypeChange, sort, onSortChange }: Props) {
  return (
    <section className="filters-panel">
      <label className="search-box sticky-search">
        <Search size={18} />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Быстрый поиск по каталогу"
        />
      </label>

      <div className="chip-row">
        {types.map((type) => (
          <button
            key={type}
            className={`chip ${selectedType === type ? 'active' : ''}`}
            onClick={() => onTypeChange(type)}
          >
            {mediaTypeLabels[type]}
          </button>
        ))}
      </div>

      <label className="sort-control">
        <span>Сортировка</span>
        <select value={sort} onChange={(event) => onSortChange(event.target.value as SortMode)}>
          {sorts.map((item) => (
            <option key={item} value={item}>{sortLabels[item]}</option>
          ))}
        </select>
      </label>
    </section>
  );
}
