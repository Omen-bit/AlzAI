/**
 * SATHI UI Component Library — shadcn-inspired
 * Drop-in primitives with consistent tokens.
 */

import React from 'react';

/* ─── CARD ─── */
export const Card = ({ children, className = '', padding = true, hover = false, ...props }) => (
  <div
    className={`bg-white border border-slate-200 rounded-2xl ${padding ? 'p-6' : ''} ${hover ? 'transition-all hover:shadow-md hover:border-slate-300' : ''} ${className}`}
    {...props}
  >
    {children}
  </div>
);

export const CardHeader = ({ children, className = '' }) => (
  <div className={`flex items-center justify-between mb-5 ${className}`}>{children}</div>
);

export const CardTitle = ({ children, className = '' }) => (
  <h3 className={`text-sm font-semibold text-slate-900 tracking-tight ${className}`}>{children}</h3>
);

export const CardDescription = ({ children, className = '' }) => (
  <p className={`text-xs text-slate-400 mt-0.5 ${className}`}>{children}</p>
);

/* ─── BADGE ─── */
const BADGE_VARIANTS = {
  default:   'bg-slate-100 text-slate-600 border border-slate-200',
  success:   'bg-emerald-50 text-emerald-700 border border-emerald-200',
  warning:   'bg-amber-50  text-amber-700  border border-amber-200',
  danger:    'bg-red-50    text-red-700    border border-red-200',
  info:      'bg-blue-50   text-blue-700   border border-blue-200',
  purple:    'bg-purple-50 text-purple-700 border border-purple-200',
};

export const Badge = ({ children, variant = 'default', className = '', dot = false }) => (
  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${BADGE_VARIANTS[variant]} ${className}`}>
    {dot && <span className={`w-1.5 h-1.5 rounded-full ${DOT_COLORS[variant]}`} />}
    {children}
  </span>
);
const DOT_COLORS = {
  default: 'bg-slate-400', success: 'bg-emerald-500', warning: 'bg-amber-500',
  danger: 'bg-red-500', info: 'bg-blue-500', purple: 'bg-purple-500',
};

/* ─── BUTTON ─── */
const BTN_VARIANTS = {
  primary:   'bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-200',
  secondary: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50',
  ghost:     'bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-900',
  danger:    'bg-red-50 text-red-600 border border-red-200 hover:bg-red-600 hover:text-white',
  success:   'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-600 hover:text-white',
};
const BTN_SIZES = {
  sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
  md: 'px-4 py-2 text-sm rounded-xl gap-2',
  lg: 'px-5 py-2.5 text-sm rounded-xl gap-2',
  icon: 'p-2 rounded-xl',
};

export const Button = ({ children, variant = 'secondary', size = 'md', className = '', disabled = false, ...props }) => (
  <button
    disabled={disabled}
    className={`inline-flex items-center justify-center font-medium transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:pointer-events-none ${BTN_VARIANTS[variant]} ${BTN_SIZES[size]} ${className}`}
    {...props}
  >
    {children}
  </button>
);

/* ─── SEPARATOR ─── */
export const Separator = ({ className = '' }) => (
  <div className={`h-px bg-slate-100 ${className}`} />
);

/* ─── SKELETON ─── */
export const Skeleton = ({ className = '' }) => (
  <div className={`animate-pulse bg-slate-100 rounded-lg ${className}`} />
);

/* ─── FORM INPUT ─── */
export const Input = ({ className = '', label, helperText, error, ...props }) => (
  <div className="flex flex-col gap-1.5">
    {label && <label className="text-xs font-medium text-slate-700">{label}</label>}
    <input
      className={`w-full px-3 py-2 text-sm text-slate-900 border rounded-xl outline-none transition-all placeholder:text-slate-400 ${error ? 'border-red-300 focus:ring-2 ring-red-100' : 'border-slate-200 focus:border-blue-400 focus:ring-2 ring-blue-100'} ${className}`}
      {...props}
    />
    {helperText && <p className={`text-xs ${error ? 'text-red-500' : 'text-slate-400'}`}>{helperText}</p>}
  </div>
);

/* ─── STAT CARD ─── */
export const StatCard = ({ icon: Icon, iconBg, iconColor, label, value, sub, subColor = 'text-slate-400', loading = false }) => (
  <Card hover>
    <div className="flex items-start justify-between mb-4">
      <div className={`w-9 h-9 ${iconBg} ${iconColor} rounded-xl flex items-center justify-center`}>
        <Icon size={17} />
      </div>
    </div>
    {loading
      ? <><Skeleton className="h-7 w-20 mb-2" /><Skeleton className="h-3 w-28" /></>
      : <>
          <p className="text-2xl font-bold text-slate-900 tracking-tight">{value ?? '—'}</p>
          <p className={`text-xs mt-1 font-medium ${subColor}`}>{label}</p>
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </>
    }
  </Card>
);

/* ─── SECTION HEADER ─── */
export const SectionHeader = ({ title, description, action }) => (
  <div className="flex items-start justify-between gap-4 mb-5">
    <div>
      <h2 className="text-base font-semibold text-slate-900 tracking-tight">{title}</h2>
      {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
    </div>
    {action && <div className="flex-shrink-0">{action}</div>}
  </div>
);

/* ─── EMPTY STATE ─── */
export const EmptyCard = ({ icon: Icon, title, description, iconBg = 'bg-slate-50', iconColor = 'text-slate-400', action }) => (
  <div className="flex flex-col items-center justify-center text-center py-12 gap-3">
    <div className={`w-12 h-12 ${iconBg} ${iconColor} rounded-2xl flex items-center justify-center`}>
      <Icon size={22} />
    </div>
    <div>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {description && <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">{description}</p>}
    </div>
    {action && <div className="mt-2">{action}</div>}
  </div>
);

/* ─── ALERT ITEM ─── */
export const AlertRow = ({ severity, type, message, time, acknowledged, onAck, onCall }) => {
  const isRed = severity === 'red';
  return (
    <div className="flex items-start gap-4 p-4 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 transition-all group">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${isRed ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500'}`}>
        <span className="text-base">{isRed ? '🚨' : '⚠️'}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-slate-900 capitalize">{type?.replace(/_/g, ' ')}</p>
          {!acknowledged && <Badge variant={isRed ? 'danger' : 'warning'}>Unresolved</Badge>}
        </div>
        <p className="text-xs text-slate-400 mt-0.5">{time}</p>
        {message && <p className="text-xs text-slate-500 mt-2 leading-relaxed">{message}</p>}
        <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button size="sm" variant="secondary" onClick={onAck}>Acknowledge</Button>
          {onCall && <Button size="sm" variant="ghost" onClick={onCall}>Call</Button>}
        </div>
      </div>
    </div>
  );
};

/* ─── PAGE HEADER ─── */
export const PageHeader = ({ title, description, action }) => (
  <div className="flex items-start justify-between gap-4 mb-8">
    <div>
      <h1 className="text-xl font-semibold text-slate-900 tracking-tight">{title}</h1>
      {description && <p className="text-sm text-slate-400 mt-1">{description}</p>}
    </div>
    {action}
  </div>
);

/* ─── VITALS ROW ─── */
export const VitalsRow = ({ icon: Icon, iconBg, iconColor, label, value, unit, trend, loading }) => (
  <div className="flex items-center gap-3 py-3 border-b border-slate-50 last:border-0">
    <div className={`w-8 h-8 ${iconBg} ${iconColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
      <Icon size={15} />
    </div>
    <div className="flex-1">
      <p className="text-xs text-slate-400 font-medium">{label}</p>
    </div>
    {loading
      ? <Skeleton className="h-4 w-16" />
      : <span className="text-sm font-semibold text-slate-900 tabular-nums">{value ?? '—'}{value ? <span className="text-slate-400 font-normal text-xs ml-1">{unit}</span> : ''}</span>
    }
  </div>
);
