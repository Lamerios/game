# Журнал событий и панель родителя

Игра записывает, что происходит: какие игры запускались, сколько длились, какие вопросы задавались, что ребёнок ответил и как быстро. Всё хранится только в браузере (IndexedDB `yunga-events`) и покидает его, только когда родитель сам выгружает файл. Имени ребёнка и свободного текста в событиях нет, только id игр, слов и задач, числа и короткие коды.

## Как этим пользоваться: виток улучшений

1. Ребёнок играет как обычно, неделю или две.
2. Родитель открывает «Для родителей» (решить пример) → вкладка «Обзор»: время по дням, процент ответов с первого раза, сигналы.
3. «Данные» → «Скачать JSON» (на телефоне — «Поделиться JSON…») и пришлите файл Claude.
4. `npm run analyze -- yunga-2026-11-20.json > report.md` собирает тот же отчёт в Markdown (можно передать несколько файлов: телефон + ноутбук).
5. По отчёту решаем, что менять: уровни, слова, подсказки, озвучку. После выпуска новой версии сравниваем следующий отчёт с прошлым (версия сборки записана в каждом запуске `app.open.build`).

## Сигналы (как читать «Что заметно»)

| Сигнал | Порог | Что делать |
|---|---|---|
| Игра трудновата | ≥10 вопросов, с первого раза <60% | упростить уровень, добавить подсказку |
| Слишком легко | ≥15 вопросов, с первого раза >95% | поднять сложность |
| В зоне роста | 60–95% | ничего, так и надо (около 85% — лучшая зона для обучения, Wilson et al., 2019) |
| Часто бросает | ≥3 игр, брошено >40% | игра длинная или скучная |
| Часто просит повторить | повторов больше половины ответов | слово плохо слышно или незнакомо |
| Трудные задания | слово/задача ≥3 попыток, с первого раза <34% | вернуть в повторение, сменить картинку |
| Путает | пара «спросили → выбрал» ≥2 раз | развести похожие слова, дать контраст |
| Больше часа в день | сумма игр за день >60 мин | короткие сессии 15–20 минут |
| Голос браузера | реплика без записанного клипа | сгенерировать клип (workflow «Voice-over») |
| Ошибки | `app.error` | починить |

Время одной игры считается не больше 45 минут (вкладку могли оставить открытой).

## API для мини-игр

```ts
import { startRun, track } from '../../core/analytics';

const run = startRun('snake', { mode: 'words' });   // игра началась (meta — плоские значения)
run.ask('apple');                                   // задан вопрос: запускает таймер ответа
run.answer({ item: 'apple', correct: false, chosen: 'cat' });  // каждый ответ
run.answer({ item: 'apple', correct: true });       // firstTry и ms посчитаются сами
run.event('repeat');                                // всё прочее: подсказка, пит-стоп…
run.end({ completed: true, stars: 3, score: 10 });  // конец игры

track('menu', 'menu.pick', { game: 'snake' });      // разовое событие вне игры
```

Если игра не вызвала `end()` (ребёнок нажал «Домой» или закрыл вкладку), забег закроется сам как `completed: false` с `reason`: `home`, `restarted` или `page_closed`.

Новая игра появляется в меню одной записью в `src/games/registry.ts` (`id` больше не менять: по нему считается статистика).

## Формат события

```json
{ "v": 1, "ts": 1794645055250, "app": "zimjpjbv0s", "run": "k3f9qa1x2b", "game": "snake", "type": "answer",
  "data": { "item": "n30", "correct": false, "firstTry": false, "chosen": "n13", "ms": 3120, "round": 4 } }
```

- `app` — один запуск страницы, `run` — одна игра от начала до конца, `game` — id из реестра или `app`/`menu`/`parent`.
- Хранятся последние 60 000 событий (несколько месяцев ежедневной игры).

## Словарь событий

| game | type | data | когда |
|---|---|---|---|
| app | app.open | build, device (touch/desktop), w, h, lang, standalone, hash | загрузка страницы |
| app | app.hidden / app.visible | awayMs | свернули / вернулись |
| app | app.error | msg, src | ошибка JavaScript |
| app | voice.fallback | clip, reason (no_clip / no_audio / load_failed) | реплика сказана голосом браузера (раз на клип за запуск) |
| menu | menu.open | first | показано главное меню |
| menu | menu.pick | game | выбрана игра |
| parent | parent.gate | ok | пример для взрослых решён / нет |
| parent | dashboard.open / dashboard.tab / dashboard.close / export | tab, kind | работа с панелью |
| любая | run.start | своё (mode, track, leg, island…) | игра началась |
| любая | ask | item, … | задан вопрос |
| любая | answer | item, correct, firstTry, chosen, ms, level, skill, hints, … | ответ |
| любая | run.end | completed, answers, correct, items, durationMs, stars, score, reason | конец игры |
| snake | repeat | item | «Ещё раз» |
| parcel | answer.kind | vehicle / load (why: color / many / few) | выбор транспорта и погрузка |
| parcel | magpie | shooed | прогнал сороку или нет |
| race | answer.speed, cone, pit_stop.start, pit_stop.end (squats, ms), repeat | | гонка |
| voyage | answer.stage | island / crossing / sea / extra, outcome, review, star, variant | задачи плавания |
| voyage | harbor.open | allowed, reason, episode | экран Кругосветки (видно, когда упирается в лимит) |
| voyage | parent.grant | | родитель разрешил ещё плавание |

## Выгрузка

- JSON (`format: "yunga-analytics"`): `events`, `voyage` (профиль и попытки плавания из `Storage.exportJson`), `local` (прогресс мини-игр из localStorage: `snake-words`, `english-words`, `word-log`, `parcel-progress`, `race-progress`).
- CSV: одна строка на событие, частые поля в своих колонках, остальное JSON в колонке `data`. Открывается в Excel и Google Sheets (UTF-8 с BOM).
- Отчёт: та же сводка, что в панели, в Markdown.
- «Загрузить JSON с другого устройства» добавляет события из файла в журнал (повторы пропускаются).
