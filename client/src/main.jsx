import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
import { createHttpClient } from './notes/httpClient.js';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/layout.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App api={createHttpClient()} />
  </StrictMode>,
);
