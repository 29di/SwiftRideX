import { useEffect, useMemo, useState } from 'react';
import Card from '../components/ui/Card';
import Skeleton from '../components/ui/Skeleton';
import DriverInfoCard from '../components/ride/DriverInfoCard';
import RideActivityFeed from '../components/ride/RideActivityFeed';
import RideSummaryCard from '../components/ride/RideSummaryCard';
import RideTimeline from '../components/ride/RideTimeline';
import { useAuth } from '../context/AuthContext';
import { useSocketRealtime } from '../hooks/useSocketRealtime';
import { getApiErrorMessage } from '../services/api';
import { driverService } from '../services/driverService';
import { rideService } from '../services/rideService';

export default function DriverDashboardPage() {
  const { session, refreshSession } = useAuth();
  const { latestRideEvent, events, connectionStatus } = useSocketRealtime();
  const [driver, setDriver] = useState(session?.user || null);
  const [currentRide, setCurrentRide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    const loadDriver = async () => {
      setLoading(true);
      try {
        const refreshed = await refreshSession();
        setDriver(refreshed?.user || session?.user || null);

        const activeRideResponse = await rideService.getActiveRideForDriver();
        setCurrentRide(activeRideResponse?.ride || null);
      } catch (error) {
        console.error('Driver dashboard data load failed:', error);
        setDriver(session?.user || null);
      } finally {
        setLoading(false);
      }
    };

    loadDriver();
  }, [refreshSession, session?.user]);

  useEffect(() => {
    if (!latestRideEvent?.payload?.driverId || !driver?.id) {
      return;
    }

    if (String(latestRideEvent.payload.driverId) !== String(driver.id)) {
      return;
    }

    setCurrentRide((current) => ({
      ...(current || {}),
      id: latestRideEvent.payload.rideId,
      driverId: latestRideEvent.payload.driverId,
      riderId: latestRideEvent.payload.riderId,
      status: latestRideEvent.payload.status,
      fare: latestRideEvent.payload.fare,
    }));
  }, [driver?.id, latestRideEvent]);

  const metrics = useMemo(
    () => [
      { label: 'Socket status', value: connectionStatus === 'connected' ? 'Live' : 'Syncing' },
      { label: 'Availability', value: driver?.isOnline ? 'Online' : 'Offline' },
      { label: 'Active ride', value: currentRide?.id ? `#${currentRide.id}` : 'None' },
    ],
    [connectionStatus, currentRide?.id, driver?.isOnline]
  );

  const syncLocation = async () => {
    setActionError('');

    const pushLocation = async (latitude, longitude) => {
      const response = await driverService.updateLocation(latitude, longitude);
      setDriver(response.driver);
      await refreshSession();
    };

    if (!navigator.geolocation) {
      setActionError('Geolocation is not supported in this browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          await pushLocation(latitude, longitude);
        } catch (error) {
          setActionError(getApiErrorMessage(error));
        }
      },
      () => {
        setActionError('Unable to read your current location.');
      }
    );
  };

  const toggleOnlineStatus = async (nextStatus) => {
    setActionError('');

    try {
      const response = await driverService.toggleStatus(nextStatus);
      setDriver(response.driver);
      await refreshSession();
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    }
  };

  if (loading) {
    return (
      <div className="grid gap-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  return (
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

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <DriverInfoCard
          driver={driver}
          currentRide={currentRide}
          onToggleOnline={toggleOnlineStatus}
          onSyncLocation={syncLocation}
        />

        <div className="grid gap-6">
          <Card>
            <div className="section-label">Ride control</div>
            <h3 className="mt-2 text-2xl font-bold text-white">Live ride progression</h3>
            <p className="mt-2 text-sm text-slate-400">
              Ride lifecycle updates are reflected instantly as backend socket events arrive.
            </p>
            <div className="mt-5">
              <RideTimeline status={currentRide?.status || 'REQUESTED'} />
            </div>
          </Card>

          <Card>
            <div className="section-label">Realtime events</div>
            <h3 className="mt-2 text-2xl font-bold text-white">Socket activity</h3>
            <div className="mt-5">
              <RideActivityFeed events={events} />
            </div>
          </Card>
        </div>
      </div>

      {actionError ? <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{actionError}</div> : null}
      <RideSummaryCard ride={currentRide} />
    </div>
  );
}
