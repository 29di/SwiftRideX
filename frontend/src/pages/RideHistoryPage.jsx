import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Skeleton from '../components/ui/Skeleton';
import StatusBadge from '../components/ride/StatusBadge';
import { rideService } from '../services/rideService';

export default function RideHistoryPage() {
  const navigate = useNavigate();
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadHistory = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await rideService.getRideHistoryForRider();
        setRides(Array.isArray(response?.rides) ? response.rides : []);
      } catch (requestError) {
        setError(requestError?.message || 'Unable to load ride history right now.');
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <Card className="space-y-3">
        <div className="section-label">My rides</div>
        <h3 className="text-2xl font-bold text-white">Ride history</h3>
        <p className="text-sm text-slate-400">Review your completed and ongoing rides in one place.</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={() => navigate('/rider')}>Back to overview</Button>
          <Button variant="primary" onClick={() => navigate('/rider/book')}>Book new ride</Button>
        </div>
      </Card>

      {error ? <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}

      {rides.length ? (
        <div className="grid gap-3">
          {rides.map((ride) => (
            <Card key={ride.id} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Ride #{ride.id}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    {ride.pickupAddress || 'Pickup address unavailable'}
                    {' '}
                    → {' '}
                    {ride.dropAddress || 'Drop address unavailable'}
                  </div>
                </div>
                <StatusBadge status={ride.status} />
              </div>

              <div className="grid gap-2 text-sm text-slate-300 sm:grid-cols-3">
                <div>Fare: ${ride.fare ?? '—'}</div>
                <div>Driver: {ride.driver?.name || (ride.driverId ? 'Assigned driver' : 'Pending')}</div>
                <div>Created: {ride.createdAt ? new Date(ride.createdAt).toLocaleString() : '—'}</div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <p className="text-sm text-slate-400">No rides found yet.</p>
        </Card>
      )}
    </div>
  );
}