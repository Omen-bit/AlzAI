import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { formatTime } from '../utils/timeFormat';
import React from 'react';

const formatAlertType = (type) => {
  const types = {
    fall_detected: 'Fall Detected',
    geofence_breach: 'Left Safe Zone',
    medication_missed: 'Medication Missed',
    sos_triggered: 'SOS Emergency',
    vitals_anomaly: 'Vitals Anomaly',
    medication_pattern: 'Medication Pattern',
    sleep_decline: 'Sleep Decline',
    behavioral_anomaly: 'Behavioral Anomaly'
  };
  return types[type] || type;
};

const CustomToast = ({ title, description, actionLabel, onAction }) => (
  <div className="flex flex-col gap-1 pr-2">
    <p className="font-bold text-sm leading-none">{title}</p>
    {description && <p className="text-[11px] opacity-80 font-medium leading-tight mt-1">{description}</p>}
    {onAction && (
      <button 
        onClick={onAction}
        className="mt-2 text-[10px] font-black uppercase tracking-widest text-white underline underline-offset-2 text-left"
      >
        {actionLabel}
      </button>
    )}
  </div>
);

export const useGlobalRealtime = (patientId, patientName) => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!patientId) return;

    // 1. Alert Logs (Red/Amber)
    const alertChannel = supabase.channel('global-alerts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alert_logs', filter: `patient_id=eq.${patientId}` }, (payload) => {
        const alert = payload.new;
        if (alert.severity === 'red') {
          toast.error((t) => (
            <CustomToast 
              title={`🚨 ${formatAlertType(alert.type)}`}
              description={alert.message}
              actionLabel="View Incident"
              onAction={() => { toast.dismiss(t.id); navigate('/alerts'); }}
            />
          ), { duration: Infinity });
        } else if (alert.severity === 'amber') {
          toast((t) => (
            <CustomToast 
              title={`⚠ ${formatAlertType(alert.type)}`}
              description={alert.message}
            />
          ), { duration: 8000, icon: '⚠' });
        }
      })
      .subscribe();

    // 2. Fall Logs
    const fallChannel = supabase.channel('global-falls')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'fall_logs', filter: `patient_id=eq.${patientId}` }, (payload) => {
        const fall = payload.new;
        toast.error((t) => (
          <CustomToast 
            title="🚨 Fall Detected"
            description={`Detected at ${formatTime(fall.detected_at)}`}
            actionLabel="View Response Center"
            onAction={() => { toast.dismiss(t.id); navigate('/alerts'); }}
          />
        ), { duration: Infinity });
      })
      .subscribe();

    // 3. Location Breach
    const locChannel = supabase.channel('global-loc')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'location_logs', filter: `patient_id=eq.${patientId}` }, (payload) => {
        if (payload.new.breach_status === 'outside') {
          toast.error((t) => (
            <CustomToast 
              title="🚨 Patient Left Safe Zone"
              description={`Breach detected at ${formatTime(payload.new.timestamp)}`}
              actionLabel="Open Live Map"
              onAction={() => { toast.dismiss(t.id); navigate('/location'); }}
            />
          ), { duration: Infinity });
        }
      })
      .subscribe();

    // 4. Photo Recognition (Viewed)
    const photoChannel = supabase.channel('global-photos')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'photos', filter: `patient_id=eq.${patientId}` }, (payload) => {
        if (payload.new?.viewed_at !== null && (!payload.old || payload.old?.viewed_at === null)) {
          toast.success("✓ Patient saw your photo", { duration: 4000 });
        }
      })
      .subscribe();

    // 5. Briefing Delivery
    const briefingChannel = supabase.channel('global-briefing')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'briefing_logs', filter: `patient_id=eq.${patientId}` }, (payload) => {
        toast("🌅 Morning briefing ready", {
          description: "Today's AI summary is available",
          duration: 6000,
          icon: '🌅'
        });
      })
      .subscribe();

    // 6. Dynamic Browser Tab Title
    const statusChannel = supabase.channel('global-status')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'patient_status', filter: `patient_id=eq.${patientId}` }, (payload) => {
        const status = payload.new.status;
        const name = patientName || 'Patient';
        if (status === 'RED') document.title = `🔴 ATTENTION — ${name} | SATHI`;
        else if (status === 'AMBER') document.title = `🟡 ${name} | SATHI`;
        else document.title = `🟢 ${name} | SATHI`;
      })
      .subscribe();

    return () => {
      supabase.removeChannel(alertChannel);
      supabase.removeChannel(fallChannel);
      supabase.removeChannel(locChannel);
      supabase.removeChannel(photoChannel);
      supabase.removeChannel(briefingChannel);
      supabase.removeChannel(statusChannel);
    };
  }, [patientId, patientName, navigate]);
};
