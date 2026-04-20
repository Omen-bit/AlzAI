-- ═══════════════════════════════════════════════════════════════
-- SATHI Demo Seed — Run this ONCE in the Supabase SQL Editor
-- Patient ID : 00000000-0000-4000-a000-000000000001
-- ═══════════════════════════════════════════════════════════════

-- Ensure vitals_logs streams real-time changes
ALTER PUBLICATION supabase_realtime ADD TABLE vitals_logs;

-- ── 1. Doctor ──────────────────────────────────────────────────
INSERT INTO doctors (id, name, email, nmc_number, nmc_verified, status)
VALUES (
  '00000000-0000-4000-a000-000000000002',
  'Dr. Rajesh Sharma',
  'dr.sharma@sathi.health',
  'NMC-2024-001',
  true,
  'active'
) ON CONFLICT (id) DO NOTHING;

-- ── 2. Patient ─────────────────────────────────────────────────
INSERT INTO patients (id, doctor_id, name, age, language, stage, patient_key, status)
VALUES (
  '00000000-0000-4000-a000-000000000001',
  '00000000-0000-4000-a000-000000000002',
  'Sarah Jenkins',
  72,
  'en-IN',
  'moderate',
  'SATHI-DEMO-001',
  'active'
) ON CONFLICT (id) DO NOTHING;

-- ── 3. Caretaker ───────────────────────────────────────────────
INSERT INTO caretakers (id, patient_id, name, phone, email, role, status)
VALUES (
  '00000000-0000-4000-a000-000000000003',
  '00000000-0000-4000-a000-000000000001',
  'Aisha Patel',
  '+91-9876543210',
  'aisha.patel@sathi.health',
  'primary',
  'active'
) ON CONFLICT (id) DO NOTHING;

-- ── 4. Family Members ──────────────────────────────────────────
INSERT INTO family_members (id, patient_id, name, relationship)
VALUES
  ('00000000-0000-4000-a000-000000000004', '00000000-0000-4000-a000-000000000001', 'Rohan Jenkins', 'Son'),
  ('00000000-0000-4000-a000-000000000005', '00000000-0000-4000-a000-000000000001', 'Priya Jenkins', 'Daughter')
ON CONFLICT (id) DO NOTHING;

-- ── 5. Patient Status ──────────────────────────────────────────
INSERT INTO patient_status (patient_id, status, reason, computed_at)
VALUES (
  '00000000-0000-4000-a000-000000000001',
  'GREEN',
  'All vitals within normal range. Medication adherence good.',
  NOW()
) ON CONFLICT (patient_id) DO UPDATE
  SET status = EXCLUDED.status,
      reason = EXCLUDED.reason,
      computed_at = EXCLUDED.computed_at;

-- ── 6. Medications ─────────────────────────────────────────────
INSERT INTO medications (id, patient_id, name, dose, schedule_times)
VALUES
  ('00000000-0000-4000-a000-000000000011', '00000000-0000-4000-a000-000000000001',
   'Lisinopril',  '10mg · Once Daily (AM)',  ARRAY['08:00 AM']),
  ('00000000-0000-4000-a000-000000000012', '00000000-0000-4000-a000-000000000001',
   'Donepezil',   '10mg · Once Daily (PM)',  ARRAY['08:00 PM']),
  ('00000000-0000-4000-a000-000000000013', '00000000-0000-4000-a000-000000000001',
   'Memantine',   '10mg · Twice Daily',      ARRAY['08:00 AM', '08:00 PM'])
ON CONFLICT (id) DO NOTHING;

-- ── 7. Geofence (home area around Pune 18.5204, 73.8567) ───────
INSERT INTO geofences (patient_id, polygon_coordinates, is_active)
SELECT
  '00000000-0000-4000-a000-000000000001',
  '[
    {"lat": 18.5234, "lng": 73.8547},
    {"lat": 18.5234, "lng": 73.8597},
    {"lat": 18.5174, "lng": 73.8597},
    {"lat": 18.5174, "lng": 73.8547}
  ]'::jsonb,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM geofences
  WHERE patient_id = '00000000-0000-4000-a000-000000000001'
    AND is_active = true
);

-- ── 8. Patient Baseline ────────────────────────────────────────
INSERT INTO patient_baselines (
  patient_id, steps_mean, steps_std, hr_mean, hr_std,
  sleep_mean, sleep_std, adherence_mean, adherence_std,
  response_mean, response_std
) VALUES (
  '00000000-0000-4000-a000-000000000001',
  1420, 380, 79, 6, 6.4, 0.8, 0.82, 0.12, 1.8, 0.5
) ON CONFLICT (patient_id) DO NOTHING;

-- ── 9. Vitals Logs (last 7 days, 2 readings/day) ───────────────
DELETE FROM vitals_logs
WHERE patient_id = '00000000-0000-4000-a000-000000000001'
  AND recorded_at >= NOW() - INTERVAL '8 days';

INSERT INTO vitals_logs (patient_id, heart_rate, steps, sleep_hours, spo2, data_freshness, recorded_at)
VALUES
  -- 6 days ago
  ('00000000-0000-4000-a000-000000000001', 74, 370,  6.8, 97, 'fresh', NOW() - INTERVAL '6 days 15.5 hours'),
  ('00000000-0000-4000-a000-000000000001', 79, 1580, 6.8, 97, 'fresh', NOW() - INTERVAL '6 days 4 hours'),
  -- 5 days ago
  ('00000000-0000-4000-a000-000000000001', 70, 295,  7.1, 97, 'fresh', NOW() - INTERVAL '5 days 15.5 hours'),
  ('00000000-0000-4000-a000-000000000001', 76, 980,  7.1, 97, 'fresh', NOW() - INTERVAL '5 days 4 hours'),
  -- 4 days ago
  ('00000000-0000-4000-a000-000000000001', 73, 630,  5.8, 96, 'fresh', NOW() - INTERVAL '4 days 15.5 hours'),
  ('00000000-0000-4000-a000-000000000001', 78, 2100, 5.8, 96, 'fresh', NOW() - INTERVAL '4 days 4 hours'),
  -- 3 days ago
  ('00000000-0000-4000-a000-000000000001', 71, 396,  6.5, 97, 'fresh', NOW() - INTERVAL '3 days 15.5 hours'),
  ('00000000-0000-4000-a000-000000000001', 80, 1320, 6.5, 97, 'fresh', NOW() - INTERVAL '3 days 4 hours'),
  -- 2 days ago
  ('00000000-0000-4000-a000-000000000001', 69, 261,  4.9, 96, 'fresh', NOW() - INTERVAL '2 days 15.5 hours'),
  ('00000000-0000-4000-a000-000000000001', 75, 870,  4.9, 96, 'fresh', NOW() - INTERVAL '2 days 4 hours'),
  -- Yesterday
  ('00000000-0000-4000-a000-000000000001', 72, 525,  7.4, 97, 'fresh', NOW() - INTERVAL '1 day 15.5 hours'),
  ('00000000-0000-4000-a000-000000000001', 83, 1750, 7.4, 97, 'fresh', NOW() - INTERVAL '1 day 4 hours'),
  -- Today
  ('00000000-0000-4000-a000-000000000001', 74, 372,  6.2, 97, 'fresh', NOW() - INTERVAL '11.5 hours'),
  ('00000000-0000-4000-a000-000000000001', 78, 1240, 6.2, 97, 'fresh', NOW() - INTERVAL '4 hours');

-- ── 10. Location Logs (last 6 hours, every 30 min) ─────────────
DELETE FROM location_logs
WHERE patient_id = '00000000-0000-4000-a000-000000000001'
  AND timestamp >= NOW() - INTERVAL '7 hours';

INSERT INTO location_logs (patient_id, latitude, longitude, gps_source, breach_status, timestamp)
VALUES
  ('00000000-0000-4000-a000-000000000001', 18.52040, 73.85670, 'phone', 'inside', NOW() - INTERVAL  '0 minutes'),
  ('00000000-0000-4000-a000-000000000001', 18.52052, 73.85658, 'phone', 'inside', NOW() - INTERVAL '30 minutes'),
  ('00000000-0000-4000-a000-000000000001', 18.52063, 73.85672, 'phone', 'inside', NOW() - INTERVAL '60 minutes'),
  ('00000000-0000-4000-a000-000000000001', 18.52071, 73.85680, 'phone', 'inside', NOW() - INTERVAL '90 minutes'),
  ('00000000-0000-4000-a000-000000000001', 18.52058, 73.85668, 'phone', 'inside', NOW() - INTERVAL '120 minutes'),
  ('00000000-0000-4000-a000-000000000001', 18.52045, 73.85655, 'phone', 'inside', NOW() - INTERVAL '150 minutes'),
  ('00000000-0000-4000-a000-000000000001', 18.52033, 73.85648, 'phone', 'inside', NOW() - INTERVAL '180 minutes'),
  ('00000000-0000-4000-a000-000000000001', 18.52025, 73.85660, 'phone', 'inside', NOW() - INTERVAL '210 minutes'),
  ('00000000-0000-4000-a000-000000000001', 18.52038, 73.85675, 'phone', 'inside', NOW() - INTERVAL '240 minutes'),
  ('00000000-0000-4000-a000-000000000001', 18.52050, 73.85683, 'phone', 'inside', NOW() - INTERVAL '270 minutes'),
  ('00000000-0000-4000-a000-000000000001', 18.52044, 73.85672, 'phone', 'inside', NOW() - INTERVAL '300 minutes'),
  ('00000000-0000-4000-a000-000000000001', 18.52037, 73.85662, 'phone', 'inside', NOW() - INTERVAL '330 minutes');

-- ── 11. Medication Logs (current week Mon–Sun) ─────────────────
-- Current week start (Monday)
DO $$
DECLARE
  pid  UUID := '00000000-0000-4000-a000-000000000001';
  mid1 UUID := '00000000-0000-4000-a000-000000000011';  -- Lisinopril   AM
  mid2 UUID := '00000000-0000-4000-a000-000000000012';  -- Donepezil    PM
  mid3 UUID := '00000000-0000-4000-a000-000000000013';  -- Memantine AM+PM
  week_start DATE;
  d DATE;
  sched TIMESTAMPTZ;
BEGIN
  -- Monday of current week
  week_start := DATE_TRUNC('week', CURRENT_DATE);

  -- Clear this week's logs
  DELETE FROM medication_logs
  WHERE patient_id = pid
    AND scheduled_at >= week_start::TIMESTAMPTZ
    AND scheduled_at <  (week_start + INTERVAL '7 days')::TIMESTAMPTZ;

  FOR i IN 0..6 LOOP
    d := week_start + (i * INTERVAL '1 day');

    -- Lisinopril 08:00 AM — 100% compliance for past days, confirmed today AM
    sched := d + TIME '08:00:00';
    IF sched <= NOW() THEN
      INSERT INTO medication_logs (medication_id, patient_id, scheduled_at, confirmed_at, status)
      VALUES (mid1, pid, sched, sched + INTERVAL '12 minutes', 'confirmed');
    ELSE
      INSERT INTO medication_logs (medication_id, patient_id, scheduled_at, status)
      VALUES (mid1, pid, sched, 'pending');
    END IF;

    -- Donepezil 08:00 PM — missed Wed(2), Thu(3), Fri(4); confirmed Mon, Tue; pending rest
    sched := d + TIME '20:00:00';
    IF sched > NOW() THEN
      INSERT INTO medication_logs (medication_id, patient_id, scheduled_at, status)
      VALUES (mid2, pid, sched, 'pending');
    ELSIF i IN (2, 3, 4) THEN
      INSERT INTO medication_logs (medication_id, patient_id, scheduled_at, status)
      VALUES (mid2, pid, sched, 'missed');
    ELSE
      INSERT INTO medication_logs (medication_id, patient_id, scheduled_at, confirmed_at, status)
      VALUES (mid2, pid, sched, sched + INTERVAL '18 minutes', 'confirmed');
    END IF;

    -- Memantine 08:00 AM — confirmed all past, pending future
    sched := d + TIME '08:00:00';
    IF sched <= NOW() THEN
      INSERT INTO medication_logs (medication_id, patient_id, scheduled_at, confirmed_at, status)
      VALUES (mid3, pid, sched, sched + INTERVAL '10 minutes', 'confirmed');
    ELSE
      INSERT INTO medication_logs (medication_id, patient_id, scheduled_at, status)
      VALUES (mid3, pid, sched, 'pending');
    END IF;

    -- Memantine 08:00 PM — missed Fri(4), confirmed rest past, pending future
    sched := d + TIME '20:00:00';
    IF sched > NOW() THEN
      INSERT INTO medication_logs (medication_id, patient_id, scheduled_at, status)
      VALUES (mid3, pid, sched, 'pending');
    ELSIF i = 4 THEN
      INSERT INTO medication_logs (medication_id, patient_id, scheduled_at, status)
      VALUES (mid3, pid, sched, 'missed');
    ELSE
      INSERT INTO medication_logs (medication_id, patient_id, scheduled_at, confirmed_at, status)
      VALUES (mid3, pid, sched, sched + INTERVAL '9 minutes', 'confirmed');
    END IF;
  END LOOP;
END $$;

-- ── 12. Alert Logs ─────────────────────────────────────────────
DELETE FROM alert_logs
WHERE patient_id = '00000000-0000-4000-a000-000000000001'
  AND created_at >= NOW() - INTERVAL '7 days';

INSERT INTO alert_logs (patient_id, type, severity, message, acknowledged, resolved, created_at)
VALUES
  (
    '00000000-0000-4000-a000-000000000001',
    'low_sleep',
    'amber',
    'Sarah slept only 4.9 hours last night — below the 7-hour target. Sleep quality has been declining over the past 3 days.',
    false,
    false,
    NOW() - INTERVAL '4 hours'
  ),
  (
    '00000000-0000-4000-a000-000000000001',
    'medication_missed',
    'amber',
    'Donepezil evening dose has been missed for 3 consecutive nights. Please follow up with patient.',
    true,
    false,
    NOW() - INTERVAL '14 hours'
  ),
  (
    '00000000-0000-4000-a000-000000000001',
    'heart_rate_elevated',
    'red',
    'Heart rate briefly elevated to 102 BPM at 10:30 PM yesterday. Returned to normal within 20 minutes.',
    true,
    true,
    NOW() - INTERVAL '36 hours'
  );

-- ── 13. Briefing Log ───────────────────────────────────────────
DELETE FROM briefing_logs
WHERE patient_id = '00000000-0000-4000-a000-000000000001'
  AND delivered_at >= CURRENT_DATE::TIMESTAMPTZ;

INSERT INTO briefing_logs (patient_id, briefing_text, delivered_at, delivered_to)
VALUES (
  '00000000-0000-4000-a000-000000000001',
  'Good morning. Sarah''s vitals are stable — heart rate 78 BPM, SpO₂ 97%, steps on track at 1,240. She slept 6.2 hours overnight. Morning Lisinopril confirmed at 8:12 AM. Donepezil has been missed for 3 consecutive evenings — caretaker follow-up recommended. No GPS breaches in the last 12 hours. Anomaly score is low. Overall status: GREEN.',
  CURRENT_DATE + TIME '07:00:00',
  'caretaker'
);

-- ── 14. Interaction Logs ───────────────────────────────────────
DELETE FROM interaction_logs
WHERE patient_id = '00000000-0000-4000-a000-000000000001'
  AND timestamp >= CURRENT_DATE::TIMESTAMPTZ;

INSERT INTO interaction_logs (patient_id, interaction_type, timestamp)
VALUES
  ('00000000-0000-4000-a000-000000000001', 'medication_confirmed', CURRENT_DATE + TIME '08:12:00'),
  ('00000000-0000-4000-a000-000000000001', 'app_open',             CURRENT_DATE + TIME '09:05:00'),
  ('00000000-0000-4000-a000-000000000001', 'photo_viewed',         CURRENT_DATE + TIME '10:30:00'),
  ('00000000-0000-4000-a000-000000000001', 'sos_test',             CURRENT_DATE + TIME '11:00:00');

-- ── Done ──────────────────────────────────────────────────────
SELECT 'SATHI demo seed complete!' AS result,
       COUNT(*) AS vitals_count
FROM vitals_logs
WHERE patient_id = '00000000-0000-4000-a000-000000000001';
