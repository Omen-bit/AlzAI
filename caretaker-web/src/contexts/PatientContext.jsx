import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { seedDemoData, DEMO_PATIENT_ID, DEMO_CARETAKER_ID } from '../utils/seedDemo';
import { toast } from 'react-hot-toast';

const PatientContext = createContext();

export const PatientProvider = ({ children }) => {
  const [patientId]   = useState(DEMO_PATIENT_ID);
  const [caretakerId] = useState(DEMO_CARETAKER_ID);
  const [patient,   setPatient]   = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [seeded,    setSeeded]    = useState(false);

  useEffect(() => {
    const init = async () => {
      setLoading(true);

      // 1 ── Try to fetch the patient from DB
      const { data: dbPatient } = await supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .maybeSingle();

      if (dbPatient) {
        // Patient exists — check if dynamic data has been seeded today
        const { data: vitals } = await supabase
          .from('vitals_logs')
          .select('id')
          .eq('patient_id', patientId)
          .gte('recorded_at', new Date(Date.now() - 8 * 86400000).toISOString())
          .limit(1);

        if (!vitals || vitals.length === 0) {
          // Patient row exists but no recent vitals — refresh dynamic data
          console.log('[PatientContext] Patient exists, refreshing dynamic data...');
          const { seedDynamicData } = await import('../utils/seedDemo');
          await seedDynamicData();
          toast.success('Demo data refreshed', { id: 'seed' });
        }

        setPatient(dbPatient);
        setSeeded(true);
      } else {
        // No patient — full seed
        console.log('[PatientContext] Seeding demo data for first time...');
        const toastId = toast.loading('Setting up demo data…', { id: 'seed' });
        try {
          await seedDemoData();
          toast.success('SATHI demo ready!', { id: toastId });

          // Re-fetch after seed
          const { data: seededPatient } = await supabase
            .from('patients')
            .select('*')
            .eq('id', patientId)
            .maybeSingle();

          setPatient(seededPatient || { id: patientId, name: 'Sarah Jenkins', status: 'active' });
          setSeeded(true);
        } catch (err) {
          console.error('[PatientContext] Seed failed:', err);
          toast.error('Demo seed failed — using local fallback', { id: toastId });
          // Fallback mock patient so the UI still works
          setPatient({ id: patientId, name: 'Sarah Jenkins', status: 'active', stage: 'moderate' });
          setSeeded(true);
        }
      }

      setLoading(false);
    };

    if (patientId) init();
  }, [patientId]);

  // Realtime: keep patient row in sync
  useEffect(() => {
    if (!patientId) return;
    const ch = supabase.channel('patient-row')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'patients',
        filter: `id=eq.${patientId}`,
      }, (payload) => setPatient(payload.new))
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [patientId]);

  return (
    <PatientContext.Provider value={{ patientId, caretakerId, patient, loading, seeded }}>
      {children}
    </PatientContext.Provider>
  );
};

export const usePatient = () => {
  const ctx = useContext(PatientContext);
  if (!ctx) throw new Error('usePatient must be used within a PatientProvider');
  return ctx;
};
