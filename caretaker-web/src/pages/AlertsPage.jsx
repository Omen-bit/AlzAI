import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Bell, CheckCircle2, Clock, Filter, RefreshCw, ShieldCheck } from 'lucide-react';
import { toast } from 'react-hot-toast';

import { supabase } from '../lib/supabase';
import api from '../lib/api';
import { usePatient } from '../contexts/PatientContext';
import { formatTimeAgo, formatDateTime } from '../utils/timeFormat';
import { Card, CardHeader, CardTitle, Badge, Button, PageHeader, EmptyCard, Skeleton, Separator } from '../components/ui.jsx';

const FILTERS = ['All', 'Red', 'Amber', 'Acknowledged'];

const ALERT_ICONS = {
  fall_detected:     { emoji: '🚨', bg: 'bg-red-50',    text: 'text-red-500' },
  geofence_breach:   { emoji: '📍', bg: 'bg-orange-50', text: 'text-orange-500' },
  medication_missed: { emoji: '💊', bg: 'bg-amber-50',  text: 'text-amber-500' },
  sos_triggered:     { emoji: '🆘', bg: 'bg-red-50',    text: 'text-red-500' },
  vitals_anomaly:    { emoji: '❤️', bg: 'bg-rose-50',   text: 'text-rose-500' },
};

export default function AlertsPage() {
  const { patientId } = usePatient();
  const [alerts,  setAlerts]  = useState([]);
  const [filter,  setFilter]  = useState('All');
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const { data } = await supabase.from('alert_logs').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(50);
      setAlerts(data || []);
    } finally { setLoading(false); }
  }, [patientId]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleAck = async (id) => {
    try { await api.post('/alert/acknowledge', { alert_id: id }); } catch { /* fallback */ }
    await supabase.from('alert_logs').update({ acknowledged: true, acknowledged_at: new Date().toISOString() }).eq('id', id);
    toast.success('Alert acknowledged');
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a));
  };

  const filtered = alerts.filter(a => {
    if (filter === 'Red')          return a.severity === 'red' && !a.acknowledged;
    if (filter === 'Amber')        return a.severity === 'amber' && !a.acknowledged;
    if (filter === 'Acknowledged') return a.acknowledged;
    return true;
  });

  const redCount   = alerts.filter(a => a.severity === 'red'   && !a.acknowledged).length;
  const amberCount = alerts.filter(a => a.severity === 'amber' && !a.acknowledged).length;
  const ackCount   = alerts.filter(a => a.acknowledged).length;

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title="Alert History"
        description="All clinical incidents and notifications for this patient."
        action={
          <Button variant="ghost" size="sm" onClick={fetch}>
            <RefreshCw size={13} /> Refresh
          </Button>
        }
      />

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label:'Critical',     count: redCount,   variant:'danger',  icon:'🚨' },
          { label:'Warnings',     count: amberCount, variant:'warning', icon:'⚠️' },
          { label:'Acknowledged', count: ackCount,   variant:'default', icon:'✓' },
        ].map(({ label, count, variant, icon }) => (
          <Card key={label} className="text-center !py-4">
            <p className="text-xl font-bold text-slate-900">{loading ? '—' : count}</p>
            <p className="text-xs text-slate-400 mt-0.5">{label}</p>
          </Card>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 mb-5 p-1 bg-slate-100 rounded-xl w-fit">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              filter === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {f}
            {f === 'Red' && redCount > 0 && <span className="ml-1.5 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full inline-flex items-center justify-center">{redCount}</span>}
          </button>
        ))}
      </div>

      {/* Alert list */}
      <Card className="!p-0 overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-3">
            {[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyCard
            icon={ShieldCheck}
            title="No alerts"
            description={filter === 'All' ? 'No incidents have been recorded yet.' : `No ${filter.toLowerCase()} alerts found.`}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-500"
          />
        ) : (
          filtered.map((alert, idx) => {
            const iconCfg = ALERT_ICONS[alert.type] || { emoji:'🔔', bg:'bg-slate-50', text:'text-slate-400' };
            const isRed = alert.severity === 'red';
            return (
              <React.Fragment key={alert.id}>
                <div className={`flex items-start gap-4 p-4 hover:bg-slate-50/50 transition-colors ${alert.acknowledged ? 'opacity-60' : ''}`}>
                  <div className={`w-10 h-10 ${iconCfg.bg} rounded-xl flex items-center justify-center text-lg flex-shrink-0`}>
                    {iconCfg.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-900 capitalize">{alert.type?.replace(/_/g, ' ')}</p>
                        <Badge variant={isRed ? 'danger' : 'warning'} className="text-[10px]">{alert.severity?.toUpperCase()}</Badge>
                        {alert.acknowledged && <Badge variant="default" className="text-[10px]">Acknowledged</Badge>}
                      </div>
                      <p className="text-[11px] text-slate-400 flex-shrink-0 tabular-nums">{formatTimeAgo(alert.created_at)}</p>
                    </div>
                    {alert.message && <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{alert.message}</p>}
                    <p className="text-[10px] text-slate-300 mt-1">{formatDateTime(alert.created_at)}</p>
                    {!alert.acknowledged && (
                      <Button size="sm" variant="secondary" className="mt-2" onClick={() => handleAck(alert.id)}>
                        <CheckCircle2 size={12} /> Acknowledge
                      </Button>
                    )}
                  </div>
                </div>
                {idx < filtered.length - 1 && <Separator />}
              </React.Fragment>
            );
          })
        )}
      </Card>
    </div>
  );
}
