/**
 * Improvement-cycle report from a parent export.
 *
 *   npm run analyze -- yunga-2026-11-20.json            # Markdown report to stdout
 *   npm run analyze -- yunga-2026-11-20.json --days 7   # only the last 7 days of the file
 *   npm run analyze -- a.json b.json > report.md        # several devices together
 *
 * The export comes from the game: «Для родителей» → «Данные» → «Скачать JSON».
 */
import { readFileSync } from 'node:fs';
import type { GameEvent } from '../src/core/analytics';
import { buildReport, reportToMarkdown } from '../src/core/analyticsReport';
import { ENGLISH } from '../src/core/phrases';
import { gameById } from '../src/games/registry';
import { WORDS } from '../src/games/snake/logic';

const args = process.argv.slice(2);
const daysAt = args.indexOf('--days');
const days = daysAt >= 0 ? Number(args[daysAt + 1]) : 0;
const files = args.filter((a, i) => !a.startsWith('--') && (daysAt < 0 || i !== daysAt + 1));
if (!files.length) {
  console.error('Usage: npm run analyze -- <export.json> [more.json] [--days N]');
  process.exit(1);
}

const seen = new Set<string>();
const events: GameEvent[] = [];
for (const f of files) {
  const data = JSON.parse(readFileSync(f, 'utf8')) as { format?: string; events?: GameEvent[] };
  if (data.format !== 'yunga-analytics' || !Array.isArray(data.events)) throw new Error(`${f}: not a game export`);
  for (const e of data.events) {
    const k = `${e.ts}|${e.app}|${e.type}|${JSON.stringify(e.data ?? {})}`;
    if (!seen.has(k)) {
      seen.add(k);
      events.push(e);
    }
  }
}
events.sort((a, b) => a.ts - b.ts);

const last = events.at(-1)?.ts ?? Date.now();
const RU = new Map(WORDS.map((w) => [w.id, w.ru]));
const EXTRA: Record<string, string> = { voyage: 'Кругосветка' };
const gameName = (id: string) => gameById(id)?.title ?? EXTRA[id] ?? id;
const itemName = (i: string) => (ENGLISH[i] && RU.get(i) ? `${ENGLISH[i]} (${RU.get(i)})` : ENGLISH[i] ?? RU.get(i) ?? i);

const report = buildReport(events, { from: days ? last - days * 86400000 : 0, gameName, itemName });
process.stdout.write(reportToMarkdown(report, gameName, itemName));
