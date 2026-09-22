import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { supabaseConfigError } from './lib/supabase';
import './index.css';

const root = createRoot(document.getElementById('root')!);

if (supabaseConfigError) {
  root.render(
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 24, maxWidth: 720, margin: '40px auto' }}>
      <h1>Configuration Supabase manquante</h1>
      <p>{supabaseConfigError}</p>
      <p>Après avoir ajouté les secrets, relance le workflow GitHub Pages.</p>
    </div>
  );
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
