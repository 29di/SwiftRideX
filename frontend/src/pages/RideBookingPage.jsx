import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import RideRequestCard from '../components/ride/RideRequestCard';
import { useSocketRealtime } from '../hooks/useSocketRealtime';
import { getApiErrorMessage } from '../services/api';
import { rideService } from '../services/rideService';

const ACTIVE_RIDE_KEY = 'swiftridex_active_ride';

export default function RideBookingPage() {
  const navigate = useNavigate();
  const { events } = useSocketRealtime();
  const [error, setError] = useState('');

  const handleSubmit = async (payload) => {
    setError('');

    try {
      const response = await rideService.requestRide(payload);
      const nextRide = {
        ...response.ride,
        pickupAddress: payload.pickupAddress,
        dropAddress: payload.dropAddress,
      };
      localStorage.setItem(ACTIVE_RIDE_KEY, JSON.stringify(nextRide));
      navigate('/rider/tracking');
    } catch (error) {
      setError(getApiErrorMessage(error));
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <RideRequestCard onSubmit={handleSubmit} />

      <div className="grid gap-6">
        {error ? <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}

        <Card>
          <div className="section-label">Live context</div>
          <h3 className="mt-2 text-2xl font-bold text-white">Booking flow</h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            The request card uses the same backend flow as the rider dashboard and immediately stores the current ride for tracking.
          </p>
        </Card>

        <Card>
          <div className="section-label">Recent socket events</div>
          <h3 className="mt-2 text-2xl font-bold text-white">Realtime activity</h3>
          <div className="mt-4 grid gap-3">
            {events.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-5 text-sm text-slate-400">
                No socket events captured yet.
              </div>
            ) : (
              events.slice(0, 5).map((event) => (
                <div key={event.id} className="rounded-2xl border border-white/5 bg-white/5 p-4 text-sm text-slate-300">
                  <div className="font-semibold text-white">{event.name}</div>
                  <div className="mt-2 text-xs text-slate-400">{new Date(event.timestamp).toLocaleTimeString()}</div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Button variant="secondary" onClick={() => navigate('/rider')}>Back to dashboard</Button>
      </div>
    </div>
  );
}
