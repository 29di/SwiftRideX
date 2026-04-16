import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import Skeleton from '../components/ui/Skeleton';
import RideRequestCard from '../components/ride/RideRequestCard';
import RideSummaryCard from '../components/ride/RideSummaryCard';
import RideTimeline from '../components/ride/RideTimeline';
import RideActivityFeed from '../components/ride/RideActivityFeed';
import { useAuth } from '../context/AuthContext';
import { useSocketRealtime } from '../hooks/useSocketRealtime';
import { getApiErrorMessage } from '../services/api';
import { rideService } from '../services/rideService';

const ACTIVE_RIDE_KEY = 'swiftridex_active_ride';

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
  const [ride, setRide] = useState(() => readRide());
  const [loadingRide, setLoadingRide] = useState(false);
  const [loadingPage, setLoadingPage] = useState(true);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    const loadProfileAndRide = async () => {
      setLoadingPage(true);
      try {
        await refreshSession();
        const activeRideResponse = await rideService.getActiveRideForRider();

        if (activeRideResponse?.ride) {
          setRide(activeRideResponse.ride);
          saveRide(activeRideResponse.ride);
        } else {
          const storedRide = readRide();

          if (storedRide?.id) {
            const response = await rideService.getRide(storedRide.id);
            setRide(response.ride);
            saveRide(response.ride);
          } else {
            setRide(null);
          }
        }
      } catch (error) {
        console.error('Rider dashboard data load failed:', error);
        setRide(readRide());
      } finally {
        setLoadingPage(false);
      }
    };

    loadProfileAndRide();
  }, [refreshSession]);

  useEffect(() => {
    if (!latestRideEvent?.payload || !ride?.id) {
      return;
    }

    if (String(latestRideEvent.payload.rideId) !== String(ride.id)) {
      return;
    }

    setRide((current) => {
      const updatedRide = { ...current, ...latestRideEvent.payload, status: latestRideEvent.payload.status || current.status };
      saveRide(updatedRide);
      return updatedRide;
    });
  }, [latestRideEvent, ride?.id]);

  const metrics = useMemo(
    () => [
      { label: 'Connection', value: connectionStatus === 'connected' ? 'Live' : 'Syncing' },
      { label: 'Assigned driver', value: ride?.driverId || 'Pending' },
      { label: 'Ride status', value: ride?.status || 'Idle' },
    ],
    [connectionStatus, ride]
  );

  const handleRequestRide = async (payload) => {
    setLoadingRide(true);
    setActionError('');

    try {
      const response = await rideService.requestRide(payload);
      const nextRide = {
        ...response.ride,
        pickupAddress: payload.pickupAddress,
        dropAddress: payload.dropAddress,
      };
      setRide(nextRide);
      saveRide(nextRide);
      navigate('/rider/tracking');
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    } finally {
      setLoadingRide(false);
    }
  };

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
    <div className="grid gap-6">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
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

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <RideRequestCard onSubmit={handleRequestRide} loading={loadingRide} initialValues={ride || undefined} />
        <RideSummaryCard ride={ride} />
      </div>

      {actionError ? (
        <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{actionError}</div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <div className="section-label">Ride progression</div>
          <h3 className="mt-2 text-2xl font-bold text-white">Live status tracking</h3>
          <p className="mt-2 text-sm text-slate-400">Socket.io updates flow here instantly without page refresh.</p>
          <div className="mt-5">
            <RideTimeline status={ride?.status || 'REQUESTED'} />
          </div>
        </Card>
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
