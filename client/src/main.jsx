import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ThemeProvider } from './theme';
import { LangProvider } from './i18n';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <LangProvider>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </LangProvider>
    </BrowserRouter>
  </React.StrictMode>
);
