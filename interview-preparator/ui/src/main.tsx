// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
// --- Import Provider ---
import { UserProfileProvider } from './context/UserProfileContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* --- Wrap App with Provider --- */}
    <UserProfileProvider>
      <App />
    </UserProfileProvider>
    {/* --- End Wrap --- */}
  </React.StrictMode>,
)