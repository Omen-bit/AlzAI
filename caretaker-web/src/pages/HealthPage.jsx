import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar,
  ResponsiveContainer, Tooltip, YAxis, ReferenceLine,
} from 'recharts';
import {
  Heart, Activity, Moon, Pill, CheckCircle2, XCircle, Circle,
  FileText, Upload, X, PlusCircle, TrendingDown, TrendingUp,
  RefreshCw, ChevronRight, Clock, BarChart2, Droplets, Download,
  AlertTriangle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { format, subDays, startOfWeek, addDays, isSameDay, isAfter } from 'date-fns';

import { supabase } from '../lib/supabase';
import { usePatient } from '../contexts/PatientContext';
import { formatDateTime } from '../utils/timeFormat';

/* ─── Animation Variants ─── */
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.07, duration: 0.42, ease: [0.22, 1, 0.36, 1] },
  }),
};

/* ─── Tooltip Components ─── */
const HeroTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl px-3 py-2 text-xs font-bold text-white shadow-2xl">
      {payload[0].value} <span className="opacity-60">BPM</span>
    </div>
  );
};

const LightTooltip = ({ active, payload, unit = '' }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white shadow-xl">
      {payload[0].value}{unit}
    </div>
  );
};

/* ─── SpO2 Arc Gauge ─── */
const SpO2Gauge = ({ value = 97 }) => {
  const size = 80;
  const r = 28;
  const cx = size / 2;
  const cy = size / 2 + 8;
  const circumference = Math.PI * r; // half circle
  const progress = ((value - 85) / 15) * circumference; // 85-100% range

  const color = value >= 95 ? '#10b981' : value >= 90 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size - 8 }}>
      <svg width={size} height={size - 8} viewBox={`0 0 ${size} ${size - 8}`}>
        {/* Track */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none" stroke="#f1f5f9" strokeWidth="6" strokeLinecap="round"
        />
        {/* Fill */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference}`}
          style={{ transition: 'stroke-dasharray 1.2s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
        <span className="text-[18px] font-black text-slate-900 leading-none">{value}%</span>
        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">SpO₂</span>
      </div>
    </div>
  );
};

/* ─── Compliance Dot Cell ─── */
const ComplianceDot = ({ status, isToday, isFuture }) => {
  if (status === 'confirmed')
    return (
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500 }}>
        <div className="w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-sm shadow-emerald-200">
          <CheckCircle2 size={14} className="text-white" strokeWidth={3} />
        </div>
      </motion.div>
    );
  if (status === 'missed')
    return (
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
        <div className="w-7 h-7 bg-rose-100 border border-rose-200 rounded-full flex items-center justify-center mx-auto">
          <XCircle size={14} className="text-rose-500" strokeWidth={2.5} />
        </div>
      </motion.div>
    );
  return (
    <div className={`w-7 h-7 rounded-full border-2 mx-auto ${
      isFuture ? 'border-slate-100 bg-slate-50' :
      isToday  ? 'border-slate-300 bg-white animate-pulse' :
                 'border-slate-200 bg-white'
    }`} />
  );
};

/* ─── Report Generator ─── */
const generateHTMLReport = ({ patientId, vitals, medications, medLogs, weekDays }) => {
  const genTime = format(new Date(), 'MMMM d, yyyy · h:mm a');

  const getStatus = (medId, day) => {
    const logs = medLogs.filter(
      l => l.medication_id === medId && isSameDay(new Date(l.scheduled_at), day)
    );
    if (!logs.length) return 'pending';
    return logs[0].status;
  };

  const complianceRows = medications.length > 0
    ? medications.map(med => {
        const cells = weekDays.map(day => {
          const s = getStatus(med.id, day);
          const cell = s === 'confirmed' ? '✅' : s === 'missed' ? '❌' : '○';
          return `<td style="text-align:center;padding:10px 8px;font-size:16px;">${cell}</td>`;
        }).join('');
        const taken = weekDays.filter(d => getStatus(med.id, d) === 'confirmed').length;
        const pct = Math.round((taken / 7) * 100);
        return `
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:12px 16px;">
              <strong style="color:#0f172a;font-size:14px;">${med.name}</strong><br/>
              <span style="color:#94a3b8;font-size:11px;">${med.dose || ''}</span>
            </td>
            ${cells}
            <td style="text-align:center;padding:10px 8px;">
              <span style="background:${pct>=80?'#dcfce7':pct>=50?'#fef9c3':'#fee2e2'};
                color:${pct>=80?'#16a34a':pct>=50?'#ca8a04':'#dc2626'};
                padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;">${pct}%</span>
            </td>
          </tr>`;
      }).join('')
    : `<tr><td colspan="9" style="text-align:center;padding:24px;color:#94a3b8;">No medications recorded</td></tr>`;

  const dayHeaders = weekDays.map(d =>
    `<th style="padding:10px 8px;text-align:center;font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;">${format(d, 'EEE d')}</th>`
  ).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>SATHI Health Report — ${genTime}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #ffffff; color: #0f172a; padding: 40px; max-width: 960px; margin: 0 auto; }
    .header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 36px; padding-bottom: 24px; border-bottom: 2px solid #f1f5f9; }
    .logo { font-size: 22px; font-weight: 900; color: #2563eb; letter-spacing: -0.04em; }
    .logo span { color: #0f172a; }
    .meta { font-size: 11px; color: #94a3b8; text-align: right; line-height: 1.6; }
    .section-title { font-size: 13px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 14px; margin-top: 32px; }
    .vitals-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 8px; }
    .vital-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px 18px; }
    .vital-label { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px; }
    .vital-value { font-size: 26px; font-weight: 900; color: #0f172a; letter-spacing: -0.04em; }
    .vital-unit { font-size: 13px; font-weight: 600; color: #94a3b8; margin-left: 3px; }
    table { width: 100%; border-collapse: collapse; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; }
    thead { background: #f8fafc; }
    th { padding: 12px 16px; text-align: left; font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 1px solid #e2e8f0; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #f1f5f9; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between; }
    .badge-ok   { background:#dcfce7; color:#16a34a; border-radius:99px; padding:2px 8px; font-size:10px; font-weight:700; }
    .badge-warn { background:#fef9c3; color:#ca8a04; border-radius:99px; padding:2px 8px; font-size:10px; font-weight:700; }
    .badge-err  { background:#fee2e2; color:#dc2626; border-radius:99px; padding:2px 8px; font-size:10px; font-weight:700; }
    @media print { body { padding: 20px; } @page { margin: 1.5cm; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">SATHI<span> Health</span></div>
      <div style="font-size:12px;color:#64748b;margin-top:4px;">Clinical Monitoring Report</div>
    </div>
    <div class="meta">
      Generated: ${genTime}<br/>
      Patient ID: ${patientId || 'N/A'}<br/>
      Report Period: Last 7 Days
    </div>
  </div>

  <p class="section-title">Vital Signs</p>
  <div class="vitals-grid">
    <div class="vital-card">
      <div class="vital-label">❤️ Heart Rate</div>
      <div class="vital-value">${vitals?.heart_rate ?? '—'}<span class="vital-unit">BPM</span></div>
      <div style="margin-top:4px;"><span class="badge-ok">Normal</span></div>
    </div>
    <div class="vital-card">
      <div class="vital-label">💧 SpO₂</div>
      <div class="vital-value">${vitals?.spo2 ?? '97'}<span class="vital-unit">%</span></div>
      <div style="margin-top:4px;"><span class="${(vitals?.spo2 ?? 97) >= 95 ? 'badge-ok' : 'badge-warn'}">${(vitals?.spo2 ?? 97) >= 95 ? 'Normal' : 'Low'}</span></div>
    </div>
    <div class="vital-card">
      <div class="vital-label">🌙 Sleep</div>
      <div class="vital-value">${vitals?.sleep_hours ?? '—'}<span class="vital-unit">hrs</span></div>
      <div style="margin-top:4px;"><span class="${(vitals?.sleep_hours ?? 0) >= 7 ? 'badge-ok' : (vitals?.sleep_hours ?? 0) >= 5 ? 'badge-warn' : 'badge-err'}">${(vitals?.sleep_hours ?? 0) >= 7 ? 'Good' : (vitals?.sleep_hours ?? 0) >= 5 ? 'Fair' : 'Poor'}</span></div>
    </div>
    <div class="vital-card">
      <div class="vital-label">⚡ Steps</div>
      <div class="vital-value">${vitals?.steps?.toLocaleString() ?? '—'}<span class="vital-unit">steps</span></div>
      <div style="margin-top:4px;"><span class="${(vitals?.steps ?? 0) >= 5000 ? 'badge-ok' : 'badge-warn'}">${(vitals?.steps ?? 0) >= 5000 ? 'Goal met' : `${Math.round(((vitals?.steps ?? 0)/5000)*100)}% goal`}</span></div>
    </div>
  </div>
  <div style="font-size:11px;color:#94a3b8;margin-top:8px;">Last recorded: ${formatDateTime(vitals?.recorded_at)}</div>

  <p class="section-title">Medication Compliance — Last 7 Days</p>
  <table>
    <thead>
      <tr>
        <th style="min-width:180px;">Medication</th>
        ${dayHeaders}
        <th style="text-align:center;">Compliance</th>
      </tr>
    </thead>
    <tbody>${complianceRows}</tbody>
  </table>

  <div class="footer">
    <span>⚠️ This report is for clinical reference only. Do not use for self-diagnosis.</span>
    <span>SATHI Caretaker Platform · ${genTime}</span>
  </div>

  <script>setTimeout(() => window.print(), 600);</script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=1000,height=800');
  if (win) {
    win.document.write(html);
    win.document.close();
  } else {
    toast.error('Allow popups to generate the report');
  }
};

/* ═══════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════ */
const HealthPage = () => {
  const { patientId } = usePatient();

  const [latestVitals, setLatestVitals] = useState(null);
  const [hrHistory24h, setHrHistory24h] = useState([]);
  const [sleepHistory7d, setSleepHistory7d] = useState([]);
  const [medications, setMedications] = useState([]);
  const [medLogs7d, setMedLogs7d] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [newMed, setNewMed] = useState({ name: '', dose: '', schedule_times: [], tablet_image_url: '' });
  const [isUploading, setIsUploading] = useState(false);

  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));

  const fetchData = useCallback(async () => {
    if (!patientId) return;

    const { data: latest } = await supabase.from('vitals_logs').select('*')
      .eq('patient_id', patientId).order('recorded_at', { ascending: false }).limit(1).single();
    if (latest) setLatestVitals(latest);

    const { data: hr24h } = await supabase.from('vitals_logs')
      .select('heart_rate, recorded_at').eq('patient_id', patientId)
      .gte('recorded_at', subDays(new Date(), 1).toISOString())
      .order('recorded_at', { ascending: true });
    if (hr24h) setHrHistory24h(hr24h.map(h => ({ hr: h.heart_rate, time: h.recorded_at })));

    const { data: sleep7d } = await supabase.from('vitals_logs')
      .select('sleep_hours, recorded_at').eq('patient_id', patientId)
      .gte('recorded_at', subDays(new Date(), 7).toISOString())
      .order('recorded_at', { ascending: true });
    if (sleep7d) setSleepHistory7d(sleep7d.map(s => ({
      value: s.sleep_hours,
      day: format(new Date(s.recorded_at), 'EEE'),
    })));

    const { data: medsData } = await supabase.from('medications').select('*').eq('patient_id', patientId);
    if (medsData) setMedications(medsData);

    const { data: logsData } = await supabase.from('medication_logs').select('*')
      .eq('patient_id', patientId).gte('scheduled_at', weekStart.toISOString());
    if (logsData) setMedLogs7d(logsData);
  }, [patientId, weekStart]);

  useEffect(() => {
    fetchData();
    if (!patientId) return;
    const vSub = supabase.channel('h-vitals')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vitals_logs', filter: `patient_id=eq.${patientId}` }, fetchData)
      .subscribe();
    const mSub = supabase.channel('h-meds')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'medication_logs', filter: `patient_id=eq.${patientId}` }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(vSub); supabase.removeChannel(mSub); };
  }, [patientId, fetchData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setTimeout(() => setIsRefreshing(false), 700);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
    try {
      const res = await axios.post(
        `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`, fd
      );
      setNewMed(m => ({ ...m, tablet_image_url: res.data.secure_url }));
      toast.success('Image uploaded');
    } catch { toast.error('Upload failed'); }
    finally { setIsUploading(false); }
  };

  const handleAddMedication = async (e) => {
    e.preventDefault();
    if (!newMed.name || newMed.schedule_times.length === 0) {
      toast.error('Name and at least one schedule time required');
      return;
    }
    try {
      const { error } = await supabase.from('medications').insert({
        ...newMed,
        patient_id: patientId,
      });
      if (error) throw error;
      toast.success('Medication added');
      setShowAddModal(false);
      setNewMed({ name: '', dose: '', schedule_times: [], tablet_image_url: '' });
      fetchData();
    } catch { toast.error('Failed to add medication'); }
  };

  const handleExportReport = () => {
    setIsGeneratingReport(true);
    try {
      generateHTMLReport({
        patientId,
        vitals: latestVitals,
        medications,
        medLogs: medLogs7d,
        weekDays,
      });
      toast.success('Report opened — use Print → Save as PDF');
    } catch {
      toast.error('Failed to generate report');
    } finally {
      setTimeout(() => setIsGeneratingReport(false), 800);
    }
  };

  const toggleTime = (time) =>
    setNewMed(m => ({
      ...m,
      schedule_times: m.schedule_times.includes(time)
        ? m.schedule_times.filter(t => t !== time)
        : [...m.schedule_times, time],
    }));

  /* ── Derived values ── */
  const hrBpm    = latestVitals?.heart_rate;
  const spo2Val  = latestVitals?.spo2 ?? 97;
  const sleepHrs = latestVitals?.sleep_hours;
  const steps    = latestVitals?.steps ?? 0;
  const stepsPercent = Math.min(Math.round((steps / 5000) * 100), 100);

  /* ── Demo fallbacks ── */
  const hrData = hrHistory24h.length > 0 ? hrHistory24h
    : Array.from({ length: 32 }, (_, i) => ({
        hr: 72 + Math.round(Math.sin(i / 2.5) * 9 + Math.sin(i / 7) * 4),
        time: i,
      }));

  const sleepData = sleepHistory7d.length > 0 ? sleepHistory7d : [
    { day: 'Mon', value: 7.2 }, { day: 'Tue', value: 6.8 }, { day: 'Wed', value: 7.5 },
    { day: 'Thu', value: 5.9 }, { day: 'Fri', value: 6.2 }, { day: 'Sat', value: 8.1 }, { day: 'Sun', value: 6.0 },
  ];

  /* ── Demo meds fallback ── */
  const DEMO_MEDS = [
    { id: 'd1', name: 'Lisinopril',  dose: '10mg · Once Daily (AM)', compliance: ['confirmed','confirmed','confirmed','confirmed','confirmed','confirmed','confirmed'] },
    { id: 'd2', name: 'Atorvastatin',dose: '20mg · Bedtime',          compliance: ['confirmed','confirmed','missed','missed','missed','pending','pending'] },
    { id: 'd3', name: 'Metformin',   dose: '500mg · Twice Daily',      compliance: ['confirmed','confirmed','confirmed','confirmed','confirmed','confirmed','pending'] },
  ];
  const showDemo = medications.length === 0;
  const displayMeds = showDemo ? DEMO_MEDS : medications;

  const getMedAccent = (i) => [
    { bg: 'bg-rose-100',    text: 'text-rose-600' },
    { bg: 'bg-blue-100',    text: 'text-blue-600' },
    { bg: 'bg-emerald-100', text: 'text-emerald-600' },
    { bg: 'bg-violet-100',  text: 'text-violet-600' },
  ][i % 4];

  const getMedStatus = (med, day) => {
    if (showDemo) return med.compliance[weekDays.indexOf(weekDays.find(d => isSameDay(d, day)))];
    const logs = medLogs7d.filter(l => l.medication_id === med.id && isSameDay(new Date(l.scheduled_at), day));
    if (!logs.length) return isAfter(day, today) ? 'future' : 'pending';
    return logs[0].status;
  };

  const getMedCompliance = (med) => {
    const taken = weekDays.filter(d => getMedStatus(med, d) === 'confirmed').length;
    return Math.round((taken / 7) * 100);
  };

  /* ═══════ RENDER ═══════ */
  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-8 pb-16">

      {/* ── Page Header ── */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible"
        className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Health &amp; Medication</h1>
          <p className="text-sm text-slate-400 mt-1">Monitoring vital trends and treatment compliance for the last 7 days.</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
          onClick={handleRefresh}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:border-slate-300 hover:shadow-sm transition-all"
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-blue-500' : 'text-slate-400'} />
          Refresh
        </motion.button>
      </motion.div>

      {/* ── Hero ECG Card ── */}
      <motion.div
        variants={fadeUp} initial="hidden" animate="visible" custom={1}
        className="relative rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: 'linear-gradient(135deg, #06091a 0%, #0f172a 50%, #080f26 100%)' }}
      >
        {/* Ambient glows */}
        <div className="pointer-events-none absolute -top-20 -right-20 w-80 h-80 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)' }} />
        <div className="pointer-events-none absolute -bottom-12 left-16 w-56 h-56 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)' }} />

        <div className="relative z-10 p-8">
          {/* Top row */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Heart size={12} className="text-rose-400 fill-rose-400" />
                <span className="text-[10px] font-black text-rose-400 uppercase tracking-[0.22em]">Current Heart Rate</span>
                <span className="relative flex h-2 w-2 ml-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-60" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                </span>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-[68px] font-black leading-none tracking-tighter text-white">{hrBpm ?? '82'}</span>
                <span className="text-[22px] font-bold text-slate-500">BPM</span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 mt-1">
              <div className="bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-wider">
                Normal · +2%
              </div>
              <button onClick={handleRefresh}
                className="text-slate-500 text-[10px] font-black uppercase tracking-widest hover:text-slate-300 transition-colors flex items-center gap-1.5">
                <RefreshCw size={9} /> Reset
              </button>
            </div>
          </div>

          {/* ECG Line Chart */}
          <div className="h-[120px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hrData} margin={{ top: 6, right: 4, left: -32, bottom: 0 }}>
                <ReferenceLine y={60}  stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
                <ReferenceLine y={80}  stroke="rgba(255,255,255,0.10)" strokeDasharray="4 4" />
                <ReferenceLine y={100} stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
                <YAxis
                  domain={[45, 115]}
                  tick={{ fill: '#475569', fontSize: 9 }}
                  axisLine={false} tickLine={false}
                  ticks={[60, 80, 100]}
                />
                <Tooltip content={<HeroTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1 }} />
                <Line
                  type="monotone" dataKey="hr"
                  stroke="#3b82f6" strokeWidth={2}
                  dot={false} activeDot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }}
                  animationDuration={1600}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Footer row */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/[0.06]">
            <div className="flex items-center gap-2 text-slate-500">
              <Clock size={10} />
              <span className="text-[10px] font-bold uppercase tracking-widest">{formatDateTime(latestVitals?.recorded_at)}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/[0.05] border border-white/10 px-3 py-1.5 rounded-lg">
              <BarChart2 size={9} className="text-slate-400" />
              <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Events · 1,277</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Three Metric Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

        {/* SpO2 Card */}
        <MetricCard custom={2}
          icon={Droplets} iconBg="bg-sky-50" iconColor="text-sky-500"
          label="Blood Oxygen (SpO₂)"
          value={spo2Val} unit="%"
          rightSlot={<SpO2Gauge value={spo2Val} />}
          footer={
            <div className="flex items-center gap-1.5">
              <span className={`text-[10px] font-black uppercase tracking-wide ${spo2Val >= 95 ? 'text-emerald-600' : spo2Val >= 90 ? 'text-amber-600' : 'text-rose-600'}`}>
                {spo2Val >= 95 ? '✓ Normal range' : spo2Val >= 90 ? '⚠ Slightly low' : '❗ Below normal'}
              </span>
            </div>
          }
        />

        {/* Activity Card */}
        <MetricCard custom={3}
          icon={Activity} iconBg="bg-emerald-50" iconColor="text-emerald-600"
          label="Activity"
          value={steps > 0 ? steps.toLocaleString() : '1,240'} unit="steps"
          rightSlot={
            <div className="relative w-[72px] h-[72px] flex-shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="14" fill="none" stroke="#f0fdf4" strokeWidth="3.5" />
                <circle cx="18" cy="18" r="14" fill="none"
                  stroke="#10b981" strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeDasharray={`${(stepsPercent / 100) * 87.96} 87.96`}
                  style={{ transition: 'stroke-dasharray 1.2s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[13px] font-black text-slate-900 leading-none">{stepsPercent}%</span>
                <span className="text-[7px] font-bold text-slate-400 uppercase">Goal</span>
              </div>
            </div>
          }
          footer={
            <span className={`text-[10px] font-semibold ${stepsPercent >= 100 ? 'text-emerald-600' : stepsPercent >= 60 ? 'text-amber-600' : 'text-slate-400'}`}>
              {stepsPercent >= 100 ? '🎉 Daily goal achieved' : `${5000 - steps > 0 ? (5000 - steps).toLocaleString() : 0} steps to goal`}
            </span>
          }
        />

        {/* Sleep Card */}
        <MetricCard custom={4}
          icon={Moon} iconBg="bg-indigo-50" iconColor="text-indigo-500"
          label="Sleep Quality"
          value={sleepHrs ?? '6.2'} unit="hrs"
          rightSlot={
            <div className="h-12 w-28 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sleepData} barSize={7} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <Bar dataKey="value" fill="#a5b4fc" radius={[3, 3, 0, 0]} />
                  <Tooltip content={<LightTooltip unit=" hrs" />} cursor={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          }
          footer={
            (sleepHrs ?? 0) < 5 ? (
              <div className="flex items-center gap-1.5 text-rose-500">
                <TrendingDown size={10} />
                <span className="text-[10px] font-semibold">Below recommended · Decreasing 3 days</span>
              </div>
            ) : (sleepHrs ?? 0) >= 7 ? (
              <span className="text-[10px] font-semibold text-emerald-600">✓ Optimal sleep duration</span>
            ) : (
              <span className="text-[10px] font-semibold text-amber-600">Slightly below 7 hrs target</span>
            )
          }
        />
      </div>

      {/* ── Medication Compliance ── */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={5}
        className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">Medication Compliance</h3>
            <p className="text-xs text-slate-400 mt-0.5">Daily adherence across all prescribed medications this week</p>
          </div>
          <div className="flex items-center gap-3">
            {showDemo && (
              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                <AlertTriangle size={10} /> Demo data
              </span>
            )}
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
              Last 7 Days
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[820px]">
              <thead>
                <tr className="bg-slate-50/80">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] border-b border-slate-100 text-left" style={{ width: 220 }}>
                    Medication
                  </th>
                  {weekDays.map(day => {
                    const isToday = isSameDay(day, today);
                    return (
                      <th key={day.toString()} className={`px-2 py-4 text-center border-b border-slate-100 ${isToday ? 'bg-blue-50/60' : ''}`}>
                        <div className="flex flex-col items-center gap-1">
                          <span className={`text-[10px] font-black uppercase tracking-widest ${isToday ? 'text-blue-600' : 'text-slate-400'}`}>
                            {format(day, 'EEE')}
                          </span>
                          <span className={`text-[9px] font-semibold ${isToday ? 'text-blue-400' : 'text-slate-300'}`}>
                            {format(day, 'd')}
                          </span>
                        </div>
                      </th>
                    );
                  })}
                  <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] border-b border-slate-100 text-center">
                    Rate
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayMeds.map((med, idx) => {
                  const accent = getMedAccent(idx);
                  const pct = getMedCompliance(med);
                  const pctColor = pct >= 80 ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                    : pct >= 50 ? 'text-amber-700 bg-amber-50 border-amber-200'
                    : 'text-rose-700 bg-rose-50 border-rose-200';
                  const barColor = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : 'bg-rose-500';

                  return (
                    <motion.tr key={med.id ?? idx}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.07 }}
                      className="hover:bg-slate-50/50 transition-colors">
                      {/* Med info */}
                      <td className="px-6 py-5 border-b border-slate-50">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl ${accent.bg} ${accent.text} flex items-center justify-center flex-shrink-0`}>
                            <Pill size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate">{med.name}</p>
                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight mt-0.5 truncate">{med.dose}</p>
                          </div>
                        </div>
                      </td>

                      {/* Day cells */}
                      {weekDays.map(day => {
                        const isToday = isSameDay(day, today);
                        const isFuture = isAfter(day, today);
                        const status = getMedStatus(med, day);
                        return (
                          <td key={day.toString()} className={`px-2 py-5 border-b border-slate-50 ${isToday ? 'bg-blue-50/30' : ''}`}>
                            <ComplianceDot status={status} isToday={isToday} isFuture={isFuture} />
                          </td>
                        );
                      })}

                      {/* Compliance % */}
                      <td className="px-4 py-5 border-b border-slate-50">
                        <div className="flex flex-col items-center gap-1.5">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${pctColor}`}>
                            {pct}%
                          </span>
                          <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full ${barColor} rounded-full`} style={{ width: `${pct}%`, transition: 'width 1s ease' }} />
                          </div>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Legend + summary */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-50 bg-slate-50/40">
            <div className="flex items-center gap-5">
              <LegendDot color="bg-emerald-500" label="Taken" />
              <LegendDot color="bg-rose-100 border border-rose-200" label="Missed" iconColor="text-rose-500" />
              <LegendDot color="bg-white border border-slate-200" label="Pending / Future" />
            </div>
            <div className="text-[10px] font-semibold text-slate-400">
              Overall: {displayMeds.length > 0
                ? `${Math.round(displayMeds.reduce((s, m) => s + getMedCompliance(m), 0) / displayMeds.length)}% adherence this week`
                : '—'}
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Action Buttons ── */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={6}
        className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ActionButton
          onClick={() => setShowAddModal(true)}
          icon={<PlusCircle size={18} className="text-blue-600" />}
          label="Log New Medication"
          sublabel="Add a new prescription to monitoring"
        />
        <ActionButton
          onClick={handleExportReport}
          disabled={isGeneratingReport}
          loading={isGeneratingReport}
          icon={<Download size={18} className="text-indigo-600" />}
          label={isGeneratingReport ? 'Preparing Report…' : 'Export Health Report'}
          sublabel="Generates a print-ready clinical PDF"
          accent
        />
      </motion.div>

      {/* ── Add Medication Modal ── */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md"
            onClick={e => { if (e.target === e.currentTarget) setShowAddModal(false); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 24 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl border border-slate-100 relative"
            >
              <button onClick={() => setShowAddModal(false)}
                className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-xl transition">
                <X size={18} />
              </button>

              <div className="flex items-center gap-3 mb-7">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                  <Pill size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Add Medication</h3>
                  <p className="text-xs text-slate-400">Register a new prescription for monitoring</p>
                </div>
              </div>

              <form onSubmit={handleAddMedication} className="flex flex-col gap-5">
                <ModalField label="Medication Name">
                  <input required type="text" placeholder="e.g. Donepezil"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition placeholder:text-slate-300"
                    value={newMed.name} onChange={e => setNewMed(m => ({ ...m, name: e.target.value }))} />
                </ModalField>

                <ModalField label="Dose Instructions">
                  <input required type="text" placeholder="e.g. 10mg — Once Daily (AM)"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition placeholder:text-slate-300"
                    value={newMed.dose} onChange={e => setNewMed(m => ({ ...m, dose: e.target.value }))} />
                </ModalField>

                <ModalField label="Schedule Times">
                  <div className="grid grid-cols-2 gap-2.5">
                    {['08:00 AM', '12:00 PM', '06:00 PM', '10:00 PM'].map(t => {
                      const sel = newMed.schedule_times.includes(t);
                      return (
                        <button key={t} type="button" onClick={() => toggleTime(t)}
                          className={`px-4 py-2.5 rounded-xl border text-xs font-bold uppercase tracking-wide transition-all ${
                            sel ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100'
                                : 'bg-white border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-500'
                          }`}>
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </ModalField>

                <ModalField label="Tablet Photo (Optional)">
                  <div onClick={() => document.getElementById('hp-tablet-upload').click()}
                    className={`h-28 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                      newMed.tablet_image_url ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/30'
                    }`}>
                    {isUploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-semibold text-slate-400">Uploading…</span>
                      </div>
                    ) : newMed.tablet_image_url ? (
                      <div className="flex flex-col items-center gap-1">
                        <img src={newMed.tablet_image_url} alt="tablet" className="h-14 w-14 object-cover rounded-xl shadow" />
                        <span className="text-[10px] font-black text-emerald-600 uppercase">Ready</span>
                      </div>
                    ) : (
                      <>
                        <Upload size={20} className="text-slate-300" />
                        <span className="text-xs font-semibold text-slate-400">Click to upload photo</span>
                      </>
                    )}
                  </div>
                  <input id="hp-tablet-upload" type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                </ModalField>

                <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-2xl font-bold text-sm shadow-lg shadow-blue-100 transition mt-1">
                  Save Medication
                </motion.button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ─────────────────────────────────────────
   LOCAL SUB-COMPONENTS
───────────────────────────────────────── */

const MetricCard = ({ custom, icon: Icon, iconBg, iconColor, label, value, unit, rightSlot, footer }) => (
  <motion.div
    variants={fadeUp} initial="hidden" animate="visible" custom={custom}
    whileHover={{ y: -2, boxShadow: '0 12px 32px rgba(0,0,0,0.09)' }}
    className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col gap-4 transition-all cursor-default"
  >
    <div className="flex items-center gap-2.5">
      <div className={`w-8 h-8 ${iconBg} ${iconColor} rounded-xl flex items-center justify-center`}>
        <Icon size={16} />
      </div>
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">{label}</span>
    </div>
    <div className="flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[30px] font-black text-slate-900 leading-none tracking-tight">{value}</span>
          <span className="text-sm font-bold text-slate-400">{unit}</span>
        </div>
        {footer && <div className="mt-2.5">{footer}</div>}
      </div>
      {rightSlot}
    </div>
  </motion.div>
);

const ActionButton = ({ onClick, icon, label, sublabel, disabled, loading, accent }) => (
  <motion.button
    whileHover={{ scale: disabled ? 1 : 1.01, y: disabled ? 0 : -1 }}
    whileTap={{ scale: disabled ? 1 : 0.98 }}
    onClick={onClick} disabled={disabled}
    className={`rounded-2xl p-5 flex items-center gap-4 transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed shadow-sm border ${
      accent
        ? 'bg-indigo-600 border-indigo-700 hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-200'
        : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-md'
    }`}
  >
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
      accent ? 'bg-white/15' : 'bg-slate-50 group-hover:bg-blue-50'
    }`}>
      {loading
        ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        : icon}
    </div>
    <div className="flex-1">
      <p className={`text-sm font-bold ${accent ? 'text-white' : 'text-slate-800'}`}>{label}</p>
      <p className={`text-[11px] mt-0.5 ${accent ? 'text-indigo-200' : 'text-slate-400'}`}>{sublabel}</p>
    </div>
    <ChevronRight size={16} className={`group-hover:translate-x-0.5 transition-transform ${accent ? 'text-indigo-300' : 'text-slate-300'}`} />
  </motion.button>
);

const LegendDot = ({ color, label }) => (
  <div className="flex items-center gap-1.5">
    <div className={`w-3.5 h-3.5 rounded-full ${color}`} />
    <span className="text-[10px] font-semibold text-slate-500">{label}</span>
  </div>
);

const ModalField = ({ label, children }) => (
  <div className="flex flex-col gap-2">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] pl-0.5">{label}</label>
    {children}
  </div>
);

export default HealthPage;
