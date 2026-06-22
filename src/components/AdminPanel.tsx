import { Check, Film, LogIn, LogOut, Plus, Search, Shield, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, FormEvent, SetStateAction } from 'react';
import type { ActivityLog, MediaItem, MediaType, PublicComment, PublicRating } from '../types';
import { formatDate } from '../lib/helpers';
import { adminEmail, getAdminStatus, hasSupabaseConfig, signInAdmin, signOutAdmin } from '../lib/supabase';
import { hydrateApiResult, mergeApiResultIntoItem, searchAllMovieApis, type ApiSearchResult } from '../lib/tmdb';

type Props = {
  items: MediaItem[];
  comments: PublicComment[];
  pendingRatings: PublicRating[];
  activityLogs: ActivityLog[];
  onApproveRating: (id: string) => void;
  onDeleteRating: (id: string) => void;
  onAddItem: (item: MediaItem) => void;
  onUpdateItem: (item: MediaItem) => void;
  onDeleteItem: (id: string) => void;
  onApproveComment: (id: string) => void;
  onDeleteComment: (id: string) => void;
  onAdminUnlockedChange: (value: boolean) => void;
  onClose: () => void;
};

type CardForm = {
  titleRu: string;
  titleOriginal: string;
  type: MediaType;
  year: string;
  posterUrl: string;
  backdropUrl: string;
  description: string;
  genres: string;
  kinopoiskRating: string;
  imdbRating: string;
  tmdbId: string;
  kinopoiskId: string;
  imdbId: string;
  myRating: string;
  topRank: string;
  myReview: string;
  isFavorite: boolean;
  isTop: boolean;
  rewatch: boolean;
};

const emptyForm: CardForm = {
  titleRu: '',
  titleOriginal: '',
  type: 'movie',
  year: '',
  posterUrl: '',
  backdropUrl: '',
  description: '',
  genres: 'драма',
  kinopoiskRating: '',
  imdbRating: '',
  tmdbId: '',
  kinopoiskId: '',
  imdbId: '',
  myRating: '',
  topRank: '',
  myReview: '',
  isFavorite: false,
  isTop: false,
  rewatch: false,
};

function slugify(title: string) {
  return title.toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-').replace(/^-|-$/g, '');
}

function numberOrUndefined(value: string) {
  const number = Number(value);
  return value.trim() && Number.isFinite(number) ? number : undefined;
}

function isLocalAdminHost() {
  return ['localhost', '127.0.0.1'].includes(window.location.hostname);
}

function itemToForm(item: MediaItem): CardForm {
  return {
    titleRu: item.titleRu || '',
    titleOriginal: item.titleOriginal || '',
    type: item.type,
    year: item.year ? String(item.year) : '',
    posterUrl: item.posterUrl || '',
    backdropUrl: item.backdropUrl || '',
    description: item.description || '',
    genres: (item.genres || []).join(', '),
    kinopoiskRating: item.kinopoiskRating ? String(item.kinopoiskRating) : '',
    imdbRating: item.imdbRating ? String(item.imdbRating) : '',
    tmdbId: item.tmdbId ? String(item.tmdbId) : '',
    kinopoiskId: item.kinopoiskId ? String(item.kinopoiskId) : '',
    imdbId: item.imdbId || '',
    myRating: item.myRating ? String(item.myRating) : '',
    topRank: item.topRank ? String(item.topRank) : '',
    myReview: item.myReview || '',
    isFavorite: Boolean(item.isFavorite),
    isTop: Boolean(item.isTop),
    rewatch: Boolean(item.rewatch),
  };
}

function formToItem(form: CardForm, base?: MediaItem): MediaItem {
  const titleRu = form.titleRu.trim();
  return {
    id: base?.id || `media-${slugify(titleRu)}-${Date.now()}`,
    titleRu,
    titleOriginal: form.titleOriginal.trim() || titleRu,
    type: form.type,
    year: numberOrUndefined(form.year),
    posterUrl: form.posterUrl.trim(),
    backdropUrl: form.backdropUrl.trim() || form.posterUrl.trim(),
    description: form.description.trim(),
    genres: form.genres.split(',').map((genre) => genre.trim()).filter(Boolean),
    countries: base?.countries || [],
    tmdbId: numberOrUndefined(form.tmdbId) || base?.tmdbId,
    kinopoiskId: numberOrUndefined(form.kinopoiskId) || base?.kinopoiskId,
    imdbId: form.imdbId.trim() || base?.imdbId,
    kinopoiskRating: numberOrUndefined(form.kinopoiskRating),
    imdbRating: numberOrUndefined(form.imdbRating),
    myRating: numberOrUndefined(form.myRating),
    topRank: numberOrUndefined(form.topRank),
    myReview: form.myReview.trim(),
    watchedAt: base?.watchedAt,
    addedAt: base?.addedAt || new Date().toISOString(),
    isFavorite: form.isFavorite,
    isTop: form.isTop,
    rewatch: form.rewatch,
    guestRating: base?.guestRating,
    guestVotes: base?.guestVotes || 0,
  };
}

export function AdminPanel({ items, comments, pendingRatings, activityLogs, onApproveRating, onDeleteRating, onAddItem, onUpdateItem, onDeleteItem, onApproveComment, onDeleteComment, onAdminUnlockedChange, onClose }: Props) {
  const [email, setEmail] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(() => isLocalAdminHost() && localStorage.getItem('karan-admin-unlocked') === 'true');
  const [authChecking, setAuthChecking] = useState(hasSupabaseConfig);
  const [authError, setAuthError] = useState('');
  const [addForm, setAddForm] = useState<CardForm>(emptyForm);
  const [editForm, setEditForm] = useState<CardForm>(emptyForm);
  const [tmdbQuery, setTmdbQuery] = useState('');
  const [tmdbResults, setTmdbResults] = useState<ApiSearchResult[]>([]);
  const [tmdbLoading, setTmdbLoading] = useState(false);
  const [tmdbError, setTmdbError] = useState('');
  const [editItemId, setEditItemId] = useState('');
  const [adminSearch, setAdminSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const pendingComments = useMemo(() => comments.filter((comment) => comment.status === 'pending'), [comments]);
  const sortedItems = useMemo(() => [...items].sort((a, b) => a.titleRu.localeCompare(b.titleRu, 'ru')), [items]);
  const editItem = useMemo(() => items.find((item) => item.id === editItemId), [items, editItemId]);
  const missingItems = useMemo(() => sortedItems.filter((item) => !item.posterUrl || !item.description || !item.year), [sortedItems]);
  const filteredAdminItems = useMemo(() => {
    const query = adminSearch.trim().toLowerCase();
    if (!query) return sortedItems.slice(0, 120);
    return sortedItems.filter((item) => `${item.titleRu} ${item.titleOriginal || ''}`.toLowerCase().includes(query)).slice(0, 120);
  }, [adminSearch, sortedItems]);

  function selectEditItem(itemId: string) {
    const item = items.find((entry) => entry.id === itemId);
    setEditItemId(itemId);
    setEditForm(item ? itemToForm(item) : emptyForm);
  }

  const searchMovieApis = useCallback(async (query: string) => {
    if (!query.trim()) {
      setTmdbResults([]);
      return;
    }
    setTmdbLoading(true);
    setTmdbError('');
    try {
      const results = await searchAllMovieApis(query);
      setTmdbResults(results);
      if (results.length === 0) setTmdbError('Ничего не найдено в TMDB, Кинопоиске и OMDb.');
    } catch {
      setTmdbError('Не удалось найти. Проверь подключение или ключи API.');
    } finally {
      setTmdbLoading(false);
    }
  }, []);

  function handleTmdbSearch(value: string) {
    setTmdbQuery(value);
    clearTimeout(debounceRef.current);
    if (value.trim().length >= 2) {
      debounceRef.current = setTimeout(() => searchMovieApis(value), 400);
    } else {
      setTmdbResults([]);
    }
  }

  function apiResultToForm(result: ApiSearchResult): CardForm {
    return {
      ...emptyForm,
      titleRu: result.titleRu || '',
      titleOriginal: result.titleOriginal || result.titleRu || '',
      type: result.type || 'movie',
      year: result.year ? String(result.year) : '',
      posterUrl: result.posterUrl || '',
      backdropUrl: result.backdropUrl || result.posterUrl || '',
      description: result.description || '',
      genres: result.genres?.length ? result.genres.join(', ') : 'драма',
      kinopoiskRating: result.kinopoiskRating ? String(result.kinopoiskRating) : '',
      imdbRating: result.imdbRating ? String(result.imdbRating) : '',
      tmdbId: result.tmdbId ? String(result.tmdbId) : '',
      kinopoiskId: result.kinopoiskId ? String(result.kinopoiskId) : '',
      imdbId: result.imdbId || '',
    };
  }

  async function selectApiResult(result: ApiSearchResult) {
    setTmdbLoading(true);
    try {
      const hydrated = await hydrateApiResult(result);
      const nextForm = apiResultToForm(hydrated);
      setAddForm(nextForm);
      if (editItem) setEditForm((current) => ({ ...current, ...nextForm }));
    } finally {
      setTmdbLoading(false);
      setTmdbResults([]);
      setTmdbQuery('');
    }
  }

  async function enrichEditFromApis() {
    if (!editItem) return;
    const query = editForm.titleRu || editItem.titleRu;
    setTmdbLoading(true);
    setTmdbError('');
    try {
      const [first] = await searchAllMovieApis(query);
      if (!first) {
        setTmdbError('Не нашел карточку для обновления.');
        return;
      }
      const hydrated = await hydrateApiResult(first);
      const merged = mergeApiResultIntoItem(hydrated, formToItem(editForm, editItem));
      setEditForm(itemToForm(merged));
    } catch {
      setTmdbError('Не удалось обновить карточку из API.');
    } finally {
      setTmdbLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!hasSupabaseConfig) {
        setAuthChecking(false);
        return;
      }
      const status = await getAdminStatus();
      if (cancelled) return;
      if (status.isAdmin) {
        localStorage.setItem('karan-admin-unlocked', 'true');
        setIsUnlocked(true);
        onAdminUnlockedChange(true);
      } else if (!isLocalAdminHost()) {
        localStorage.removeItem('karan-admin-unlocked');
        setIsUnlocked(false);
        onAdminUnlockedChange(false);
      }
      setAuthChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [onAdminUnlockedChange]);

  async function login(event: FormEvent) {
    event.preventDefault();
    setAuthError('');
    const configuredCode = import.meta.env.VITE_ADMIN_DEMO_CODE || '';
    const localMode = isLocalAdminHost();
    const byCode = localMode && (configuredCode ? accessCode.trim() === configuredCode : accessCode.trim() === 'karan');
    const byEmail = localMode && adminEmail && email.trim().toLowerCase() === adminEmail.toLowerCase();
    const supabaseLoginOk = hasSupabaseConfig ? await signInAdmin(email, accessCode) : false;
    if (supabaseLoginOk || byCode || byEmail) {
      if (localMode || supabaseLoginOk) localStorage.setItem('karan-admin-unlocked', 'true');
      setIsUnlocked(true);
      onAdminUnlockedChange(true);
      return;
    }
    setAuthError('Неверный email или секретный код.');
  }

  async function logout() {
    await signOutAdmin();
    localStorage.removeItem('karan-admin-unlocked');
    setIsUnlocked(false);
    onAdminUnlockedChange(false);
  }

  function submitAdd(event: FormEvent) {
    event.preventDefault();
    if (!addForm.titleRu.trim()) return;
    onAddItem(formToItem(addForm));
    setAddForm(emptyForm);
  }

  function submitEdit(event: FormEvent) {
    event.preventDefault();
    if (!editItem || !editForm.titleRu.trim()) return;
    onUpdateItem(formToItem(editForm, editItem));
  }

  function resetLocalData() {
    localStorage.removeItem('karan-media-items-v2');
    localStorage.removeItem('karan-media-items-v3');
    localStorage.removeItem('karan-media-items-v4');
    localStorage.removeItem('karan-media-items-v5');
    window.location.reload();
  }

  return (
    <div className="admin-shell">
      <div className="admin-card">
        <div className="section-head compact">
          <div>
            <span className="eyebrow small"><Shield size={15} /> закрытая зона</span>
            <h2>Админ-панель</h2>
            <p>Добавление фильмов, редактирование карточек, мои оценки, рецензии и модерация комментариев.</p>
          </div>
          <div className="admin-actions">
            {isUnlocked && <button className="button ghost" onClick={resetLocalData}>Сбросить локальные данные</button>}
            {isUnlocked && <button className="button ghost" onClick={logout}><LogOut size={18} /> Выйти</button>}
            <button className="button ghost" onClick={onClose}>Закрыть</button>
          </div>
        </div>

        {authChecking ? (
          <div className="login-form">
            <p className="hint">Проверяю админ-сессию...</p>
          </div>
        ) : !isUnlocked ? (
          <form className="login-form" onSubmit={login}>
            <p className="hint">На опубликованном сайте вход только через Supabase email и пароль. Локальный код работает только на localhost.</p>
            <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Твой email" />
            <input value={accessCode} onChange={(event) => setAccessCode(event.target.value)} placeholder="Секретный код или пароль Supabase" type="password" />
            {authError && <p className="hint" style={{ color: 'var(--red)' }}>{authError}</p>}
            <button className="button primary" type="submit"><LogIn size={18} /> Войти</button>
          </form>
        ) : (
          <div className="admin-layout">
            <section className="admin-form">
              <h3><Search size={18} /> Поиск через TMDB, Кинопоиск и OMDb</h3>
              <div className="tmdb-search-wrap">
                <div className="search-box">
                  <Search size={18} />
                  <input value={tmdbQuery} onChange={(event) => handleTmdbSearch(event.target.value)} placeholder="Название фильма или сериала" />
                </div>
                {tmdbLoading && <p className="hint">Поиск...</p>}
                {tmdbError && <p className="hint" style={{ color: 'var(--red)' }}>{tmdbError}</p>}
                {tmdbResults.length > 0 && (
                  <div className="tmdb-results">
                    {tmdbResults.map((result) => (
                      <button key={`${result.source}-${result.sourceId}`} className="tmdb-result" onClick={() => selectApiResult(result)}>
                        {result.posterUrl ? <img src={result.posterUrl} alt="" /> : <div className="tmdb-result-placeholder"><Film size={24} /></div>}
                        <div>
                          <strong>{result.titleRu}</strong>
                          <span>{result.sourceLabel} · {result.titleOriginal || 'без оригинального названия'} · {result.year || 'год не указан'} · {result.type}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <h3 style={{ marginTop: 24 }}><Plus size={18} /> Добавить новую карточку</h3>
              <CardEditorForm form={addForm} setForm={setAddForm} onSubmit={submitAdd} submitLabel="Добавить в архив" />
            </section>

            <section className="admin-form">
              <h3>Редактировать существующую карточку</h3>
              <div className="search-box admin-search">
                <Search size={18} />
                <input value={adminSearch} onChange={(event) => setAdminSearch(event.target.value)} placeholder="Быстрый поиск по каталогу" />
              </div>
              <select value={editItemId} onChange={(event) => selectEditItem(event.target.value)}>
                <option value="">Выбрать фильм</option>
                {filteredAdminItems.map((item) => (
                  <option key={item.id} value={item.id}>{item.titleRu}{!item.posterUrl || !item.description || !item.year ? ' · нужно заполнить' : ''}</option>
                ))}
              </select>
              {editItem ? (
                <>
                  <button className="button ghost full" type="button" onClick={enrichEditFromApis} disabled={tmdbLoading}>Заполнить из API</button>
                  <CardEditorForm form={editForm} setForm={setEditForm} onSubmit={submitEdit} submitLabel="Сохранить карточку" />
                  <button className="button ghost danger full" type="button" onClick={() => onDeleteItem(editItem.id)}><Trash2 size={18} /> Удалить карточку</button>
                </>
              ) : (
                <p className="empty-text">Выбери фильм, чтобы поставить свою оценку, написать рецензию или заполнить постер и описание.</p>
              )}
            </section>

            <section className="moderation-panel">
              <h3>Карточки без данных ({missingItems.length})</h3>
              <p className="hint">Клик по названию откроет карточку в редакторе.</p>
              <div className="admin-scroll-list">
                {missingItems.slice(0, 80).map((item) => (
                  <button key={item.id} className="missing-data-item" onClick={() => selectEditItem(item.id)}>
                    <strong>{item.titleRu}</strong>
                    <span>{!item.posterUrl && 'нет постера'} {!item.description && 'нет описания'} {!item.year && 'нет года'}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="moderation-panel">
              <h3>Оценки зрителей ({pendingRatings.length})</h3>
              {pendingRatings.length === 0 && <p className="empty-text">Новых оценок нет.</p>}
              {pendingRatings.map((rating) => {
                const item = items.find((entry) => entry.id === rating.mediaId);
                return (
                  <div className="moderation-item" key={rating.id}>
                    <span>{item?.titleRu || 'Неизвестный фильм'}</span>
                    <strong>{rating.rating}/10</strong>
                    <p>{rating.visitorName || 'Гость'} · {formatDate(rating.createdAt)}</p>
                    <div>
                      <button className="mini-button approve" onClick={() => onApproveRating(rating.id)}><Check size={16} /> Одобрить</button>
                      <button className="mini-button reject" onClick={() => onDeleteRating(rating.id)}><Trash2 size={16} /> Удалить</button>
                    </div>
                  </div>
                );
              })}
            </section>

            <section className="moderation-panel">
              <h3>Комментарии ({pendingComments.length})</h3>
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

            <section className="moderation-panel admin-logs-panel">
              <h3>Логи действий ({activityLogs.length})</h3>
              {activityLogs.length === 0 && <p className="empty-text">Логов пока нет.</p>}
              <div className="admin-scroll-list logs-list">
                {activityLogs.slice(0, 120).map((log) => (
                  <div className="log-item" key={log.id}>
                    <div>
                      <strong>{log.action}</strong>
                      <span>{formatDate(log.createdAt)} · {log.actor}</span>
                    </div>
                    <p>{log.target}</p>
                    {log.details && <small>{log.details}</small>}
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

type CardEditorFormProps = {
  form: CardForm;
  setForm: Dispatch<SetStateAction<CardForm>>;
  onSubmit: (event: FormEvent) => void;
  submitLabel: string;
};

function CardEditorForm({ form, setForm, onSubmit, submitLabel }: CardEditorFormProps) {
  return (
    <form onSubmit={onSubmit}>
      <div className="form-grid">
        <input value={form.titleRu} onChange={(event) => setForm((current) => ({ ...current, titleRu: event.target.value }))} placeholder="Русское название" />
        <input value={form.titleOriginal} onChange={(event) => setForm((current) => ({ ...current, titleOriginal: event.target.value }))} placeholder="Оригинальное название" />
        <select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as MediaType }))}>
          <option value="movie">Фильм</option>
          <option value="series">Сериал</option>
          <option value="cartoon">Мультфильм</option>
          <option value="anime">Аниме</option>
          <option value="show">Шоу</option>
        </select>
        <input value={form.year} onChange={(event) => setForm((current) => ({ ...current, year: event.target.value }))} placeholder="Год" type="number" />
        <input className="wide" value={form.posterUrl} onChange={(event) => setForm((current) => ({ ...current, posterUrl: event.target.value }))} placeholder="URL постера" />
        <input className="wide" value={form.backdropUrl} onChange={(event) => setForm((current) => ({ ...current, backdropUrl: event.target.value }))} placeholder="URL фона" />
        <input className="wide" value={form.genres} onChange={(event) => setForm((current) => ({ ...current, genres: event.target.value }))} placeholder="Жанры через запятую" />
        <input value={form.kinopoiskRating} onChange={(event) => setForm((current) => ({ ...current, kinopoiskRating: event.target.value }))} min="0" max="10" step="0.1" type="number" placeholder="Кинопоиск" />
        <input value={form.imdbRating} onChange={(event) => setForm((current) => ({ ...current, imdbRating: event.target.value }))} min="0" max="10" step="0.1" type="number" placeholder="IMDb" />
        <input value={form.myRating} onChange={(event) => setForm((current) => ({ ...current, myRating: event.target.value }))} min="0" max="10" step="0.1" type="number" placeholder="Моя оценка" />
        <select value={form.topRank} onChange={(event) => setForm((current) => ({ ...current, topRank: event.target.value }))}>
          <option value="">Без места в топ-5</option>
          <option value="1">Топ 1</option>
          <option value="2">Топ 2</option>
          <option value="3">Топ 3</option>
          <option value="4">Топ 4</option>
          <option value="5">Топ 5</option>
        </select>
        <textarea className="wide" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Официальное описание на русском" rows={4} />
        <textarea className="wide" value={form.myReview} onChange={(event) => setForm((current) => ({ ...current, myReview: event.target.value }))} placeholder="Моя рецензия" rows={4} />
        <label className="checkbox-line"><input type="checkbox" checked={form.isFavorite} onChange={(event) => setForm((current) => ({ ...current, isFavorite: event.target.checked }))} /> Избранное</label>
        <label className="checkbox-line"><input type="checkbox" checked={form.isTop} onChange={(event) => setForm((current) => ({ ...current, isTop: event.target.checked }))} /> В топ</label>
        <label className="checkbox-line"><input type="checkbox" checked={form.rewatch} onChange={(event) => setForm((current) => ({ ...current, rewatch: event.target.checked }))} /> Пересмотреть</label>
      </div>
      <button className="button primary full" type="submit"><Plus size={18} /> {submitLabel}</button>
    </form>
  );
}
