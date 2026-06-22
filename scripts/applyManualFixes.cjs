const fs = require('node:fs');
const file = 'src/data/enrichedMedia.ts';
const source = fs.readFileSync(file, 'utf8');
const items = JSON.parse(source.match(/export const enrichedMedia: MediaItem\[] = ([\s\S]*);\s*$/)[1]);

function patch(title, data) {
  const item = items.find((entry) => entry.titleRu === title || entry.id === data.id);
  if (!item) return false;
  Object.assign(item, data);
  return true;
}

const patches = [];
patches.push(patch('Я легенда', {
  titleRu: 'Я легенда',
  titleOriginal: 'I Am Legend',
  year: 2007,
  description: 'После смертельного вируса Нью-Йорк опустел, а военный вирусолог Роберт Невилл пытается найти лекарство и выжить среди зараженных, выходящих на охоту ночью.',
  genres: ['фантастика', 'боевик', 'триллер', 'драма'],
  countries: ['США'],
  kinopoiskId: 195524,
  imdbId: 'tt0480249',
  kinopoiskRating: 7.8,
  imdbRating: 7.2,
}));
patches.push(patch('Эквилириум', {
  titleRu: 'Эквилибриум',
  titleOriginal: 'Equilibrium',
  year: 2002,
  description: 'В будущем государство запрещает эмоции, искусство и личные переживания. Один из лучших карателей системы перестает принимать препарат подавления чувств и начинает сомневаться в порядке, которому служил.',
  genres: ['фантастика', 'боевик', 'триллер', 'драма'],
  countries: ['США'],
  imdbId: 'tt0238380',
  kinopoiskRating: 7.8,
  imdbRating: 7.3,
}));
patches.push(patch('Форсаж: Токийский дрифт', {
  titleOriginal: 'The Fast and the Furious: Tokyo Drift',
  year: 2006,
  description: 'Уличный гонщик Шон переезжает в Токио и попадает в мир дрифта, где скорость, честь и соперничество решают больше, чем слова.',
  genres: ['боевик', 'криминал', 'драма'],
  countries: ['США', 'Германия', 'Япония'],
  imdbId: 'tt0463985',
  kinopoiskRating: 7.0,
  imdbRating: 6.1,
}));
patches.push(patch('Крепкий орешек 3', {
  titleOriginal: 'Die Hard with a Vengeance',
  year: 1995,
  description: 'Джон Макклейн вынужден играть в смертельную игру с террористом Саймоном, который устраивает взрывы по всему Нью-Йорку и скрывает настоящий план.',
  genres: ['боевик', 'триллер', 'криминал'],
  countries: ['США'],
  imdbId: 'tt0112864',
  kinopoiskRating: 7.8,
  imdbRating: 7.6,
}));
patches.push(patch('Космическая одиссея 2001 года', {
  titleRu: 'Космическая одиссея 2001 года',
  titleOriginal: '2001: A Space Odyssey',
  year: 1968,
  description: 'Человечество сталкивается с загадочным монолитом, а экспедиция к Юпитеру проходит под управлением искусственного интеллекта HAL 9000.',
  genres: ['фантастика', 'приключения'],
  countries: ['Великобритания', 'США'],
  imdbId: 'tt0062622',
  kinopoiskRating: 7.9,
  imdbRating: 8.3,
}));
patches.push(patch('Кин-дза-дза!', {
  titleOriginal: 'Кин-дза-дза!',
  year: 1986,
  description: 'Прораб и студент случайно оказываются на пустынной планете Плюк, где все отношения построены на абсурдной иерархии, спичках и слове «ку».',
  genres: ['фантастика', 'комедия', 'драма'],
  countries: ['СССР'],
  imdbId: 'tt0091341',
  kinopoiskRating: 8.0,
  imdbRating: 7.9,
}));
patches.push(patch('Убойные каникулы', {
  titleOriginal: 'Tucker and Dale vs Evil',
  year: 2010,
  description: 'Два добродушных деревенских парня приезжают отдохнуть в лес, но компания студентов принимает их за маньяков, и недоразумения превращаются в кровавую комедию.',
  genres: ['комедия', 'ужасы'],
  countries: ['Канада'],
  imdbId: 'tt1465522',
  kinopoiskRating: 7.3,
  imdbRating: 7.5,
}));
patches.push(patch('Малыш на драйве', {
  titleOriginal: 'Baby Driver',
  year: 2017,
  description: 'Талантливый водитель по прозвищу Малыш работает на преступников, но мечтает завязать после встречи с девушкой и последнего опасного дела.',
  genres: ['боевик', 'криминал', 'музыка'],
  countries: ['США', 'Великобритания'],
  imdbId: 'tt3890160',
  kinopoiskRating: 7.2,
  imdbRating: 7.5,
}));
patches.push(patch('Майор Пэйн', {
  titleOriginal: 'Major Payne',
  year: 1995,
  description: 'Жесткий майор морской пехоты получает назначение в военную школу и пытается превратить непослушных кадетов в настоящую команду.',
  genres: ['комедия', 'семейный'],
  countries: ['США'],
  imdbId: 'tt0110443',
  kinopoiskRating: 7.5,
  imdbRating: 6.3,
}));
patches.push(patch('Эйс Вентура: Розыск домашних животных', {
  titleOriginal: 'Ace Ventura: Pet Detective',
  year: 1994,
  description: 'Чудаковатый детектив Эйс Вентура разыскивает пропавшего дельфина, талисман футбольной команды, и выходит на странный заговор.',
  genres: ['комедия', 'детектив'],
  countries: ['США'],
  imdbId: 'tt0109040',
  kinopoiskRating: 7.6,
  imdbRating: 6.9,
}));

fs.writeFileSync(file, `import type { MediaItem } from '../types';\n\nexport const enrichedMedia: MediaItem[] = ${JSON.stringify(items, null, 2)};\n`, 'utf8');
console.log(JSON.stringify({ patched: patches.filter(Boolean).length }, null, 2));
