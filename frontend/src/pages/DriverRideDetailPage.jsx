import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Skeleton from '../components/ui/Skeleton';
import RideSummaryCard from '../components/ride/RideSummaryCard';
import RideTimeline from '../components/ride/RideTimeline';
import { useSocketRealtime } from '../hooks/useSocketRealtime';
import { formatRideId } from '../services/rideId';
import { driverService } from '../services/driverService';

export default function DriverRideDetailPage() {
  const navigate = useNavigate();
  const { rideId } = useParams();
  const { latestRideEvent } = useSocketRealtime();
  const [ride, setRide] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRide = async () => {
      if (!rideId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const response = await driverService.getRideDetail(rideId);
        setRide(response?.ride || null);
      } catch {
        setRide(null);
      } finally {
        setLoading(false);
      }
    };

    loadRide();
  }, [rideId]);

  useEffect(() => {
    if (!latestRideEvent?.payload?.rideId || String(latestRideEvent.payload.rideId) !== String(rideId)) {
      return;
    }

    setRide((current) => (current ? { ...current, ...latestRideEvent.payload, status: latestRideEvent.payload.status || current.status } : current));
  }, [latestRideEvent, rideId]);

  if (loading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (!ride?.id) {
    return (
      <Card className="space-y-4">
        <div className="section-label">Ride detail</div>
        <h3 className="text-2xl font-bold text-white">Ride not found</h3>
        <Button variant="secondary" onClick={() => navigate('/driver')}>Back to driver dashboard</Button>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="grid gap-6">
        <Card>
          <div className="section-label">Ride detail</div>
          <h3 className="mt-2 text-2xl font-bold text-white">Ride #{formatRideId(ride.id)}</h3>
          <p className="mt-2 text-sm text-slate-400">Route map has been moved to the driver dashboard active ride panel.</p>
        </Card>
        <RideSummaryCard ride={ride} />
      </div>

      <div className="grid gap-6">
        <Card>
          <div className="section-label">Ride timeline</div>
          <h3 className="mt-2 text-2xl font-bold text-white">Lifecycle state</h3>
          <div className="mt-5">
            <RideTimeline status={ride.status || 'REQUESTED'} />
          </div>
        </Card>
        <Button variant="secondary" onClick={() => navigate('/driver')}>Back to driver dashboard</Button>
      </div>
    </div>
  );
}
