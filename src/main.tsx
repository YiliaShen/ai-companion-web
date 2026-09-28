import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { IconContext } from '@phosphor-icons/react';
import { App } from './App';
import { ErrorBoundary } from './app/ErrorBoundary';
import { CompanionProvider } from './state/CompanionProvider';
import './styles/tokens.css';
import './styles/global.css';
import './styles/product.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode><IconContext.Provider value={{ weight: 'regular', size: 20 }}><ErrorBoundary><CompanionProvider><App /></CompanionProvider></ErrorBoundary></IconContext.Provider></StrictMode>
);
