import { MapPin, Power, PowerOff, RefreshCw } from 'lucide-react';
import Button from '../ui/Button';
import Card from '../ui/Card';

const formatValue = (value) => (value === null || value === undefined || value === '' ? '—' : value);

export default function DriverInfoCard({ driver, currentRide, onToggleOnline, onSyncLocation, loading = false }) {
  const isOnline = Boolean(driver?.isOnline);

  return (
    <Card className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="section-label">Driver profile</div>
          <h3 className="mt-2 text-2xl font-bold text-white">{driver?.email || 'Driver account'}</h3>
          <p className="mt-2 text-sm text-slate-400">Manage your availability and location sync from one place.</p>
        </div>
        <span className={`status-pill ${isOnline ? 'status-accepted' : 'status-requested'}`}>
          {isOnline ? 'Online' : 'Offline'}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-4">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Latitude</div>
          <div className="mt-2 text-sm font-semibold text-white">{formatValue(driver?.latitude)}</div>
        </div>
        <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-4">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Longitude</div>
          <div className="mt-2 text-sm font-semibold text-white">{formatValue(driver?.longitude)}</div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Button variant={isOnline ? 'secondary' : 'primary'} onClick={() => onToggleOnline?.(!isOnline)} disabled={loading}>
          {isOnline ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
          {isOnline ? 'Go offline' : 'Go online'}
        </Button>
        <Button variant="secondary" onClick={onSyncLocation} disabled={loading}>
          <RefreshCw className="h-4 w-4" />
          Sync location
        </Button>
      </div>

      <div className="rounded-3xl border border-white/5 bg-gradient-to-br from-brand-600/15 to-cyan-400/5 p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <MapPin className="h-4 w-4 text-brand-300" />
          Assigned ride
        </div>
        <p className="mt-3 text-sm text-slate-300">
          {currentRide
            ? `Ride #${formatValue(currentRide.id)} is currently ${String(currentRide.status).toLowerCase()}.`
            : 'No active assignment right now. Incoming updates will appear instantly when the backend emits them.'}
        </p>
      </div>
    </Card>
  );
}
