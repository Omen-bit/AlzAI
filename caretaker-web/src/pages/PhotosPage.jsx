import React, { useState, useEffect, useCallback } from 'react';
import { Camera, Send, Image as ImageIcon, Upload, X, CheckCircle2, Clock, Loader2, ChevronDown, Languages } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

import { supabase } from '../lib/supabase';
import api from '../lib/api';
import { usePatient } from '../contexts/PatientContext';
import { formatTimeAgo } from '../utils/timeFormat';
import { Card, Button, Badge, PageHeader, Separator, Skeleton, EmptyCard, Input } from '../components/ui.jsx';

const LANGUAGES = ['Marathi', 'Hindi', 'English'];

export default function PhotosPage() {
  const { patientId, patient } = usePatient();
  const [members, setMembers]   = useState([]);
  const [history, setHistory]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [progress, setProgress] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [form, setForm] = useState({ message:'', member_id:'', language:'English', file:null, preview:null });
  const [errors, setErrors] = useState({});

  const fetchData = useCallback(async () => {
    if (!patientId) return;
    const { data: m } = await supabase.from('family_members').select('id, name, relationship').eq('patient_id', patientId);
    if (m) setMembers(m);
    const { data: p } = await supabase.from('photos').select('*, sender:family_members(name,relationship)').eq('patient_id',patientId).order('sent_at',{ascending:false}).limit(20);
    if (p) setHistory(p);
  }, [patientId]);

  useEffect(() => {
    fetchData();
    if (!patientId) return;
    const ch = supabase.channel('photos')
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'photos',filter:`patient_id=eq.${patientId}`},(p) => {
        setHistory(prev=>prev.map(x=>x.id===p.new.id?{...x,viewed_at:p.new.viewed_at}:x));
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [patientId, fetchData]);

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (f && ['image/jpeg','image/png','image/webp'].includes(f.type)) {
      setForm(v=>({...v, file:f, preview:URL.createObjectURL(f)}));
      setErrors(v=>({...v, file:null}));
    } else toast.error('Please select a JPG, PNG or WebP image');
  };

  const validate = () => {
    const e = {};
    if (!form.file) e.file = 'Please select a photo';
    if (!form.member_id) e.member = 'Please select a family member';
    if (!form.message.trim()) e.message = 'Please add a message';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSend = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true); setProgress(0);
    try {
      const fd = new FormData();
      fd.append('file', form.file);
      fd.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
      const r = await axios.post(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`, fd, {
        onUploadProgress: p => setProgress(Math.round(p.loaded*100/p.total))
      });
      setProcessing(true);
      await api.post('/photos/send', { image_url:r.data.secure_url, message:form.message, language:form.language, family_member_id:form.member_id, patient_id:patientId });
      toast.success(`Photo sent to ${patient?.name || 'Patient'} ✓`);
      setForm({ message:'', member_id:'', language:'English', file:null, preview:null });
      fetchData();
    } catch { toast.error('Failed to send — check connection'); }
    finally { setLoading(false); setProcessing(false); setProgress(0); }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader title="Send Message" description="Photos you send appear on the patient's device with voice narration." />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* ── SEND FORM ── */}
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Compose Message</h3>

            {/* Image dropzone */}
            <div
              onClick={() => document.getElementById('photo-upload').click()}
              className={`relative w-full rounded-xl border-2 border-dashed cursor-pointer transition-all overflow-hidden ${
                form.preview ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 bg-slate-50'
              } ${errors.file ? 'border-red-300' : ''}`}
              style={{ height: 180 }}
            >
              {form.preview ? (
                <div className="relative h-full">
                  <img src={form.preview} alt="Preview" className="w-full h-full object-contain p-2" />
                  <button
                    onClick={(e) => { e.stopPropagation(); setForm(v=>({...v,file:null,preview:null})); }}
                    className="absolute top-2 right-2 w-7 h-7 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70"
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400">
                  <Upload size={24} />
                  <p className="text-xs font-medium">Click to upload a photo</p>
                  <p className="text-[11px] text-slate-300">JPG, PNG, WebP · max 10MB</p>
                </div>
              )}
            </div>
            <input id="photo-upload" type="file" className="hidden" accept="image/*" onChange={handleFile} />
            {errors.file && <p className="text-xs text-red-500 mt-1">{errors.file}</p>}

            {/* Selectors row */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">Sending as</label>
                <div className="relative">
                  <select
                    className={`w-full px-3 py-2 text-sm border rounded-xl appearance-none bg-white outline-none transition-all ${errors.member ? 'border-red-300' : 'border-slate-200 focus:border-blue-400'}`}
                    value={form.member_id}
                    onChange={e => setForm(v=>({...v,member_id:e.target.value}))}
                  >
                    <option value="">Select member…</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.name} ({m.relationship})</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
                {errors.member && <p className="text-xs text-red-500 mt-1">{errors.member}</p>}
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">Language</label>
                <div className="flex gap-1.5">
                  {LANGUAGES.map(l => (
                    <button key={l} onClick={() => setForm(v=>({...v,language:l}))}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${form.language===l ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >{l}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Message */}
            <div className="mt-4">
              <label className="text-xs font-medium text-slate-500 mb-1.5 block">Voice message</label>
              <div className="relative">
                <textarea
                  rows={3}
                  maxLength={200}
                  placeholder="Type a short message for the patient to hear…"
                  className={`w-full px-3 py-2.5 text-sm border rounded-xl resize-none outline-none transition-all ${errors.message ? 'border-red-300' : 'border-slate-200 focus:border-blue-400'}`}
                  value={form.message}
                  onChange={e => setForm(v=>({...v,message:e.target.value}))}
                />
                <span className="absolute bottom-2 right-3 text-[10px] text-slate-300">{form.message.length}/200</span>
              </div>
              {errors.message && <p className="text-xs text-red-500 mt-1">{errors.message}</p>}
            </div>

            {/* Progress */}
            {loading && (
              <div className="mt-3 space-y-2">
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 transition-all" style={{ width:`${progress}%` }} />
                </div>
                <p className="text-xs text-slate-400">{processing ? 'Processing voice narration…' : `Uploading ${progress}%`}</p>
              </div>
            )}

            {/* CTA */}
            <Button variant="primary" size="lg" className="w-full mt-4" disabled={loading} onClick={handleSend}>
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              {loading ? 'Sending…' : `Send to ${patient?.name || 'Patient'}`}
            </Button>
          </Card>
        </div>

        {/* ── HISTORY ── */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900">Sent Photos</h3>
            <Badge variant="default">{history.length} items</Badge>
          </div>
          <Card className="!p-0 overflow-hidden">
            {history.length === 0 ? (
              <EmptyCard icon={ImageIcon} title="No photos sent" description="Photos you send will appear here with seen receipts." iconBg="bg-slate-50" />
            ) : (
              history.map((photo, idx) => (
                <React.Fragment key={photo.id}>
                  <div className="flex items-center gap-3 p-3 hover:bg-slate-50/50 transition-colors">
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0">
                      <img src={photo.labeled_image_url || photo.image_url} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-slate-900 truncate">{photo.sender?.name || 'Family'}</p>
                        <span className="text-[10px] text-slate-400 flex-shrink-0 ml-2">{formatTimeAgo(photo.sent_at)}</span>
                      </div>
                      <p className="text-xs text-slate-400 truncate mt-0.5">{photo.message}</p>
                      <div className={`flex items-center gap-1 mt-1 text-[10px] font-medium ${photo.viewed_at ? 'text-emerald-600' : 'text-slate-300'}`}>
                        {photo.viewed_at ? <><CheckCircle2 size={10} /> Seen · {formatTimeAgo(photo.viewed_at)}</> : <><Clock size={10} /> Not seen yet</>}
                      </div>
                    </div>
                  </div>
                  {idx < history.length - 1 && <Separator />}
                </React.Fragment>
              ))
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
