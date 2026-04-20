-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- NMC Registry (dummy for hackathon)
CREATE TABLE nmc_registry (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nmc_number TEXT UNIQUE NOT NULL,
  doctor_name TEXT NOT NULL,
  specialization TEXT,
  is_valid BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Doctors
CREATE TABLE doctors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  nmc_number TEXT REFERENCES nmc_registry(nmc_number),
  nmc_verified BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Patients
CREATE TABLE patients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doctor_id UUID REFERENCES doctors(id),
  name TEXT NOT NULL,
  age INTEGER,
  language TEXT DEFAULT 'mr-IN',
  stage TEXT DEFAULT 'early',
  patient_key TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'dormant',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Caretakers
CREATE TABLE caretakers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  role TEXT DEFAULT 'primary',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Family Members
CREATE TABLE family_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id),
  name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  azure_person_id TEXT,
  face_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Photos
CREATE TABLE photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id),
  family_member_id UUID REFERENCES family_members(id),
  image_url TEXT NOT NULL,
  labeled_image_url TEXT,
  audio_url TEXT,
  message TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  viewed_at TIMESTAMPTZ
);

-- Photo Tags
CREATE TABLE photo_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  photo_id UUID REFERENCES photos(id),
  family_member_id UUID REFERENCES family_members(id),
  confidence_score FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Medications
CREATE TABLE medications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id),
  name TEXT NOT NULL,
  dose TEXT NOT NULL,
  schedule_times TEXT[] NOT NULL,
  tablet_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Medication Logs
CREATE TABLE medication_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  medication_id UUID REFERENCES medications(id),
  patient_id UUID REFERENCES patients(id),
  scheduled_at TIMESTAMPTZ NOT NULL,
  confirmed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SOS Contacts
CREATE TABLE sos_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  priority_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SOS Logs
CREATE TABLE sos_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id),
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  contacts_notified TEXT[],
  resolved_at TIMESTAMPTZ
);

-- Geofences
CREATE TABLE geofences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id),
  polygon_coordinates JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Location Logs
CREATE TABLE location_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id),
  latitude FLOAT NOT NULL,
  longitude FLOAT NOT NULL,
  gps_source TEXT DEFAULT 'phone',
  breach_status TEXT DEFAULT 'inside',
  breached_at TIMESTAMPTZ,
  returned_at TIMESTAMPTZ,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Vitals Logs
CREATE TABLE vitals_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id),
  heart_rate FLOAT,
  steps INTEGER,
  sleep_hours FLOAT,
  spo2 FLOAT,
  data_freshness TEXT,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fall Logs
CREATE TABLE fall_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id),
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  magnitude_peak FLOAT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES caretakers(id)
);

-- Alert Logs
CREATE TABLE alert_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id),
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  message TEXT NOT NULL,
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID REFERENCES caretakers(id),
  acknowledged_at TIMESTAMPTZ,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Escalation Logs
CREATE TABLE escalation_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_id UUID REFERENCES alert_logs(id),
  notified_contact UUID REFERENCES caretakers(id),
  notified_at TIMESTAMPTZ DEFAULT NOW()
);

-- Patient Status
CREATE TABLE patient_status (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) UNIQUE,
  status TEXT DEFAULT 'GREEN',
  reason TEXT,
  computed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Interaction Logs
CREATE TABLE interaction_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id),
  interaction_type TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Appointments
CREATE TABLE appointments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id),
  doctor_id UUID REFERENCES doctors(id),
  caretaker_id UUID REFERENCES caretakers(id),
  slot_date DATE NOT NULL,
  slot_time TIME NOT NULL,
  status TEXT DEFAULT 'confirmed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Doctor Availability
CREATE TABLE doctor_availability (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doctor_id UUID REFERENCES doctors(id),
  slot_date DATE NOT NULL,
  slot_time TIME NOT NULL,
  status TEXT DEFAULT 'available',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Anomaly Logs
CREATE TABLE anomaly_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id),
  anomaly_score FLOAT NOT NULL,
  anomalous_metrics TEXT[],
  multi_metric_decline BOOLEAN DEFAULT false,
  computed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Patient Baselines
CREATE TABLE patient_baselines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) UNIQUE,
  steps_mean FLOAT, steps_std FLOAT,
  hr_mean FLOAT, hr_std FLOAT,
  sleep_mean FLOAT, sleep_std FLOAT,
  adherence_mean FLOAT, adherence_std FLOAT,
  response_mean FLOAT, response_std FLOAT,
  computed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Briefing Logs
CREATE TABLE briefing_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id),
  briefing_text TEXT NOT NULL,
  delivered_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_to TEXT NOT NULL
);

-- Reports
CREATE TABLE reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id),
  doctor_id UUID REFERENCES doctors(id),
  pdf_url TEXT NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  generated_by UUID REFERENCES caretakers(id)
);

-- Enable Realtime on critical tables
ALTER PUBLICATION supabase_realtime
ADD TABLE photos,
         medication_logs,
         alert_logs,
         patient_status,
         location_logs,
         fall_logs,
         sos_logs,
         appointments;

-- Insert dummy NMC data for hackathon
INSERT INTO nmc_registry (nmc_number, doctor_name, specialization, is_valid)
VALUES
  ('NMC-2024-001', 'Dr. Rajesh Sharma', 'Neurology', true),
  ('NMC-2024-002', 'Dr. Priya Mehta', 'Geriatrics', true),
  ('NMC-2024-003', 'Dr. Anil Kulkarni', 'Neurology', true);
