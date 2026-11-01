// Loaded only by the Chromium smoke suite through the Vite development server.
// This test harness isn't imported by the shipping application bundle.
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { MediaPlayer } from '../src/App';

export function mountFullscreenHarness(): void {
  const host = document.createElement('div');
  host.id = 'aurora-fullscreen-smoke-host';
  document.body.append(host);
  const root = createRoot(host);
  // A real MediaStream object, no remote network or hardware permission needed.
  root.render(createElement(MediaPlayer, {
    stream: new MediaStream(),
    muted: true,
    label: 'Transmissão de teste',
  }));
}
