import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import Skeleton from '../components/ui/Skeleton';
import Button from '../components/ui/Button';
import RideSummaryCard from '../components/ride/RideSummaryCard';
import RideTimeline from '../components/ride/RideTimeline';
import RideActivityFeed from '../components/ride/RideActivityFeed';
import StatusBadge from '../components/ride/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { useSocketRealtime } from '../hooks/useSocketRealtime';
import { rideService } from '../services/rideService';

const ACTIVE_RIDE_KEY = 'swiftridex_active_ride';
const ACTIVE_RIDE_STATUSES = new Set(['REQUESTED', 'ACCEPTED', 'STARTED']);

const readRide = () => {
  try {
    const raw = localStorage.getItem(ACTIVE_RIDE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const saveRide = (ride) => {
  if (!ride) {
    localStorage.removeItem(ACTIVE_RIDE_KEY);
    return;
  }

  localStorage.setItem(ACTIVE_RIDE_KEY, JSON.stringify(ride));
};

export default function RiderDashboardPage() {
  const navigate = useNavigate();
  const { session, refreshSession } = useAuth();
  const { latestRideEvent, events, connectionStatus } = useSocketRealtime();
  const [rides, setRides] = useState(() => {
    const storedRide = readRide();
    return storedRide ? [storedRide] : [];
  });
  const [loadingPage, setLoadingPage] = useState(true);
  const [actionError, setActionError] = useState('');
  const hasLoadedRef = useRef(false);

  const activeRide = useMemo(
    () => rides.find((ride) => ACTIVE_RIDE_STATUSES.has(String(ride?.status || '').toUpperCase())) || null,
    [rides]
  );

  useEffect(() => {
    if (hasLoadedRef.current) {
      return;
    }

    hasLoadedRef.current = true;

    const loadProfileAndRide = async () => {
      setLoadingPage(true);
      try {
        await refreshSession();
        const response = await rideService.getRideHistoryForRider();
        const nextRides = Array.isArray(response?.rides) ? response.rides : [];

        setRides(nextRides);

        const nextActiveRide = nextRides.find((ride) => ACTIVE_RIDE_STATUSES.has(String(ride?.status || '').toUpperCase())) || null;
        saveRide(nextActiveRide);
      } catch (error) {
        console.error('Rider dashboard data load failed:', error);
        const storedRide = readRide();
        setRides(storedRide ? [storedRide] : []);
      } finally {
        setLoadingPage(false);
      }
    };

    loadProfileAndRide();
  }, [refreshSession]);

  useEffect(() => {
    if (!latestRideEvent?.payload?.rideId) {
      return;
    }

    if (session?.user?.id && latestRideEvent?.payload?.riderId && String(latestRideEvent.payload.riderId) !== String(session.user.id)) {
      return;
    }

    setRides((currentRides) => {
      const nextRides = currentRides.some((ride) => String(ride.id) === String(latestRideEvent.payload.rideId))
        ? currentRides.map((ride) => {
            if (String(ride.id) !== String(latestRideEvent.payload.rideId)) {
              return ride;
            }

            return {
              ...ride,
              ...latestRideEvent.payload,
              status: latestRideEvent.payload.status || ride.status,
            };
          })
        : [{ ...latestRideEvent.payload, id: latestRideEvent.payload.rideId }, ...currentRides];

      const updatedActiveRide = nextRides.find((ride) => ACTIVE_RIDE_STATUSES.has(String(ride?.status || '').toUpperCase())) || null;
      saveRide(updatedActiveRide);
      return nextRides;
    });
  }, [latestRideEvent, session?.user?.id]);

  const primaryRide = activeRide || null;
  const primaryDriverName = primaryRide?.driver?.name || (primaryRide?.driverId ? 'Assigned driver' : 'Pending');

  const metrics = useMemo(
    () => [
      { label: 'Connection', value: connectionStatus === 'connected' ? 'Live' : 'Syncing' },
      { label: 'Assigned driver', value: primaryDriverName },
      { label: 'Ride status', value: primaryRide?.status || 'Idle' },
    ],
    [connectionStatus, primaryDriverName, primaryRide?.status]
  );

  if (loadingPage) {
    return (
      <div className="grid gap-6">
        <Skeleton className="h-48 w-full" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative grid gap-6">
      <div className="grid gap-6">
        <div className="grid gap-4 lg:grid-cols-3">
          {metrics.map((metric) => (
            <Card key={metric.label} className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-slate-400">{metric.label}</div>
                <div className="mt-2 text-2xl font-bold text-white">{metric.value}</div>
              </div>
              <div className="h-14 w-14 rounded-3xl bg-brand-500/10 ring-1 ring-brand-400/20" />
            </Card>
          ))}
        </div>

        {activeRide ? (
          <Card className="space-y-5 border-brand-400/30 bg-brand-500/5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="section-label">Active ride</div>
                <h3 className="mt-2 text-2xl font-bold text-white">Ride #{activeRide.id}</h3>
                <p className="mt-2 text-sm text-slate-400">Your ongoing ride is visible here.</p>
              </div>
              <StatusBadge status={activeRide.status} />
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
              <RideSummaryCard ride={activeRide} />
              <Card>
                <div className="section-label">Ride progression</div>
                <h3 className="mt-2 text-2xl font-bold text-white">Live status tracking</h3>
                <p className="mt-2 text-sm text-slate-400">Socket.io updates flow here instantly without page refresh.</p>
                <div className="mt-5">
                  <RideTimeline status={activeRide.status || 'REQUESTED'} />
                </div>
              </Card>
            </div>
          </Card>
        ) : (
          <Card className="space-y-4">
            <div className="section-label">No active ride</div>
            <h3 className="text-2xl font-bold text-white">Ready for your next trip</h3>
            <p className="text-sm text-slate-400">You have no ongoing ride right now. Open Book Ride from the side panel to start a new request.</p>
            <div>
              <Button variant="primary" onClick={() => navigate('/rider/book')}>Go to Book Ride</Button>
            </div>
          </Card>
        )}

        {actionError ? (
          <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{actionError}</div>
        ) : null}

        <Card>
          <div className="section-label">Realtime feed</div>
          <h3 className="mt-2 text-2xl font-bold text-white">Event stream</h3>
          <p className="mt-2 text-sm text-slate-400">Recent socket events from the backend appear below.</p>
          <div className="mt-5">
            <RideActivityFeed events={events} />
          </div>
        </Card>
      </div>
    </div>
  );
}
