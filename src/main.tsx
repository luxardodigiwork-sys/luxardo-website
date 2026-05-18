import {StrictMode, Component, ErrorInfo, ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import { initAnalytics } from "./utils/analytics";
import { initSentry } from "./utils/sentryConfig";
import CookieConsent from "./components/CookieConsent";

initSentry();
initAnalytics();

class ErrorBoundary extends Component<{children: ReactNode}, {error: Error | null}> {
  state = { error: null };
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ROOT CRASH:', error, info);
    this.setState({ error });
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{padding: '40px', fontFamily: 'monospace', background: '#fff', color: '#000'}}>
          <h1>App Crashed</h1>
          <pre style={{color: 'red', whiteSpace: 'pre-wrap'}}>{String(this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    <CookieConsent />
    </ErrorBoundary>
  </StrictMode>,
);
