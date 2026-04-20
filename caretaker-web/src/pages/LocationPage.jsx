import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polygon, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Shield, Map as MapIcon, Save, History, PenTool, XCircle,
  Wifi, Activity, Triangle, Square, Circle as CircleIcon,
  Pentagon, Trash2, RefreshCw, Navigation, CheckCircle2,
  AlertTriangle, ShieldCheck
} from 'lucide-react';
import { toast } from 'react-hot-toast';

import { supabase } from '../lib/supabase';
import { usePatient } from '../contexts/PatientContext';
import { formatTime, formatTimeAgo } from '../utils/timeFormat';
import { Card, CardHeader, CardTitle, Badge, Button, PageHeader, Separator, Skeleton, EmptyCard } from '../components/ui.jsx';

/* ── Fix default marker icons ── */
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

/* ── Patient marker ── */
const makeMarker = (breached) => L.divIcon({
  className: '',
  html: `
    <div style="position:relative;width:44px;height:44px;display:flex;align-items:center;justify-content:center;">
      <div style="position:absolute;inset:0;border-radius:50%;background:${breached ? 'rgba(244,63,94,.2)' : 'rgba(37,99,235,.15)'};animation:ping 2s infinite;"></div>
      <div style="width:16px;height:16px;border-radius:50%;background:${breached ? '#f43f5e' : '#2563eb'};border:3px solid white;box-shadow:0 2px 12px rgba(0,0,0,.25);"></div>
    </div>
    <style>@keyframes ping{0%{transform:scale(1);opacity:1}75%,100%{transform:scale(2.2);opacity:0}}</style>
  `,
  iconSize: [44, 44],
  iconAnchor: [22, 22],
});

/* ── Map re-center ── */
const Recenter = ({ coords }) => {
  const map = useMap();
  useEffect(() => { if (coords) map.setView(coords, map.getZoom()); }, [coords, map]);
  return null;
};

/* ── Drawing controller via pure Leaflet click events ── */
const DrawController = ({ active, shape, onDone }) => {
  const map = useMap();
  const pts  = useRef([]);
  const layer = useRef(null);

  useEffect(() => {
    if (!active) {
      pts.current = [];
      if (layer.current) { map.removeLayer(layer.current); layer.current = null; }
      map.getContainer().style.cursor = '';
      return;
    }
    map.getContainer().style.cursor = 'crosshair';

    const needed = { triangle:3, square:4, pentagon:5, circle:2 }[shape] || 3;

    const onClick = (e) => {
      pts.current.push({ lat: e.latlng.lat, lng: e.latlng.lng });
      if (layer.current) { map.removeLayer(layer.current); layer.current = null; }

      if (shape === 'circle') {
        if (pts.current.length === 1) {
          layer.current = L.circleMarker([pts.current[0].lat, pts.current[0].lng], { color:'#2563eb', radius:6 }).addTo(map);
          return;
        }
        if (pts.current.length === 2) {
          const [c, edge] = pts.current;
          const radius = map.distance([c.lat,c.lng],[edge.lat,edge.lng]);
          const poly = Array.from({length:16},(_,i)=>{
            const a=(i/16)*Math.PI*2;
            return { lat: c.lat+(radius/111320)*Math.cos(a), lng: c.lng+(radius/(111320*Math.cos(c.lat*Math.PI/180)))*Math.sin(a) };
          });
          map.getContainer().style.cursor='';
          onDone(poly);
          return;
        }
      }

      if (pts.current.length < needed) {
        layer.current = L.polygon(pts.current.map(p=>[p.lat,p.lng]),{color:'#2563eb',fillOpacity:.15,dashArray:'6,8',weight:2}).addTo(map);
      }
      if (pts.current.length === needed) {
        map.getContainer().style.cursor='';
        onDone([...pts.current]);
      }
    };

    map.on('click', onClick);
    return () => {
      map.off('click', onClick);
      if (layer.current) { map.removeLayer(layer.current); layer.current = null; }
      map.getContainer().style.cursor='';
      pts.current = [];
    };
  }, [active, shape, map, onDone]);

  return null;
};

/* ══════════════════════════════════════════════════════ */
const SHAPES = [
  { id:'triangle', label:'Triangle', icon:Triangle, hint:'3 clicks' },
  { id:'square',   label:'Square',   icon:Square,   hint:'4 clicks' },
  { id:'circle',   label:'Circle',   icon:CircleIcon,hint:'2 clicks' },
  { id:'pentagon', label:'Pentagon', icon:Pentagon,  hint:'5 clicks' },
];

export default function LocationPage() {
  const { patientId, patient } = usePatient();
  const [location, setLocation] = useState(null);
  const [geofence, setGeofence] = useState(null);
  const [history,  setHistory]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [drawing,  setDrawing]  = useState(false);
  const [shape,    setShape]    = useState('triangle');
  const [draft,    setDraft]    = useState(null);     // pending polygon coords

  const fetchData = useCallback(async () => {
    if (!patientId) return;
    const { data: loc } = await supabase.from('location_logs').select('*').eq('patient_id',patientId).order('timestamp',{ascending:false}).limit(1).single();
    if (loc) setLocation(loc);

    const { data: g } = await supabase.from('geofences').select('polygon_coordinates').eq('patient_id',patientId).eq('is_active',true).limit(1).single();
    if (g?.polygon_coordinates) setGeofence(g.polygon_coordinates.map(p=>[p.lat,p.lng]));

    const { data: hist } = await supabase.from('location_logs').select('*').eq('patient_id',patientId).order('timestamp',{ascending:false}).limit(12);
    if (hist) setHistory(hist);
    setLoading(false);
  }, [patientId]);

  useEffect(() => {
    fetchData();
    if (!patientId) return;
    const ch = supabase.channel('loc')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'location_logs',filter:`patient_id=eq.${patientId}`},fetchData)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [patientId, fetchData]);

  const handleDrawDone = useCallback((coords) => {
    setDraft(coords);
    setDrawing(false);
    toast.success(`${shape.charAt(0).toUpperCase()+shape.slice(1)} drawn — review and deploy`);
  }, [shape]);

  const handleSave = async () => {
    if (!draft) return;
    try {
      await supabase.from('geofences').update({is_active:false}).eq('patient_id',patientId);
      const { error } = await supabase.from('geofences').insert({ patient_id:patientId, polygon_coordinates:draft, is_active:true });
      if (error) throw error;
      toast.success('Safe zone deployed ✓');
      setGeofence(draft.map(p=>[p.lat,p.lng]));
      setDraft(null);
    } catch (e) { toast.error('Save failed: ' + e.message); }
  };

  const [mapStyle, setMapStyle] = useState('hybrid'); // 'hybrid' or 'streets'

  // Frontend safety check for breach
  const isPointInPolygon = (point, poly) => {
    if (!poly || poly.length < 3) return false;
    let x = point[0], y = point[1];
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      let xi = poly[i][0], yi = poly[i][1];
      let xj = poly[j][0], yj = poly[j][1];
      let intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };

  const center    = [location?.latitude || 18.5204, location?.longitude || 73.8567];
  const dbBreach  = location?.breach_status === 'breach';
  const geoBreach = geofence ? !isPointInPolygon(center, geofence) : false;
  const breached  = dbBreach || geoBreach;

  // Trigger alert sound or notification when breach status changes
  useEffect(() => {
    if (breached) {
      toast.error(`EMERGENCY: ${patient?.name || 'Patient'} is outside the safe zone!`, {
        duration: 10000,
        position: 'top-center',
        icon: '⚠️',
        style: { background: '#ef4444', color: '#fff', fontWeight: 'bold' }
      });
    }
  }, [breached, patient?.name]);

  const STYLES = {
    hybrid: `https://api.maptiler.com/maps/hybrid/{z}/{x}/{y}.jpg?key=${import.meta.env.VITE_MAPTILER_KEY}`,
    streets: `https://api.maptiler.com/maps/streets-v2-dark/{z}/{x}/{y}.png?key=${import.meta.env.VITE_MAPTILER_KEY}`,
    satellite: `https://api.maptiler.com/maps/satellite/{z}/{x}/{y}.jpg?key=${import.meta.env.VITE_MAPTILER_KEY}`,
  };

  return (
    <div className="max-w-[1400px] mx-auto relative">
      {/* Global Breach Overlay */}
      {breached && (
        <div className="fixed inset-x-0 top-0 z-[1000] animate-in slide-in-from-top duration-500">
          <div className="bg-red-600 text-white px-6 py-3 shadow-2xl flex items-center justify-center gap-4 border-b border-red-500/30 backdrop-blur-md bg-opacity-90">
            <AlertTriangle className="animate-pulse" size={24} />
            <div className="text-center">
              <p className="font-bold text-sm uppercase tracking-widest">Critical Geofence Breach</p>
              <p className="text-xs opacity-90">{patient?.name || 'Patient'} is outside the designated safe zone!</p>
            </div>
            <ShieldCheck size={24} className="opacity-50" />
          </div>
        </div>
      )}

      <PageHeader
        title="Location Intelligence"
        description="Real-time GPS tracking and safe zone management."
        action={
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 mr-2">
              <button 
                onClick={() => setMapStyle('streets')}
                className={`px-3 py-1 text-[10px] font-bold uppercase rounded-md transition-all ${mapStyle === 'streets' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Map
              </button>
              <button 
                onClick={() => setMapStyle('hybrid')}
                className={`px-3 py-1 text-[10px] font-bold uppercase rounded-md transition-all ${mapStyle === 'hybrid' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Hybrid
              </button>
            </div>
            <Badge variant={breached ? 'danger' : 'success'} dot className={breached ? 'animate-pulse' : ''}>
              {breached ? 'Breach Detected' : 'Safe Zone'}
            </Badge>
            <Button size="sm" variant="ghost" onClick={fetchData}><RefreshCw size={13} /></Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── MAP (2/3 width) ── */}
        <div className="lg:col-span-2">
          <Card className="!p-0 overflow-hidden relative" style={{ height: 520 }}>
            {loading ? (
              <div className="w-full h-full animate-pulse bg-slate-100 flex items-center justify-center">
                <Navigation size={32} className="text-slate-300" />
              </div>
            ) : (
              <MapContainer center={center} zoom={16} zoomControl={true} scrollWheelZoom={true} style={{ height:'100%', width:'100%' }}>
                <Recenter coords={center} />
                <DrawController active={drawing} shape={shape} onDone={handleDrawDone} />
                <TileLayer
                  attribution='© MapTiler'
                  url={STYLES[mapStyle]}
                />
                {/* Saved geofence */}
                {geofence && !draft && (
                  <Polygon positions={geofence} pathOptions={{
                    color: breached ? '#f43f5e' : '#3b82f6',
                    fillColor: breached ? '#f43f5e' : '#3b82f6',
                    fillOpacity: 0.15, 
                    weight: 3,
                    dashArray: breached ? '10, 10' : '0',
                  }} />
                )}
                {/* Draft preview */}
                {draft && (
                  <Polygon positions={draft.map(p=>[p.lat,p.lng])} pathOptions={{
                    color: '#10b981', fillColor: '#10b981', fillOpacity: 0.2, weight: 3, dashArray: '6,8'
                  }} />
                )}
                <Marker position={center} icon={makeMarker(breached)}>
                  <Popup className="rounded-xl overflow-hidden">
                    <div className="p-1 text-sm font-semibold">{patient?.name || 'Patient'}</div>
                  </Popup>
                </Marker>
              </MapContainer>
            )}

            {/* Map overlay badges */}
            {!loading && (
              <>
                <div className="absolute bottom-4 left-4 z-[400]">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-black/80 text-white border border-white/20 backdrop-blur-md shadow-2xl">
                    <span className={`w-2 h-2 rounded-full ${mapStyle === 'hybrid' ? 'bg-emerald-400' : 'bg-blue-400'}`} />
                    {mapStyle === 'hybrid' ? 'Hybrid View' : 'Street View'}
                  </span>
                </div>
                {drawing && (
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[400]">
                    <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold bg-blue-600 text-white shadow-2xl shadow-blue-500/40 border border-blue-400">
                      <PenTool size={12} className="animate-bounce" />
                      Place {shape} corners on map
                    </span>
                  </div>
                )}
              </>
            )}
          </Card>

          {/* ── Location stats row ── */}
          {!loading && location && (
            <div className="grid grid-cols-3 gap-3 mt-3">
              <StatPill label="Latitude"  value={location.latitude?.toFixed(6)} />
              <StatPill label="Longitude" value={location.longitude?.toFixed(6)} />
              <StatPill label="Last Update" value={formatTimeAgo(location.timestamp)} />
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL (1/3) ── */}
        <div className="flex flex-col gap-4">

          {/* Safe Zone Console */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Safe Zone</CardTitle>
                <p className="text-xs text-slate-400 mt-0.5">Draw a boundary on the map</p>
              </div>
              <Shield size={16} className="text-blue-500" />
            </CardHeader>

            {/* Shape picker */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {SHAPES.map(({ id, label, icon:Icon, hint }) => (
                <button
                  key={id}
                  onClick={() => { setShape(id); setDrawing(false); setDraft(null); }}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition-all ${
                    shape === id
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'
                  }`}
                >
                  <Icon size={13} />
                  <span>{label}</span>
                  <span className={`ml-auto text-[9px] opacity-60`}>{hint}</span>
                </button>
              ))}
            </div>

            <Separator className="mb-4" />

            {/* Draft deploy vs draw button */}
            {draft ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <CheckCircle2 size={15} className="text-emerald-500 flex-shrink-0" />
                  <p className="text-xs text-emerald-700 font-medium">Shape drawn — review on map then deploy.</p>
                </div>
                <Button variant="success" size="md" className="w-full" onClick={handleSave}>
                  <Save size={14} /> Deploy Safe Zone
                </Button>
                <Button variant="ghost" size="sm" className="w-full" onClick={() => setDraft(null)}>
                  Discard & Redraw
                </Button>
              </div>
            ) : (
              <Button
                variant={drawing ? 'danger' : 'primary'}
                size="md"
                className="w-full"
                onClick={() => setDrawing(d => !d)}
              >
                {drawing ? <><XCircle size={14} /> Stop Drawing</> : <><PenTool size={14} /> Start Drawing</>}
              </Button>
            )}

            {geofence && !draft && (
              <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                <span>Current boundary active</span>
                <Button size="sm" variant="ghost" onClick={() => { setDraft(null); setGeofence(null); }}>
                  <Trash2 size={11} /> Clear
                </Button>
              </div>
            )}
          </Card>

          {/* Path History */}
          <Card className="flex-1 !p-0 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">Path History</p>
                <p className="text-xs text-slate-400 mt-0.5">Last {history.length} GPS pings</p>
              </div>
              <Activity size={15} className="text-blue-500" />
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 320 }}>
              {loading ? (
                <div className="p-4 space-y-2">
                  {[1,2,3,4].map(i => <Skeleton key={i} className="h-12 rounded-xl" />)}
                </div>
              ) : history.length === 0 ? (
                <EmptyCard icon={Navigation} title="No GPS logs" description="Location pings will appear here." iconBg="bg-slate-50" />
              ) : (
                history.map((ping, idx) => (
                  <React.Fragment key={ping.id}>
                    <div className={`flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors ${ping.breach_status === 'breach' ? 'bg-red-50/50' : ''}`}>
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${ping.breach_status === 'breach' ? 'bg-red-500' : 'bg-blue-500'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-700 font-mono tabular-nums">
                          {ping.latitude?.toFixed(4)}, {ping.longitude?.toFixed(4)}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Wifi size={9} className="text-slate-300" />
                          <span className="text-[10px] text-slate-400">{ping.source || 'GPS'}</span>
                          {ping.breach_status === 'breach' && (
                            <Badge variant="danger" className="text-[9px] !py-0">Breach</Badge>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-300 tabular-nums flex-shrink-0">{formatTime(ping.timestamp)}</span>
                    </div>
                    {idx < history.length - 1 && <Separator />}
                  </React.Fragment>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ── Stat pill ── */
const StatPill = ({ label, value }) => (
  <Card className="!py-3 !px-4">
    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{label}</p>
    <p className="text-sm font-semibold text-slate-900 mt-0.5 font-mono tabular-nums">{value ?? '—'}</p>
  </Card>
);
