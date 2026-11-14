/**
 * Full screen on phones and tablets: a small button at the bottom of the screen,
 * and the first tap on a touch screen asks for full screen by itself. Where the
 * browser has no Fullscreen API (iPhone Safari), the button stays hidden and the
 * game can be added to the home screen instead (manifest + apple meta in index.html).
 */
type Doc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void };
type El = HTMLElement & { webkitRequestFullscreen?: () => void };

const doc = document as Doc;
const root = document.documentElement as El;

export const canFullscreen = () => !!(root.requestFullscreen || root.webkitRequestFullscreen);
export const isFullscreen = () => !!(doc.fullscreenElement || doc.webkitFullscreenElement);
const standalone = () => matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;

export async function enterFullscreen(): Promise<void> {
  try {
    if (root.requestFullscreen) await root.requestFullscreen({ navigationUI: 'hide' });
    else root.webkitRequestFullscreen?.();
    // Turn the picture sideways on phones that allow it (Android Chrome).
    const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    await o?.lock?.('landscape').catch(() => undefined);
  } catch {
    /* refused: the button stays for another try */
  }
}

export function exitFullscreen() {
  if (document.exitFullscreen) void document.exitFullscreen().catch(() => undefined);
  else doc.webkitExitFullscreen?.();
}

export function setupFullscreen() {
  const btn = document.getElementById('fs');
  if (!btn || !canFullscreen() || standalone()) return;
  const sync = () => {
    btn.classList.toggle('on', !isFullscreen());
    // A resize lets Phaser fit the canvas to the new screen.
    window.dispatchEvent(new Event('resize'));
  };
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    void enterFullscreen();
  });
  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('webkitfullscreenchange', sync);
  sync();
  // On a touch screen, the first tap anywhere goes full screen.
  if (matchMedia('(pointer: coarse)').matches) {
    const first = () => {
      if (!isFullscreen()) void enterFullscreen();
    };
    document.addEventListener('pointerup', first, { once: true });
  }
}
