import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Fix for "Failed to read the 'cssRules' property" error common in iframes
// This prevents crashes in libraries like html-to-image or framer-motion
try {
  // @ts-ignore
  const originGetter = Object.getOwnPropertyDescriptor(CSSStyleSheet.prototype, 'cssRules')?.get;
  if (originGetter) {
    Object.defineProperty(CSSStyleSheet.prototype, 'cssRules', {
      get() {
        try {
          return originGetter.call(this);
        } catch (e) {
          return [];
        }
      }
    });
  }
} catch (e) {
  console.warn("Could not patch CSSStyleSheet", e);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
