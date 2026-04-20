import React, { useState, useEffect, useCallback } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Activity, MapPin, Bell,
  MessageSquare, Settings, Phone, Menu, X
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { usePatient } from '../contexts/PatientContext';
import { useGlobalRealtime } from '../hooks/useGlobalRealtime.jsx';

const NAV = [
  { icon: LayoutDashboard, label: 'Overview',  path: '/',        end: true },
  { icon: Activity,        label: 'Health',    path: '/health' },
  { icon: MapPin,          label: 'Location',  path: '/location' },
  { icon: Bell,            label: 'Alerts',    path: '/alerts' },
  { icon: MessageSquare,   label: 'Messages',  path: '/photos' },
];

const STATUS = {
  GREEN: { label: 'Stable',   dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  AMBER: { label: 'Caution',  dot: 'bg-amber-500',   badge: 'bg-amber-50  text-amber-700  border-amber-200' },
  RED:   { label: 'Critical', dot: 'bg-red-500',      badge: 'bg-red-50    text-red-700    border-red-200' },
};

export default function Layout() {
  const { patientId, patient } = usePatient();
  const navigate  = useNavigate();
  const loc       = useLocation();
  useGlobalRealtime(patientId, patient?.name);

  const [status,    setStatus]    = useState('GREEN');
  const [redAlerts, setRedAlerts] = useState(false);
  const [sosPhone,  setSosPhone]  = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);

  const syncData = useCallback(async () => {
    if (!patientId) return;
    const { data: s }   = await supabase.from('patient_status').select('status').eq('patient_id', patientId).single();
    if (s) setStatus(s.status);
    const { count }     = await supabase.from('alert_logs').select('*',{count:'exact',head:true}).eq('patient_id',patientId).eq('acknowledged',false).eq('severity','red');
    setRedAlerts((count||0)>0);
    const { data: sos } = await supabase.from('sos_contacts').select('phone').eq('patient_id',patientId).eq('priority_order',1).single();
    if (sos) setSosPhone(sos.phone);
  }, [patientId]);

  useEffect(() => {
    syncData();
    if (!patientId) return;
    const ch = supabase.channel('layout')
      .on('postgres_changes',{event:'*',schema:'public',table:'patient_status',filter:`patient_id=eq.${patientId}`},syncData)
      .on('postgres_changes',{event:'*',schema:'public',table:'alert_logs',    filter:`patient_id=eq.${patientId}`},syncData)
      .subscribe();
    return ()=>supabase.removeChannel(ch);
  },[patientId,syncData]);

  const cfg = STATUS[status] || STATUS.GREEN;

  const onEmergency = () => {
    if (sosPhone) { toast.error('Calling emergency contact…',{icon:'🚨'}); window.location.href=`tel:${sosPhone}`; }
    else toast.error('No emergency contact set — add one in Settings');
  };

  /* ── Sidebar inner ── */
  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm shadow-blue-200">S</div>
          <div>
            <p className="font-semibold text-sm text-slate-900 leading-none">SAATHI</p>
            <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wider font-medium">Care Platform</p>
          </div>
        </div>
      </div>

      {/* Patient chip */}
      <div className="px-4 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-3 border border-slate-100">
          <div className="w-9 h-9 bg-blue-600 text-white rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0">
            {patient?.name?.[0]?.toUpperCase() || 'P'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{patient?.name || 'Loading…'}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              <span className="text-[10px] text-slate-400 font-medium">{cfg.label}</span>
            </div>
          </div>
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${cfg.badge}`}>{cfg.label}</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-3 text-[10px] font-semibold text-slate-300 uppercase tracking-widest mb-3">Navigation</p>
        {NAV.map(item => (
          <NavLink
            key={item.path} to={item.path} end={item.end}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
              }`
            }
          >
            <item.icon size={16} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-slate-100 space-y-1">
        <NavLink
          to="/settings"
          onClick={() => setMobileOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              isActive ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
            }`
          }
        >
          <Settings size={16} /> Settings
        </NavLink>
        <button
          onClick={onEmergency}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 bg-red-50 border border-red-100 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all"
        >
          <Phone size={16} /> Emergency Call
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">

      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 w-60 bg-white border-r border-slate-200 z-50">
        <SidebarContent />
      </aside>

      {/* ── MOBILE OVERLAY ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white z-[70]" onClick={e => e.stopPropagation()}>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 lg:ml-60">

        {/* Top bar */}
        <header className="sticky top-0 h-[60px] bg-white/90 backdrop-blur-md border-b border-slate-100 z-40 flex items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100">
              <Menu size={18} />
            </button>
            <div className="hidden lg:block">
              <p className="text-sm font-semibold text-slate-900">{patient?.name || '—'}</p>
              <p className="text-xs text-slate-400">Monitoring active</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className={`hidden sm:flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${cfg.badge}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot} animate-pulse`} />
              {cfg.label}
            </div>
            <button
              onClick={() => navigate('/alerts')}
              className="relative p-2 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-colors"
            >
              <Bell size={16} />
              {redAlerts && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
              )}
            </button>
          </div>
        </header>

        {/* Page */}
        <main className="p-5 lg:p-8 pb-20 lg:pb-8">
          <Outlet />
        </main>
      </div>

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 h-16 bg-white border-t border-slate-100 z-50 flex items-center justify-around px-2">
        {[...NAV, { icon:Settings, label:'More', path:'/settings', end:false }].map(item => (
          <NavLink key={item.path} to={item.path} end={item.end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-colors ${isActive ? 'text-blue-600' : 'text-slate-400'}`
            }
          >
            <item.icon size={20} />
            <span className="text-[9px] font-semibold uppercase tracking-wide">{item.label.slice(0,4)}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
