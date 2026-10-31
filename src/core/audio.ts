/**
 * Voice-over. v0.1 target is pre-generated mp3 per phrase (SDD 6); until the
 * SpeechKit pipeline lands, everything is spoken by the browser's ru-RU voice.
 */
export class Voice {
  private enabled = true;

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) this.stop();
  }

  say(text: string): void {
    if (!this.enabled || typeof speechSynthesis === 'undefined') return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ru-RU';
    u.rate = 0.9;
    const ru = speechSynthesis.getVoices().find((v) => v.lang.startsWith('ru'));
    if (ru) u.voice = ru;
    speechSynthesis.speak(u);
  }

  stop(): void {
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  }
}

export const voice = new Voice();

/** Praise the method, not the child (SDD 3.7). Rotated so phrases don't wear out. */
export const PRAISE = [
  'Ты внимательно прочитал — и нашёл!',
  'Ты проверил каждое слово. Отлично!',
  'Точно по записке!',
  'Ты посчитал и не ошибся!',
  'Ты не сдался и разобрался!',
  'Вот это штурманская точность!',
  'Ты всё проверил — молодец!',
  'Ровно столько, сколько нужно!',
  'Ты нашёл способ!',
  'Аккуратная работа, юнга!',
] as const;

let praiseIdx = 0;
export function nextPraise(): string {
  praiseIdx = (praiseIdx + 1) % PRAISE.length;
  return PRAISE[praiseIdx]!;
}
