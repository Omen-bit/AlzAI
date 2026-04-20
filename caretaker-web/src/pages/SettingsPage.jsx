import React, { useState, useEffect, useCallback } from 'react';
import { User, Phone, Mail, AlertTriangle, Plus, Trash2, Camera, Calendar, CheckCircle2, ShieldAlert } from 'lucide-react';
import { toast } from 'react-hot-toast';
import axios from 'axios';

import { supabase } from '../lib/supabase';
import api from '../lib/api';
import { usePatient } from '../contexts/PatientContext';
import { formatDate, formatTime } from '../utils/timeFormat';
import { Card, CardHeader, CardTitle, Badge, Button, PageHeader, Separator, Skeleton, EmptyCard, Input } from '../components/ui.jsx';

const RELATIONSHIPS = ['Son','Daughter','Spouse','Sibling','Parent','Other'];

export default function SettingsPage() {
  const { patientId, caretakerId } = usePatient();
  const [caretaker,     setCaretaker]     = useState(null);
  const [sosContacts,   setSosContacts]   = useState([]);
  const [members,       setMembers]       = useState([]);
  const [slots,         setSlots]         = useState([]);
  const [appointments,  setAppointments]  = useState([]);
  const [loading,       setLoading]       = useState(true);

  const [newSos,    setNewSos]    = useState({ name:'', phone:'', relationship:'' });
  const [newMember, setNewMember] = useState({ name:'', relationship:'Son', file:null, preview:null });
  const [uploading, setUploading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!patientId) return;
    const [{ data:ct }, { data:sos }, { data:fm }, { data:sl }, { data:ap }] = await Promise.all([
      supabase.from('caretakers').select('*').eq('patient_id', patientId).single(),
      supabase.from('sos_contacts').select('*').eq('patient_id', patientId).order('priority_order'),
      supabase.from('family_members').select('*').eq('patient_id', patientId),
      supabase.from('doctor_availability').select('*, doctors(name)').eq('status','available').gte('slot_date', new Date().toISOString().split('T')[0]).order('slot_date'),
      supabase.from('appointments').select('*, doctors(name)').eq('patient_id', patientId).gte('slot_date', new Date().toISOString().split('T')[0]).order('slot_date'),
    ]);
    setCaretaker(ct); setSosContacts(sos||[]); setMembers(fm||[]); setSlots(sl||[]); setAppointments(ap||[]);
    setLoading(false);
  }, [patientId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAddSos = () => {
    if (!newSos.name || !newSos.phone) return toast.error('Name and phone required');
    setSosContacts(p => [...p, { ...newSos, priority_order: p.length+1, id:'tmp-'+Date.now() }]);
    setNewSos({ name:'', phone:'', relationship:'' });
  };

  const saveSos = async () => {
    try {
      await api.post('/sos/contacts', { patient_id:patientId, contacts: sosContacts.map((c,i)=>({name:c.name,phone:c.phone,priority_order:i+1})) });
      toast.success('Escalation chain saved ✓');
    } catch { toast.error('Failed to save'); }
  };

  const handleFace = (e) => {
    const f = e.target.files[0];
    if (f) setNewMember(v=>({...v, file:f, preview:URL.createObjectURL(f)}));
  };

  const registerMember = async () => {
    if (!newMember.name || !newMember.file) return toast.error('Name and photo required');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', newMember.file);
      fd.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
      const r = await axios.post(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`, fd);
      await api.post('/face/register', { face_image_url:r.data.secure_url, name:newMember.name, relationship:newMember.relationship, patient_id:patientId });
      toast.success(`${newMember.name} registered ✓`);
      setNewMember({ name:'', relationship:'Son', file:null, preview:null });
      fetchData();
    } catch { toast.error('Registration failed'); }
    finally { setUploading(false); }
  };

  const bookSlot = async (slot) => {
    if (!window.confirm(`Book ${formatDate(slot.slot_date)} at ${formatTime(slot.slot_time)} with ${slot.doctors?.name}?`)) return;
    try {
      await api.post('/appointment/book', { patient_id:patientId, doctor_id:slot.doctor_id, slot_id:slot.id, caretaker_id:caretakerId });
      toast.success('Appointment booked ✓'); fetchData();
    } catch { toast.error('Booking failed'); }
  };

  if (loading) return (
    <div className="max-w-3xl mx-auto space-y-4">
      {[1,2,3].map(i => <Skeleton key={i} className="h-40 rounded-2xl" />)}
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader title="Settings" description="Manage profile, emergency contacts, and appointments." />

      {/* ── CARETAKER PROFILE ── */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Caretaker Profile</CardTitle>
            <p className="text-xs text-slate-400 mt-0.5">Your account information</p>
          </div>
          <Button size="sm" variant="ghost">Edit</Button>
        </CardHeader>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center font-bold text-lg flex-shrink-0">
            {caretaker?.name?.[0] || 'C'}
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 flex-1">
            <Field label="Name"         value={caretaker?.name || '—'} />
            <Field label="Phone"        value={caretaker?.phone || '—'} />
            <Field label="Relationship" value={caretaker?.role || 'Caretaker'} />
            <Field label="Email"        value={caretaker?.email || '—'} />
          </div>
        </div>
      </Card>

      {/* ── SOS CHAIN ── */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>SOS Escalation Chain</CardTitle>
            <p className="text-xs text-slate-400 mt-0.5">Contacts notified during emergencies in priority order</p>
          </div>
        </CardHeader>

        <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl mb-5 text-sm text-amber-700">
          <ShieldAlert size={16} className="flex-shrink-0 mt-0.5 text-amber-500" />
          <p className="text-xs leading-relaxed">Priority 1 receives an automated phone call. All others get WhatsApp + push notifications simultaneously.</p>
        </div>

        <div className="space-y-2 mb-4">
          {sosContacts.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-4">No contacts added yet.</p>
          )}
          {sosContacts.map((c, idx) => (
            <div key={c.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/50 group transition-all">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${idx===0 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>P{idx+1}</div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{c.name}</p>
                  <p className="text-xs text-slate-400">{c.phone} · {c.relationship || 'Emergency'}</p>
                </div>
              </div>
              <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100" onClick={() => setSosContacts(p=>p.filter(x=>x.id!==c.id).map((x,i)=>({...x,priority_order:i+1})))}>
                <Trash2 size={13} />
              </Button>
            </div>
          ))}
        </div>

        <Separator className="mb-4" />

        <div className="grid grid-cols-3 gap-2 mb-4">
          <Input placeholder="Name" value={newSos.name} onChange={e=>setNewSos(v=>({...v,name:e.target.value}))} />
          <Input placeholder="Phone" value={newSos.phone} onChange={e=>setNewSos(v=>({...v,phone:e.target.value}))} />
          <Input placeholder="Relationship" value={newSos.relationship} onChange={e=>setNewSos(v=>({...v,relationship:e.target.value}))} />
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleAddSos}><Plus size={13} /> Add Contact</Button>
          <Button variant="primary" size="sm" onClick={saveSos} className="ml-auto">Save Chain</Button>
        </div>
      </Card>

      {/* ── FAMILY MEMBERS ── */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Family Members</CardTitle>
            <p className="text-xs text-slate-400 mt-0.5">Registered for face recognition</p>
          </div>
          <Badge variant="default">{members.length} registered</Badge>
        </CardHeader>

        {members.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-5">
            {members.map(m => (
              <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                {m.face_image_url
                  ? <img src={m.face_image_url} className="w-10 h-10 rounded-lg object-cover" alt={m.name} />
                  : <div className="w-10 h-10 bg-slate-200 rounded-lg flex items-center justify-center text-slate-400"><User size={16} /></div>
                }
                <div>
                  <p className="text-sm font-semibold text-slate-900">{m.name}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                    <span className="text-[10px] text-emerald-600 font-medium">{m.relationship}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <Separator className="mb-5" />
        <p className="text-xs font-semibold text-slate-700 mb-3">Register new face</p>
        <div className="flex gap-4">
          <div
            onClick={() => document.getElementById('face-upload').click()}
            className="w-20 h-20 rounded-xl border-2 border-dashed border-blue-200 flex flex-col items-center justify-center bg-blue-50/30 cursor-pointer hover:border-blue-400 transition-colors flex-shrink-0 overflow-hidden"
          >
            {newMember.preview
              ? <img src={newMember.preview} className="w-full h-full object-cover" alt="" />
              : <><Camera size={18} className="text-blue-400" /><span className="text-[9px] text-blue-400 mt-1">Upload</span></>
            }
          </div>
          <input id="face-upload" type="file" className="hidden" accept="image/*" onChange={handleFace} />
          <div className="flex-1 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Full name" value={newMember.name} onChange={e=>setNewMember(v=>({...v,name:e.target.value}))} />
              <select className="px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-400" value={newMember.relationship} onChange={e=>setNewMember(v=>({...v,relationship:e.target.value}))}>
                {RELATIONSHIPS.map(r=><option key={r}>{r}</option>)}
              </select>
            </div>
            <Button variant="primary" size="sm" onClick={registerMember} disabled={uploading}>
              {uploading ? 'Registering…' : 'Register Member'}
            </Button>
          </div>
        </div>
      </Card>

      {/* ── APPOINTMENTS ── */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Medical Appointments</CardTitle>
            <p className="text-xs text-slate-400 mt-0.5">Book and manage doctor slots</p>
          </div>
        </CardHeader>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 mb-3"><Calendar size={12} /> Available Slots</p>
            <div className="space-y-2">
              {slots.length === 0 && <p className="text-xs text-slate-400">No slots available.</p>}
              {slots.map(slot => (
                <div key={slot.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all group">
                  <div>
                    <p className="text-xs font-semibold text-blue-600">{formatDate(slot.slot_date)}</p>
                    <p className="text-sm font-semibold text-slate-900">{formatTime(slot.slot_time)}</p>
                    <p className="text-xs text-slate-400">{slot.doctors?.name}</p>
                  </div>
                  <Button size="sm" variant="secondary" className="opacity-0 group-hover:opacity-100" onClick={() => bookSlot(slot)}>
                    <Plus size={13} /> Book
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 mb-3"><CheckCircle2 size={12} className="text-emerald-500" /> Your Appointments</p>
            <div className="space-y-2">
              {appointments.length === 0 && <p className="text-xs text-slate-400">No upcoming appointments.</p>}
              {appointments.map(appt => (
                <div key={appt.id} className="p-3 rounded-xl border-l-2 border-emerald-500 bg-emerald-50/30 border border-l-emerald-500 border-b-slate-100 border-r-slate-100 border-t-slate-100">
                  <p className="text-xs text-emerald-600 font-semibold">{formatDate(appt.slot_date)}</p>
                  <p className="text-sm font-semibold text-slate-900 mt-0.5">{appt.doctors?.name}</p>
                  <p className="text-xs text-slate-400">{formatTime(appt.slot_time)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

const Field = ({ label, value }) => (
  <div>
    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{label}</p>
    <p className="text-sm font-semibold text-slate-900 mt-0.5">{value}</p>
  </div>
);
