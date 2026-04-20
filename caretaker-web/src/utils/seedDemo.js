/**
 * SATHI — Demo Data Seeder
 * Seeds all dynamic tables with realistic dummy data.
 * Automatically called by PatientContext on first load if no data exists.
 */
import { supabase } from '../lib/supabase';

/* ─── Fixed Demo UUIDs ─── */
export const DEMO_PATIENT_ID   = '00000000-0000-4000-a000-000000000001';
export const DEMO_DOCTOR_ID    = '00000000-0000-4000-a000-000000000002';
export const DEMO_CARETAKER_ID = '00000000-0000-4000-a000-000000000003';

const MED_1_ID = '00000000-0000-4000-a000-000000000011'; // Lisinopril
const MED_2_ID = '00000000-0000-4000-a000-000000000012'; // Donepezil
const MED_3_ID = '00000000-0000-4000-a000-000000000013'; // Memantine

/* ─── Helpers ─── */
const daysAgo = (n) => new Date(Date.now() - n * 86400000);
const hhmm = (date, h, m = 0) => {
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};
const startOfWeekMon = (date) => {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

/* ══════════════════════════════════════
   MAIN SEED FUNCTION
══════════════════════════════════════ */
export async function seedDemoData(toast) {
  const log = (...args) => console.log('[SATHI Seed]', ...args);
  log('Starting seed...');

  try {
    /* 1 ── Core entities ─────────────────────────── */
    // Doctor
    await supabase.from('doctors').upsert({
      id: DEMO_DOCTOR_ID,
      name: 'Dr. Rajesh Sharma',
      email: 'dr.sharma@sathi.health',
      nmc_number: 'NMC-2024-001',
      nmc_verified: true,
      status: 'active',
    }, { onConflict: 'id', ignoreDuplicates: true });

    // Patient
    await supabase.from('patients').upsert({
      id: DEMO_PATIENT_ID,
      doctor_id: DEMO_DOCTOR_ID,
      name: 'Sarah Jenkins',
      age: 72,
      language: 'en-IN',
      stage: 'moderate',
      patient_key: 'SATHI-DEMO-001',
      status: 'active',
    }, { onConflict: 'id', ignoreDuplicates: true });

    // Caretaker
    await supabase.from('caretakers').upsert({
      id: DEMO_CARETAKER_ID,
      patient_id: DEMO_PATIENT_ID,
      name: 'Aisha Patel',
      phone: '+91-9876543210',
      email: 'aisha.patel@sathi.health',
      role: 'primary',
      status: 'active',
    }, { onConflict: 'id', ignoreDuplicates: true });

    // Family Members
    await supabase.from('family_members').upsert([
      { id: '00000000-0000-4000-a000-000000000004', patient_id: DEMO_PATIENT_ID, name: 'Rohan Jenkins', relationship: 'Son' },
      { id: '00000000-0000-4000-a000-000000000005', patient_id: DEMO_PATIENT_ID, name: 'Priya Jenkins', relationship: 'Daughter' },
    ], { onConflict: 'id', ignoreDuplicates: true });

    /* 2 ── Patient Status ────────────────────────── */
    await supabase.from('patient_status').upsert({
      patient_id: DEMO_PATIENT_ID,
      status: 'GREEN',
      reason: 'All vitals within normal range. Medication adherence good.',
      computed_at: new Date().toISOString(),
    }, { onConflict: 'patient_id' });

    /* 3 ── Medications ───────────────────────────── */
    await supabase.from('medications').upsert([
      { id: MED_1_ID, patient_id: DEMO_PATIENT_ID, name: 'Lisinopril',  dose: '10mg · Once Daily (AM)', schedule_times: ['08:00 AM'] },
      { id: MED_2_ID, patient_id: DEMO_PATIENT_ID, name: 'Donepezil',   dose: '10mg · Once Daily (PM)', schedule_times: ['08:00 PM'] },
      { id: MED_3_ID, patient_id: DEMO_PATIENT_ID, name: 'Memantine',   dose: '10mg · Twice Daily',     schedule_times: ['08:00 AM', '08:00 PM'] },
    ], { onConflict: 'id', ignoreDuplicates: true });

    /* 4 ── Geofence (Pune home area) ────────────── */
    const { data: existingGeo } = await supabase
      .from('geofences').select('id').eq('patient_id', DEMO_PATIENT_ID).eq('is_active', true).maybeSingle();
    if (!existingGeo) {
      await supabase.from('geofences').insert({
        patient_id: DEMO_PATIENT_ID,
        polygon_coordinates: [
          { lat: 18.5234, lng: 73.8547 },
          { lat: 18.5234, lng: 73.8597 },
          { lat: 18.5174, lng: 73.8597 },
          { lat: 18.5174, lng: 73.8547 },
        ],
        is_active: true,
      });
    }

    /* 5 ── Dynamic data: clear + reinsert ───────── */
    await seedDynamicData(log);

    log('Seed complete!');
    toast?.success('Demo data loaded successfully');
    return { success: true };

  } catch (err) {
    console.error('[SATHI Seed] Error:', err);
    toast?.error('Seed error: ' + err.message);
    return { success: false, error: err.message };
  }
}

/* ══════════════════════════════════════
   DYNAMIC DATA (run on every refresh)
══════════════════════════════════════ */
export async function seedDynamicData(log = console.log) {
  const now = new Date();
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const pid = DEMO_PATIENT_ID;

  /* ─ 5a. Vitals (14 readings over 7 days) ─ */
  // Delete last 8 days to avoid duplicates
  await supabase.from('vitals_logs')
    .delete()
    .eq('patient_id', pid)
    .gte('recorded_at', daysAgo(8).toISOString());

  const vitalsRows = [];
  // HR wave values for natural variation
  const hrBase = [78, 82, 75, 80, 77, 83, 79]; // per day (0=today)
  const spo2Base = [97, 97, 96, 97, 97, 96, 97];
  const sleepBase = [6.2, 7.1, 5.8, 6.5, 4.9, 7.4, 6.8];
  const stepsBase = [1240, 1580, 980, 2100, 1320, 1750, 870];

  for (let d = 6; d >= 0; d--) {
    const day = daysAgo(d);
    // Morning reading (08:30)
    vitalsRows.push({
      patient_id: pid,
      heart_rate: hrBase[d] - 4,
      steps: Math.round(stepsBase[d] * 0.3), // 30% by morning
      sleep_hours: sleepBase[d],
      spo2: spo2Base[d],
      data_freshness: 'fresh',
      recorded_at: hhmm(day, 8, 30),
    });
    // Evening reading (20:00)
    vitalsRows.push({
      patient_id: pid,
      heart_rate: hrBase[d],
      steps: stepsBase[d],
      sleep_hours: sleepBase[d],
      spo2: spo2Base[d],
      data_freshness: 'fresh',
      recorded_at: hhmm(day, 20, 0),
    });
  }
  await supabase.from('vitals_logs').insert(vitalsRows);
  log('Vitals seeded:', vitalsRows.length, 'rows');

  /* ─ 5b. Location logs (12 pings, last 6 h) ─ */
  await supabase.from('location_logs')
    .delete()
    .eq('patient_id', pid)
    .gte('timestamp', daysAgo(1).toISOString());

  const baseCoords = { lat: 18.5204, lng: 73.8567 };
  const locationRows = Array.from({ length: 12 }, (_, i) => {
    const t = new Date(now.getTime() - i * 30 * 60 * 1000); // every 30 min
    return {
      patient_id: pid,
      latitude:  baseCoords.lat + Math.sin(i * 0.6) * 0.0014,
      longitude: baseCoords.lng + Math.cos(i * 0.6) * 0.0014,
      gps_source: 'phone',
      breach_status: 'inside',
      timestamp: t.toISOString(),
    };
  });
  await supabase.from('location_logs').insert(locationRows);
  log('Location logs seeded:', locationRows.length, 'rows');

  /* ─ 5c. Medication logs (this week Mon–Sun) ─ */
  const weekStart = startOfWeekMon(today);
  const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);

  await supabase.from('medication_logs')
    .delete()
    .eq('patient_id', pid)
    .gte('scheduled_at', weekStart.toISOString())
    .lt('scheduled_at', weekEnd.toISOString());

  /*
    Compliance pattern (Mon=0…Sun=6):
    Lisinopril AM : ✓ ✓ ✓ ✓ ✓ ✓ ✓  (100% — model med)
    Donepezil PM  : ✓ ✓ ✗ ✗ ✗ ○ ○  (some misses midweek)
    Memantine AM  : ✓ ✓ ✓ ✓ ✓ ○ ○
    Memantine PM  : ✓ ✓ ✓ ✗ ✓ ○ ○
  */
  const medSchedules = [
    {
      id: MED_1_ID,
      slots: [{ hour: 8, compliance: ['c','c','c','c','c','c','c'] }],
    },
    {
      id: MED_2_ID,
      slots: [{ hour: 20, compliance: ['c','c','m','m','m','f','f'] }],
    },
    {
      id: MED_3_ID,
      slots: [
        { hour: 8,  compliance: ['c','c','c','c','c','f','f'] },
        { hour: 20, compliance: ['c','c','c','m','c','f','f'] },
      ],
    },
  ];

  const medLogRows = [];
  for (const med of medSchedules) {
    for (const slot of med.slots) {
      for (let d = 0; d < 7; d++) {
        const day = new Date(weekStart.getTime() + d * 86400000);
        const scheduledAt = new Date(day.getTime() + slot.hour * 3600000);
        const code = slot.compliance[d]; // 'c'=confirmed 'm'=missed 'f'=future/pending

        const isFuture = scheduledAt > now;
        let status = 'pending';
        let confirmedAt = null;

        if (code === 'c' && !isFuture) {
          status = 'confirmed';
          confirmedAt = new Date(scheduledAt.getTime() + 12 * 60000).toISOString();
        } else if (code === 'm' && !isFuture) {
          status = 'missed';
        }
        // 'f' or future: stays pending

        medLogRows.push({
          medication_id: med.id,
          patient_id: pid,
          scheduled_at: scheduledAt.toISOString(),
          confirmed_at: confirmedAt,
          status,
        });
      }
    }
  }
  await supabase.from('medication_logs').insert(medLogRows);
  log('Med logs seeded:', medLogRows.length, 'rows');

  /* ─ 5d. Alert logs ─ */
  await supabase.from('alert_logs')
    .delete()
    .eq('patient_id', pid)
    .gte('created_at', daysAgo(7).toISOString());

  await supabase.from('alert_logs').insert([
    {
      patient_id: pid,
      type: 'low_sleep',
      severity: 'amber',
      message: "Sarah slept only 4.9 hours last night — below the 7-hour target. Sleep quality has declined over the past 3 days.",
      acknowledged: false,
      resolved: false,
      created_at: hhmm(today, 7, 15),
    },
    {
      patient_id: pid,
      type: 'medication_missed',
      severity: 'amber',
      message: "Donepezil evening dose was missed. This is the 3rd consecutive miss — please follow up.",
      acknowledged: true,
      acknowledged_at: hhmm(today, 9, 0),
      resolved: false,
      created_at: hhmm(daysAgo(1), 22, 45),
    },
    {
      patient_id: pid,
      type: 'heart_rate_elevated',
      severity: 'red',
      message: "Heart rate briefly elevated to 102 BPM during the 10:30 PM reading yesterday. Returned to normal within 20 minutes.",
      acknowledged: true,
      resolved: true,
      resolved_at: hhmm(daysAgo(1), 23, 30),
      created_at: hhmm(daysAgo(1), 22, 30),
    },
  ]);
  log('Alert logs seeded');

  /* ─ 5e. Briefing log ─ */
  await supabase.from('briefing_logs')
    .delete()
    .eq('patient_id', pid)
    .gte('delivered_at', hhmm(today, 0, 0));

  await supabase.from('briefing_logs').insert({
    patient_id: pid,
    briefing_text: "Good morning. Sarah's vitals are stable — heart rate 78 BPM, SpO₂ 97%, steps on track. She slept 6.2 hours overnight. Morning Lisinopril confirmed at 8:12 AM. Donepezil has been missed for 3 consecutive evenings — caretaker follow-up recommended. No GPS breaches in the last 12 hours. Anomaly score is low.",
    delivered_at: hhmm(today, 7, 0),
    delivered_to: 'caretaker',
  });
  log('Briefing seeded');

  /* ─ 5f. Interaction logs ─ */
  await supabase.from('interaction_logs')
    .delete()
    .eq('patient_id', pid)
    .gte('timestamp', hhmm(today, 0, 0));

  await supabase.from('interaction_logs').insert([
    { patient_id: pid, interaction_type: 'medication_confirmed', timestamp: hhmm(today, 8, 12) },
    { patient_id: pid, interaction_type: 'app_open',            timestamp: hhmm(today, 9, 5)  },
    { patient_id: pid, interaction_type: 'photo_viewed',        timestamp: hhmm(today, 10, 30)},
    { patient_id: pid, interaction_type: 'sos_test',            timestamp: hhmm(today, 11, 0) },
  ]);
  log('Interaction logs seeded');

  /* ─ 5g. Patient baseline ─ */
  await supabase.from('patient_baselines').upsert({
    patient_id: pid,
    steps_mean: 1420, steps_std: 380,
    hr_mean: 79, hr_std: 6,
    sleep_mean: 6.4, sleep_std: 0.8,
    adherence_mean: 0.82, adherence_std: 0.12,
    response_mean: 1.8, response_std: 0.5,
    computed_at: new Date().toISOString(),
  }, { onConflict: 'patient_id' });

  log('Dynamic seed complete.');
}
