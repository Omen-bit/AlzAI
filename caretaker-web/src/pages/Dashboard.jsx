import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin, Check, AlertTriangle, Moon, Pill, Bell,
  Heart, Zap, Sparkles, Phone, ChevronRight,
  RefreshCw, History, TrendingUp, TrendingDown,
  Activity, Clock, Shield
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Polygon, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { toast } from 'react-hot-toast';

import { supabase } from '../lib/supabase';
import api from '../lib/api';
import { usePatient } from '../contexts/PatientContext';
import { formatTimeAgo, formatTime, formatDateTime } from '../utils/timeFormat';

/* ── Map helper ── */
const ChangeView = ({ center }) => {
  const map = useMap();
  useEffect(() => { map.setView(center, map.getZoom()); }, [center, map]);
  return null;
};

/* ── Leaflet icons ── */
const makeIcon = (color, ring) => L.divIcon({
  className: '',
  html: `<div style="position:relative;width:40px;height:40px;display:flex;align-items:center;justify-content:center;">
    <div style="position:absolute;inset:0;background:${ring};border-radius:50%;opacity:.25;"></div>
    <div style="width:14px;height:14px;background:${color};border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.25);"></div>
  </div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});
const ICON_SAFE     = makeIcon('#2563eb', '#3b82f6');
const ICON_BREACHED = makeIcon('#f43f5e', '#f43f5e');

/* ════════════════════════════════════════ */
const Dashboard = () => {
  const { patientId, patient: patientBase } = usePatient();
  const navigate = useNavigate();

  const [patientStatus, setPatientStatus] = useState({ status: 'GREEN' });
  const [latestLocation, setLatestLocation] = useState(null);
  const [geofence, setGeofence]   = useState(null);
  const [activeFall, setActiveFall] = useState(null);
  const [vitals, setVitals]       = useState(null);
  const [medStats, setMedStats]   = useState({ taken: 0, total: 0, next: null });
  const [alertStats, setAlertStats] = useState({ count: 0, unresolved: [] });
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [aiBriefing, setAiBriefing] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  const fetchDashboardData = useCallback(async () => {
    if (!patientId) return;
    try {
      setError(null);
      const today = new Date().toISOString().split('T')[0];

      const [
        { data: statusData },
        { data: locData },
        { data: fallData },
        { data: vitalsData },
        { data: medLogs },
        { data: activeAlerts, count: alertCount },
        { data: briefingData },
        medTimeline, alertTimeline, interactionTimeline
      ] = await Promise.all([
        supabase.from('patient_status').select('*').eq('patient_id', patientId).single(),
        supabase.from('location_logs').select('*').eq('patient_id', patientId).order('timestamp', { ascending: false }).limit(1).single(),
        supabase.from('fall_logs').select('*').eq('patient_id', patientId).is('resolved_at', null).limit(1).single(),
        supabase.from('vitals_logs').select('*').eq('patient_id', patientId).order('recorded_at', { ascending: false }).limit(1).single(),
        supabase.from('medication_logs').select('status, scheduled_at, medications(name, dose)').eq('patient_id', patientId).gte('scheduled_at', today),
        supabase.from('alert_logs').select('*', { count: 'exact' }).eq('patient_id', patientId).eq('resolved', false).order('created_at', { ascending: false }),
        supabase.from('briefing_logs').select('*').eq('patient_id', patientId).gte('delivered_at', today).limit(1).single(),
        supabase.from('medication_logs').select('*, medications(name)').eq('patient_id', patientId).gte('scheduled_at', today),
        supabase.from('alert_logs').select('*').eq('patient_id', patientId).gte('created_at', today),
        supabase.from('interaction_logs').select('*').eq('patient_id', patientId).gte('timestamp', today),
      ]);

      if (statusData) setPatientStatus(statusData);
      if (locData) setLatestLocation(locData);
      setActiveFall(fallData);
      setVitals(vitalsData);
      setAiBriefing(briefingData);

      if (medLogs) {
        const taken = medLogs.filter(l => l.status === 'confirmed').length;
        const total = medLogs.length;
        const next  = medLogs.filter(l => l.status === 'pending' && new Date(l.scheduled_at) > new Date())
                             .sort((a,b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))[0];
        setMedStats({ taken, total, next: next ? { ...next, name: next.medications?.name, dose: next.medications?.dose } : null });
      }

      setAlertStats({ count: alertCount || 0, unresolved: activeAlerts?.slice(0,5) || [] });

      const { data: gData } = await supabase.from('geofences').select('polygon_coordinates').eq('patient_id', patientId).eq('is_active', true).limit(1).single();
      if (gData?.polygon_coordinates) setGeofence(gData.polygon_coordinates.map(p => [p.lat, p.lng]));

      const all = [
        ...(medTimeline.data || []).map(e => ({ ...e, tType:'med',         time: e.scheduled_at })),
        ...(alertTimeline.data || []).map(e => ({ ...e, tType:'alert',     time: e.created_at })),
        ...(interactionTimeline.data || []).map(e => ({ ...e, tType:'interaction', time: e.timestamp })),
      ].sort((a,b) => new Date(b.time) - new Date(a.time)).slice(0,8);
      setTimelineEvents(all);

    } catch (err) {
      console.error(err);
      setError('Could not connect to telemetry feed.');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    fetchDashboardData();
    if (!patientId) return;
    const ch = supabase.channel('dashboard-v2')
      .on('postgres_changes', { event:'*', schema:'public', table:'patient_status',  filter:`patient_id=eq.${patientId}` }, fetchDashboardData)
      .on('postgres_changes', { event:'*', schema:'public', table:'location_logs',   filter:`patient_id=eq.${patientId}` }, fetchDashboardData)
      .on('postgres_changes', { event:'*', schema:'public', table:'fall_logs',       filter:`patient_id=eq.${patientId}` }, fetchDashboardData)
      .on('postgres_changes', { event:'*', schema:'public', table:'alert_logs',      filter:`patient_id=eq.${patientId}` }, fetchDashboardData)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [patientId, fetchDashboardData]);

  const handleResolveFall = async () => {
    try {
      await api.post('/fall/resolve', { fall_log_id: activeFall.id, resolved_by: 'caretaker' });
      toast.success('Incident marked as resolved');
      setActiveFall(null);
    } catch {
      await supabase.from('fall_logs').update({ resolved_at: new Date().toISOString() }).eq('id', activeFall.id);
      toast.success('Incident resolved locally');
      setActiveFall(null);
    }
  };

  const handleAcknowledge = async (id) => {
    try { await api.post('/alert/acknowledge', { alert_id: id }); }
    catch { await supabase.from('alert_logs').update({ acknowledged: true }).eq('id', id); }
    toast.success('Alert acknowledged');
    setAlertStats(prev => ({ ...prev, unresolved: prev.unresolved.filter(a => a.id !== id) }));
  };

  const mapCenter   = [latestLocation?.latitude || 18.5204, latestLocation?.longitude || 73.8567];
  const isBreached  = latestLocation?.breach_status === 'breach';
  const statusColor = { GREEN:'success', AMBER:'warning', RED:'danger' }[patientStatus.status] || 'success';

  /* ── Skeleton ── */
  const Skel = ({ h = 'h-4', w = 'w-full', round = 'rounded-lg' }) => (
    <div className={`shimmer ${h} ${w} ${round}`} />
  );

  return (
    <div className="max-w-[1280px] mx-auto space-y-6">

      {/* ── FALL BANNER ── */}
      {activeFall && (
        <div className="flex items-center justify-between gap-4 bg-red-600 text-white rounded-2xl px-6 py-4 shadow-lg shadow-red-200">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div>
              <p className="font-semibold text-sm">Fall Detected</p>
              <p className="text-red-200 text-xs mt-0.5">{formatTimeAgo(activeFall.detected_at)} · {activeFall.location_label || 'Sensor pulse location'}</p>
            </div>
          </div>
          <button onClick={handleResolveFall} className="btn btn-sm bg-white text-red-600 hover:bg-red-50 flex-shrink-0">
            Mark Resolved
          </button>
        </div>
      )}

      {/* ── PAGE HEADER ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          {loading
            ? <Skel h="h-8" w="w-48" round="rounded-xl" />
            : <h1 className="text-2xl font-semibold text-slate-900">{patientBase?.name || 'Patient Overview'}</h1>
          }
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={`badge badge-${statusColor}`}>
              <span className={`w-1.5 h-1.5 rounded-full bg-current`} />
              {patientStatus.status === 'GREEN' ? 'Stable' : patientStatus.status === 'AMBER' ? 'Needs Attention' : 'Critical'}
            </span>
            <span className={`badge ${isBreached ? 'badge-danger' : 'badge-neutral'}`}>
              <MapPin size={10} />
              {isBreached ? 'Outside safe zone' : 'Within safe zone'}
            </span>
            {medStats.taken === medStats.total && medStats.total > 0 && (
              <span className="badge badge-success"><Check size={10} /> Medication complete</span>
            )}
          </div>
        </div>
        <button onClick={fetchDashboardData} className="btn btn-secondary btn-sm btn-icon" title="Refresh">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* ── MAP + VITALS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Map */}
        <div className="lg:col-span-2 card card-sm overflow-hidden !p-0" style={{ height: '280px' }}>
          {loading
            ? <div className="shimmer w-full h-full" />
            : (
              <MapContainer center={mapCenter} zoom={16} zoomControl={false} scrollWheelZoom={false} style={{ height:'100%', width:'100%' }}>
                <ChangeView center={mapCenter} />
                <TileLayer attribution='© MapTiler' url={`https://api.maptiler.com/maps/streets-v2-dark/{z}/{x}/{y}.png?key=${import.meta.env.VITE_MAPTILER_KEY}`} />
                {geofence && <Polygon positions={geofence} pathOptions={{ color: isBreached ? '#f43f5e':'#3b82f6', fillColor:'#3b82f6', fillOpacity:0.12, weight:2 }} />}
                <Marker position={mapCenter} icon={isBreached ? ICON_BREACHED : ICON_SAFE} />
              </MapContainer>
            )
          }
          {/* Map overlay label */}
          {!loading && (
            <div className="absolute bottom-3 left-3 z-[400] badge badge-neutral text-[10px] bg-black/80 text-white border-white/10 backdrop-blur">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Live · MapTiler
            </div>
          )}
        </div>

        {/* Vitals panel */}
        <div className="card flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="section-title">Live Vitals</p>
            <span className="badge badge-neutral text-[10px]">
              {vitals ? formatTime(vitals.recorded_at) : '—'}
            </span>
          </div>
          <div className="space-y-4">
            <VitalRow loading={loading} icon={Heart}    color="text-rose-500"    bg="bg-rose-50"    label="Heart Rate"   value={vitals?.heart_rate}   unit="BPM" />
            <VitalRow loading={loading} icon={Activity} color="text-blue-500"   bg="bg-blue-50"   label="Steps Today"  value={vitals?.steps}        unit="steps" />
            <VitalRow loading={loading} icon={Moon}     color="text-indigo-500" bg="bg-indigo-50" label="Sleep"        value={vitals?.sleep_hours}  unit="hrs" />
            <VitalRow loading={loading} icon={Zap}      color="text-amber-500"  bg="bg-amber-50"  label="Blood Oxygen" value={vitals?.spo2}         unit="%" />
          </div>
          <button onClick={() => navigate('/health')} className="btn btn-secondary btn-sm w-full mt-auto">
            View Full Report <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* ── METRIC CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          loading={loading}
          icon={Moon}
          iconBg="bg-indigo-50"
          iconColor="text-indigo-500"
          label="Sleep Efficiency"
          value={vitals?.sleep_hours ? `${vitals.sleep_hours}h` : '—'}
          sub={vitals?.sleep_hours < 5 ? { text: 'Below baseline', color: 'text-amber-600', icon: TrendingDown } : { text: 'Healthy range', color: 'text-emerald-600', icon: TrendingUp }}
        />
        <StatCard
          loading={loading}
          icon={Pill}
          iconBg="bg-violet-50"
          iconColor="text-violet-500"
          label="Medication Adherence"
          value={medStats.total ? `${medStats.taken}/${medStats.total}` : '—'}
          sub={medStats.total === 0 ? { text: 'None scheduled', color: 'text-slate-400' } : medStats.taken === medStats.total ? { text: 'All doses taken', color: 'text-emerald-600', icon: TrendingUp } : { text: `${medStats.total - medStats.taken} pending`, color: 'text-amber-600', icon: TrendingDown }}
        />
        <StatCard
          loading={loading}
          icon={Bell}
          iconBg={alertStats.count > 0 ? 'bg-red-50' : 'bg-slate-50'}
          iconColor={alertStats.count > 0 ? 'text-red-500' : 'text-slate-400'}
          label="Active Incidents"
          value={loading ? '—' : alertStats.count}
          sub={alertStats.count === 0 ? { text: 'All clear', color: 'text-emerald-600', icon: Check } : { text: 'Needs review', color: 'text-red-600', icon: AlertTriangle }}
        />
      </div>

      {/* ── TWO COLUMN ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">

        {/* Left: Alerts */}
        <div className="lg:col-span-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="section-title">Active Incidents</p>
            <button onClick={() => navigate('/alerts')} className="btn btn-ghost btn-sm text-blue-600">
              View all <ChevronRight size={13} />
            </button>
          </div>

          {loading ? (
            [1,2].map(i => (
              <div key={i} className="alert-item">
                <div className="alert-item-icon bg-slate-50 shimmer w-10 h-10" />
                <div className="flex-1 space-y-2">
                  <Skel h="h-4" w="w-32" />
                  <Skel h="h-3" w="w-48" />
                </div>
              </div>
            ))
          ) : alertStats.unresolved.length === 0 ? (
            <div className="card text-center py-10">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Shield size={20} />
              </div>
              <p className="font-semibold text-slate-900 text-sm">All clear</p>
              <p className="text-slate-400 text-xs mt-1">No active incidents requiring attention</p>
            </div>
          ) : (
            alertStats.unresolved.map(alert => (
              <AlertItem key={alert.id} alert={alert} onAck={handleAcknowledge} />
            ))
          )}
        </div>

        {/* Right: Timeline */}
        <div className="lg:col-span-2 space-y-3">
          <p className="section-title">Today's Activity</p>

          {/* AI Briefing Card */}
          <div className="card !bg-gradient-to-br from-blue-600 to-blue-700 !border-0 text-white relative overflow-hidden">
            <Sparkles size={48} className="absolute -bottom-3 -right-3 text-white/10" />
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold text-blue-200 uppercase tracking-wider">AI Summary</span>
            </div>
            <p className="text-sm leading-relaxed text-blue-50">
              {loading ? 'Generating insights...' : (aiBriefing?.briefing_text || "Morning briefing will appear here once the AI has analyzed overnight patterns.")}
            </p>
          </div>

          {/* Timeline feed */}
          <div className="card space-y-4">
            {loading ? (
              [1,2,3].map(i => (
                <div key={i} className="flex gap-3">
                  <Skel h="h-8" w="w-8" round="rounded-full" />
                  <div className="flex-1 space-y-2 pt-1">
                    <Skel h="h-3.5" w="w-28" />
                    <Skel h="h-3" w="w-40" />
                  </div>
                </div>
              ))
            ) : timelineEvents.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No activity recorded today yet.</p>
            ) : (
              timelineEvents.map((evt, idx) => (
                <TimelineItem key={evt.id || idx} event={evt} isLast={idx === timelineEvents.length - 1} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════ SUB-COMPONENTS ═══════════════ */

const VitalRow = ({ loading, icon: Icon, color, bg, label, value, unit }) => {
  const Skel = () => <div className="shimmer h-4 w-16 rounded-lg" />;
  return (
    <div className="flex items-center gap-3">
      <div className={`w-8 h-8 ${bg} ${color} rounded-lg flex items-center justify-center flex-shrink-0`}>
        <Icon size={15} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-400 font-medium">{label}</p>
      </div>
      {loading ? <Skel /> : (
        <div className="text-sm font-semibold text-slate-900 tabular-nums">
          {value ?? '—'} <span className="text-xs text-slate-400 font-normal">{value ? unit : ''}</span>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ loading, icon: Icon, iconBg, iconColor, label, value, sub }) => {
  const SubIcon = sub?.icon;
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between">
        <p className="stat-card-label">{label}</p>
        <div className={`w-8 h-8 ${iconBg} ${iconColor} rounded-lg flex items-center justify-center`}>
          <Icon size={15} />
        </div>
      </div>
      {loading
        ? <div className="shimmer h-8 w-20 rounded-xl" />
        : <p className="stat-card-value">{value}</p>
      }
      {sub && !loading && (
        <p className={`stat-card-sub ${sub.color}`}>
          {SubIcon && <SubIcon size={12} />}
          {sub.text}
        </p>
      )}
    </div>
  );
};

const AlertItem = ({ alert, onAck }) => {
  const isRed = alert.severity === 'red';
  return (
    <div className="alert-item">
      <div className={`alert-item-icon ${isRed ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500'}`}>
        <AlertTriangle size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-900 capitalize">
              {alert.type?.replace(/_/g,' ') ?? 'Unknown incident'}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">{formatTimeAgo(alert.created_at)}</p>
          </div>
          {!alert.acknowledged && (
            <span className="badge badge-info text-[10px] flex-shrink-0">New</span>
          )}
        </div>
        {alert.message && (
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">{alert.message}</p>
        )}
        <div className="flex gap-2 mt-3">
          <button onClick={() => onAck(alert.id)} className="btn btn-secondary btn-sm">
            Acknowledge
          </button>
        </div>
      </div>
    </div>
  );
};

const TimelineItem = ({ event, isLast }) => {
  const config = {
    med:         { bg: 'bg-violet-50', color: 'text-violet-500', icon: Pill, label: 'Medication' },
    alert:       { bg: 'bg-red-50',    color: 'text-red-500',    icon: Bell, label: 'Alert' },
    interaction: { bg: 'bg-blue-50',   color: 'text-blue-500',   icon: Activity, label: 'Interaction' },
  }[event.tType] || { bg: 'bg-slate-50', color: 'text-slate-400', icon: Clock, label: 'Event' };

  const Icon = config.icon;

  return (
    <div className="flex gap-3 relative">
      {!isLast && <div className="absolute left-4 top-8 bottom-0 w-px bg-slate-100" />}
      <div className={`w-8 h-8 rounded-full ${config.bg} ${config.color} flex items-center justify-center flex-shrink-0 z-10`}>
        <Icon size={13} />
      </div>
      <div className="flex-1 min-w-0 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-slate-700">{config.label}</p>
            <p className="text-xs text-slate-400 mt-0.5 truncate">
              {event.message || event.medications?.name || event.type || '—'}
            </p>
          </div>
          <span className="text-[10px] text-slate-300 flex-shrink-0 tabular-nums">{formatTime(event.time)}</span>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
