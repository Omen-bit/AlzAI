import L from 'leaflet';
window.L = L;

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AlertTriangle, RefreshCw } from 'lucide-react';

import { PatientProvider } from './contexts/PatientContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import HealthPage from './pages/HealthPage';
import LocationPage from './pages/LocationPage';
import AlertsPage from './pages/AlertsPage';
import PhotosPage from './pages/PhotosPage';
import SettingsPage from './pages/SettingsPage';
import './index.css';

// --- 1. Environment Validation Layer ---
const REQUIRED_VARS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_API_URL',
  'VITE_MAPTILER_KEY'
];

const checkMissingVars = () => {
  return REQUIRED_VARS.filter(key => !import.meta.env[key]);
};

const EnvErrorScreen = ({ missing }) => (
  <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-figma">
    <div className="bg-white p-12 rounded-[3rem] shadow-2xl border border-gray-100 max-w-xl w-full text-center">
      <div className="w-20 h-20 bg-red-50 text-red-500 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-xl shadow-red-100/50">
        <AlertTriangle size={40} />
      </div>
      <h1 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">System Configuration Fault</h1>
      <p className="text-gray-500 font-medium mb-8">The following environment variables are missing from your configuration records:</p>
      
      <div className="bg-red-50/50 p-6 rounded-3xl border border-red-100 mb-8 max-h-[200px] overflow-y-auto no-scrollbar">
        {missing.map(v => (
          <div key={v} className="flex items-center gap-3 py-2 border-b border-red-100/50 last:border-0">
             <div className="w-1.5 h-1.5 bg-red-400 rounded-full" />
             <span className="font-mono text-sm text-red-600 font-bold">{v}</span>
          </div>
        ))}
      </div>
      
      <p className="text-xs text-gray-400 font-bold uppercase tracking-widest leading-relaxed">
        Please add these entries to your <code className="bg-gray-100 px-1.5 py-0.5 rounded">.env</code> file<br/> and restart the development server to initialize.
      </p>

      <button onClick={() => window.location.reload()} className="mt-10 flex items-center gap-2 mx-auto px-8 py-3 bg-gray-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all shadow-xl">
        <RefreshCw size={16} /> Re-validate Connection
      </button>
    </div>
  </div>
);

// --- 2. Application Entry Logic ---
const Root = () => {
  const missing = checkMissingVars();
  
  if (missing.length > 0) {
    return <EnvErrorScreen missing={missing} />;
  }

  return (
    <PatientProvider>
      <BrowserRouter>
        <Toaster position="top-right" 
          toastOptions={{
            style: {
              background: '#ffffff',
              color: '#111827',
              borderRadius: '20px',
              padding: '16px 24px',
              fontSize: '14px',
              fontWeight: '600',
              boxShadow: '0 20px 40px rgba(0,0,0,0.05)',
              border: '1px solid #f3f4f6'
            },
            error: {
               background: '#ef4444',
               color: '#ffffff'
            }
          }} 
        />
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/health" element={<HealthPage />} />
            <Route path="/location" element={<LocationPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/photos" element={<PhotosPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </PatientProvider>
  );
};

// --- GLOBAL FAIL-SAFE BOOT ---
try {
  const container = document.getElementById('root');
  if (!container) throw new Error("Missing #root container in index.html");
  const root = ReactDOM.createRoot(container);
  root.render(
    <React.StrictMode>
      <Root />
    </React.StrictMode>
  );
} catch (e) {
  document.body.innerHTML = `
    <div style="background: #09111f; color: #ff5050; font-family: 'Inter', sans-serif; padding: 40px; height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center;">
      <h1 style="font-size: 40px; font-weight: 900; margin-bottom: 20px;">CRITICAL BOOT FAILURE</h1>
      <p style="color: #6366f1; font-weight: 700; margin-bottom: 30px;">THE SATHI ENGINE HAS STALLED DURING INITIALIZATION</p>
      <div style="background: #1a202c; padding: 20px; border-radius: 20px; text-align: left; max-width: 800px; border: 1px solid #2d3748; overflow-x: auto;">
        <pre style="margin: 0; font-size: 14px;">${e.stack || e.message}</pre>
      </div>
      <button onclick="window.location.reload()" style="margin-top: 40px; background: #fff; color: #000; padding: 15px 40px; border-radius: 12px; font-weight: 900; border: none; cursor: pointer;">REBOOT SYSTEM</button>
    </div>
  `;
}
