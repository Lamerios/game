# Английский словарь

Все английские слова с картинками живут в одном месте: `src/core/dictionary.ts`.
Змейка, гонки, камбуз, бортжурнал и экран родителя берут слова оттуда
(`src/games/snake/logic.ts` только переэкспортирует их для старых импортов).

## Что есть у слова

- `id` — одно на всё: картинка `public/snake/<id>.webp`, клип `en.<id>`,
  текст в `content/phrases.json` → `english.words`, ключ в статистике слов.
- `ru` — подпись для ребёнка и родителя (не озвучивается).
- `cat` — тема: fruit, vegetable, animal, food, transport, home, clothes, toy,
  nature, body, а с 2026-11-25 ещё sea (море и пираты), travel, craft
  (инструменты и блоки), space, sport.
- `level` — сложность: 1 — первые слова, 2 — обычные, 3 — длинные, редкие
  или легко путаются. Уровни задаются списками `BASIC` и `HARD`, остальное — 2.
  Числа: 0–10 → 1, 11–20 → 2, десятки → 3.

## Как пользоваться в игре

```ts
import { byLevel, upToLevel, levelForStage, themeWords, PICTURES } from '../../core/dictionary';

byLevel(pool);                      // сначала лёгкие: так новые слова приходят по порядку
upToLevel(PICTURES, levelForStage(stage)); // для игр с умным уровнем (smartLevel, этапы 1…5)
themeWords('sea');                  // подборка по интересам: sea, travel, craft, space, sport, road, animals, food, home
```

`levelForStage`: этапы 1–2 спрашивают слова уровня 1, этапы 3–4 — до уровня 2,
с 5-го — все. Слова в статистике отмечайте как обычно: `recordWord(id, wrongPicks)`.

## Как добавить слово

1. Строка в `PICTURE_ENTRIES` (и, если нужно, в `BASIC` или `HARD`).
2. Текст в `content/phrases.json` → `english.words` (голая форма без артикля).
3. Картинка 192×192 WebP в `public/snake/` (Fluent Emoji 3D, MIT).
4. Push: GitHub Action «Voice-over» сам сделает клип `en.<id>` голосом Kokoro.

`tests/dictionary.test.ts` проверяет, что у каждого слова есть текст и картинка,
а списки уровней и тем ссылаются на настоящие слова.
