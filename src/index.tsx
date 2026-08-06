import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import AdminDashboard from './components/AdminDashboard';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

const isAdmin = window.location.pathname === '/admin';

root.render(
  <React.StrictMode>
    {isAdmin ? <AdminDashboard /> : <App />}
  </React.StrictMode>
);