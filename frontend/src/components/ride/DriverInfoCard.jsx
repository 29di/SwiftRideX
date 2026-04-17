import { useEffect, useState } from 'react';
import { Edit3, MapPin, Power, PowerOff, RefreshCw } from 'lucide-react';
import Button from '../ui/Button';
import Card from '../ui/Card';

const formatValue = (value) => (value === null || value === undefined || value === '' ? '—' : value);

export default function DriverInfoCard({
  driver,
  currentRide,
  onToggleOnline,
  onSyncLocation,
  onUpdateName,
  loading = false,
  updateNameLoading = false,
}) {
  const isOnline = Boolean(driver?.isOnline);
  const [locationLabel, setLocationLabel] = useState('Location not synced yet');
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  useEffect(() => {
    setNameInput(driver?.name || '');
  }, [driver?.name]);

  useEffect(() => {
    const latitude = Number(driver?.latitude);
    const longitude = Number(driver?.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setLocationLabel('Location not synced yet');
      return;
    }

    const abortController = new AbortController();

    fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`, {
      signal: abortController.signal,
      headers: {
        Accept: 'application/json',
      },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to resolve location');
        }
        return response.json();
      })
      .then((data) => {
        setLocationLabel(data?.display_name || 'Location available');
      })
      .catch((error) => {
        if (error?.name === 'AbortError') {
          return;
        }
        setLocationLabel('Location available');
      });

    return () => abortController.abort();
  }, [driver?.latitude, driver?.longitude]);

  return (
    <Card className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="section-label">Driver profile</div>
          <h3 className="mt-2 text-2xl font-bold text-white">{driver?.name || 'Driver'}</h3>
          <div className="mt-1 text-sm text-slate-400">{driver?.email || 'Driver account'}</div>
          <p className="mt-2 text-sm text-slate-400">Manage your availability and location sync from one place.</p>
        </div>
        <span className={`status-pill ${isOnline ? 'status-accepted' : 'status-requested'}`}>
          {isOnline ? 'Online' : 'Offline'}
        </span>
      </div>

      <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-4">
        <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Display name</div>
        {!editingName ? (
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-white">{formatValue(driver?.name || 'Driver')}</div>
            <Button variant="secondary" onClick={() => setEditingName(true)} disabled={loading || updateNameLoading}>
              <Edit3 className="h-4 w-4" />
              Edit name
            </Button>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <input
              value={nameInput}
              onChange={(event) => setNameInput(event.target.value)}
              className="field-input"
              placeholder="Enter driver name"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                disabled={updateNameLoading || !String(nameInput || '').trim()}
                onClick={() => onUpdateName?.(nameInput, () => setEditingName(false))}
              >
                {updateNameLoading ? 'Saving...' : 'Save name'}
              </Button>
              <Button
                variant="secondary"
                disabled={updateNameLoading}
                onClick={() => {
                  setEditingName(false);
                  setNameInput(driver?.name || '');
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-3">
        <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-4">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Current location</div>
          <div className="mt-2 text-sm font-semibold text-white">{formatValue(locationLabel)}</div>
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
