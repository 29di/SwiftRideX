import Card from '../ui/Card';
import StatusBadge from './StatusBadge';

const formatValue = (value) => (value === null || value === undefined || value === '' ? '—' : value);

export default function RideSummaryCard({ ride }) {
  const driverName = ride?.driver?.name || (ride?.driverId ? 'Assigned driver' : null);

  if (!ride) {
    return (
      <Card className="min-h-[240px]">
        <div className="section-label">Current ride</div>
        <h3 className="mt-3 text-2xl font-bold text-white">No active ride</h3>
        <p className="mt-2 max-w-md text-sm text-slate-400">
          Start a booking to see live status updates, driver assignment, and ride progression here.
        </p>
      </Card>
    );
  }

  return (
    <Card className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="section-label">Current ride</div>
          <h3 className="mt-2 text-2xl font-bold text-white">Ride #{formatValue(ride.id)}</h3>
        </div>
        <StatusBadge status={ride.status} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-4">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Pickup</div>
          <div className="mt-2 text-sm text-white">{formatValue(ride.pickupAddress || 'Pickup location selected')}</div>
        </div>
        <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-4">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Drop</div>
          <div className="mt-2 text-sm text-white">{formatValue(ride.dropAddress || 'Drop location selected')}</div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Driver</div>
          <div className="mt-2 text-sm font-semibold text-white">{formatValue(driverName || 'Pending')}</div>
        </div>
        <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Fare</div>
          <div className="mt-2 text-sm font-semibold text-white">${formatValue(ride.fare)}</div>
        </div>
      </div>
    </Card>
  );
}
