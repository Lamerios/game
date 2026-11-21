import type Phaser from 'phaser';

/** Short synthesized sounds (no files): a run of notes, each `dur` seconds. */
export function beep(scene: Phaser.Scene, freqs: number[], dur = 0.12, type: OscillatorType = 'triangle', vol = 0.12) {
  const ctx = (scene.sound as Phaser.Sound.WebAudioSoundManager).context as AudioContext | undefined;
  if (!ctx) return;
  freqs.forEach((f, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = f;
    const t = ctx.currentTime + i * dur;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur * 1.6);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur * 1.7);
  });
}

/** A bell: a few detuned sines with a long tail. */
export const bell = (scene: Phaser.Scene) => {
  beep(scene, [1318], 0.9, 'sine', 0.16);
  beep(scene, [1975], 0.6, 'sine', 0.06);
};
