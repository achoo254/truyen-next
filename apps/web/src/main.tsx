import '@fontsource/alegreya/400.css';
import '@fontsource/alegreya/700.css';
import '@fontsource/alegreya/800.css';
import '@fontsource/alegreya-sans/400.css';
import '@fontsource/alegreya-sans/400-italic.css';
import '@fontsource/alegreya-sans/500.css';
import '@fontsource/alegreya-sans/700.css';
import './ui/tokens.css';
import './ui/app.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';
import { I18nProvider } from './i18n/i18n';
import { IN_APP } from './platform/app-build';

/** In the app, the stories kept on the phone are found first, so every page reads them from there. */
async function prepare(): Promise<void> {
  if (!IN_APP) return;
  try {
    const { restoreDownloads } = await import('./native/downloads');
    await restoreDownloads();
  } catch (error) {
    // The app still opens; the stories then load from the site.
    console.error('downloads not restored', error instanceof Error ? error.message : error);
  }
}

const root = document.getElementById('root');
if (!root) throw new Error('#root missing from index.html');
void prepare().then(() =>
  createRoot(root).render(
    <StrictMode>
      <I18nProvider>
        <App pathname={window.location.pathname} />
      </I18nProvider>
    </StrictMode>,
  ),
);
