# Настройка Supabase для киноархива

## 1. Схема базы

В Supabase SQL Editor сначала запусти:

```sql
-- файл supabase/schema.sql
```

Он создаст таблицы:

- `media_items`, каталог фильмов;
- `public_ratings`, оценки гостей;
- `comments`, комментарии;
- `profiles`, роли пользователей;
- `media_with_guest_rating`, view с гостевой оценкой.

## 2. Загрузка каталога

После схемы запусти:

```sql
-- файл supabase/seed_media.sql
```

Этот файл генерируется командой:

```bash
npm.cmd run export:supabase
```

## 3. Админ-доступ

Создай пользователя в Supabase Authentication с твоим email. После создания выдай ему роль admin:

```sql
update profiles
set role = 'admin'
where email = 'твой-email@example.com';
```

После этого вход в админку сайта через email и пароль Supabase будет работать с RLS-политиками.

## 4. GitHub Secrets

Для деплоя на GitHub Pages добавь secrets:

```text
VITE_TMDB_API_KEY
VITE_TMDB_READ_TOKEN
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_ADMIN_EMAIL
VITE_ADMIN_DEMO_CODE
```

`VITE_ADMIN_DEMO_CODE` нужен как локальный запасной код. Для настоящей защиты используй Supabase Auth и роль `admin`.
