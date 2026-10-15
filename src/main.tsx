import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { firebaseConfigProblems } from './firebase.ts';
import { installErrorReporter } from './utils/errorReporter.ts';
import './index.css';

installErrorReporter(import.meta.env.VITE_ERROR_REPORT_URL as string | undefined, import.meta.env.VITE_SENTRY_DSN as string | undefined);

const root = createRoot(document.getElementById('root')!);

if (firebaseConfigProblems.length > 0) {
  // Never run the storefront against a broken Firebase config (orders/auth would silently fail).
  console.error('Firebase configuration incomplete:', firebaseConfigProblems.join('; '));
  root.render(
    <div style={{ fontFamily: 'sans-serif', padding: '3rem', textAlign: 'center' }}>
      <h1>Site temporarily unavailable</h1>
      <p>This site is not fully configured yet. Please try again later.</p>
    </div>,
  );
} else {
  import('./App.tsx').then(({ default: App }) => {
    root.render(
      <StrictMode>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </StrictMode>,
    );
  });
}
