import { createRoot } from 'react-dom/client';
import { MusicProvider } from '@ydown/hooks';
import { tokens } from '@ydown/design-tokens';
import { App } from './App';
import { createDesktopRuntime } from './runtime';
import './styles.css';
for (const [key, value] of Object.entries(tokens.colors))
  document.documentElement.style.setProperty(`--${key}`, value);
for (const [key, value] of Object.entries(tokens.radius))
  document.documentElement.style.setProperty(`--radius-${key}`, `${value}px`);
for (const [key, value] of Object.entries(tokens.spacing))
  document.documentElement.style.setProperty(`--space-${key}`, `${value}px`);
const runtime = createDesktopRuntime();
void runtime.initialize();
createRoot(document.getElementById('root')!).render(
  <MusicProvider runtime={runtime}>
    <App />
  </MusicProvider>,
);
if (import.meta.hot) import.meta.hot.dispose(() => runtime.dispose());
