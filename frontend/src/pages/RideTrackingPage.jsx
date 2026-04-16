import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Skeleton from '../components/ui/Skeleton';
import RideActivityFeed from '../components/ride/RideActivityFeed';
import RideSummaryCard from '../components/ride/RideSummaryCard';
import RideTimeline from '../components/ride/RideTimeline';
import { useSocketRealtime } from '../hooks/useSocketRealtime';
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

export default function RideTrackingPage() {
  const navigate = useNavigate();
  const { latestRideEvent, events } = useSocketRealtime();
  const [ride, setRide] = useState(() => readRide());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRide = async () => {
      const storedRide = readRide();

      if (storedRide?.id) {
        try {
          const response = await rideService.getRide(storedRide.id);
          setRide(response.ride);
          localStorage.setItem(ACTIVE_RIDE_KEY, JSON.stringify(response.ride));
        } catch {
          setRide(storedRide);
        }
      }

      setLoading(false);
    };

    loadRide();
  }, []);

  useEffect(() => {
    if (!latestRideEvent?.payload?.rideId || !ride?.id) {
      return;
    }

    if (String(latestRideEvent.payload.rideId) !== String(ride.id)) {
      return;
    }

    const nextStatus = latestRideEvent.payload.status || ride.status;

    if (nextStatus === ride.status) {
      return;
    }

    const updatedRide = {
      ...ride,
      status: nextStatus,
    };

    setRide(updatedRide);
    localStorage.setItem(ACTIVE_RIDE_KEY, JSON.stringify(updatedRide));
  }, [latestRideEvent, ride]);

  if (loading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
      <div className="grid gap-6">
        <RideSummaryCard ride={ride} />
        <Card>
          <div className="section-label">Tracking</div>
          <h3 className="mt-2 text-2xl font-bold text-white">Live status timeline</h3>
          <div className="mt-5">
            <RideTimeline status={ride?.status || 'REQUESTED'} />
          </div>
        </Card>
      </div>

      <div className="grid gap-6">
        <Card>
          <div className="section-label">Current route</div>
          <h3 className="mt-2 text-2xl font-bold text-white">SwiftrideX live panel</h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            This screen stays synced to ride-accepted, ride-started, and ride-completed events.
          </p>
        </Card>

        <Card>
          <div className="section-label">Realtime updates</div>
          <h3 className="mt-2 text-2xl font-bold text-white">Socket feed</h3>
          <div className="mt-5">
            <RideActivityFeed events={events} />
          </div>
        </Card>

        <Button variant="secondary" onClick={() => navigate('/rider')}>Back to dashboard</Button>
      </div>
    </div>
  );
}
