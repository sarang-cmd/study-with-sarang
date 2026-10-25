import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { lazy, Suspense } from 'react';
import { bootSync, captureAuthHash } from './lib/cloud';

// Signed-in users get the merged cloud copy before the first render. Everyone else renders at once.
// An email link lands here with a token in the address; it is removed at once and checked before anything is trusted.
const FlowBarWindow = lazy(() => import('./components/FlowBarWindow'));
const PuckWindow = lazy(() => import('./components/PuckWindow'));
if (window.location.hash === '#puck') {
  // The floating desktop puck window: no app, no sync, only the puck.
  ReactDOM.createRoot(document.getElementById('root')!).render(<Suspense fallback={null}><PuckWindow /></Suspense>);
} else if (window.location.hash === '#flowbar') {
  // The small always-on-top Flow window: no app, no sync, only the bar.
  ReactDOM.createRoot(document.getElementById('root')!).render(<Suspense fallback={null}><FlowBarWindow /></Suspense>);
} else {
const linked = Promise.race([captureAuthHash().catch(() => undefined), new Promise<void>((resolve) => setTimeout(resolve, 2500))]);
void linked.then(() => bootSync()).finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
}
