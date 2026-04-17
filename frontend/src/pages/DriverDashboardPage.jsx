import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Card from '../components/ui/Card';
import Skeleton from '../components/ui/Skeleton';
import Button from '../components/ui/Button';
import DriverInfoCard from '../components/ride/DriverInfoCard';
import RideActivityFeed from '../components/ride/RideActivityFeed';
import RideSummaryCard from '../components/ride/RideSummaryCard';
import RideTimeline from '../components/ride/RideTimeline';
import { useAuth } from '../context/AuthContext';
import { useSocketRealtime } from '../hooks/useSocketRealtime';
import { getApiErrorMessage } from '../services/api';
import { driverService } from '../services/driverService';
import { rideService } from '../services/rideService';

const DEFAULT_CENTER = [28.6139, 77.209];

const getDistanceKm = (fromLat, fromLng, toLat, toLng) => {
  if ([fromLat, fromLng, toLat, toLng].some((value) => value === null || value === undefined)) {
    return null;
  }

  const toRadians = (value) => (Number(value) * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const lat1 = toRadians(fromLat);
  const lon1 = toRadians(fromLng);
  const lat2 = toRadians(toLat);
  const lon2 = toRadians(toLng);

  const deltaLat = lat2 - lat1;
  const deltaLon = lon2 - lon1;
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Number((earthRadiusKm * c).toFixed(2));
};

const formatRequestLocation = (ride) => ride.pickupAddress || 'Pickup address unavailable';
const formatDropLocation = (ride) => ride.dropAddress || 'Drop address unavailable';

export default function DriverDashboardPage() {
  const navigate = useNavigate();
  const { session, refreshSession } = useAuth();
  const { latestRideEvent, events, connectionStatus, socket } = useSocketRealtime();
  const [driver, setDriver] = useState(session?.user || null);
  const [currentRide, setCurrentRide] = useState(null);
  const [rideRequests, setRideRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [actionError, setActionError] = useState('');
  const hasLoadedRef = useRef(false);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const driverMarkerRef = useRef(null);
  const requestMarkersRef = useRef([]);

  useEffect(() => {
    if (hasLoadedRef.current) {
      return;
    }

    hasLoadedRef.current = true;

    const loadDriver = async () => {
      setLoading(true);
      setRequestsLoading(true);
      try {
        const refreshed = await refreshSession();
        setDriver(refreshed?.user || session?.user || null);

        const activeRideResponse = await rideService.getActiveRideForDriver();
        setCurrentRide(activeRideResponse?.ride || null);

        const requestResponse = await driverService.getRideRequests();
        setRideRequests(Array.isArray(requestResponse?.rides) ? requestResponse.rides : []);
      } catch (error) {
        console.error('Driver dashboard data load failed:', error);
        setDriver(session?.user || null);
      } finally {
        setLoading(false);
        setRequestsLoading(false);
      }
    };

    loadDriver();
  }, [refreshSession, session?.user]);

  useEffect(() => {
    if (!latestRideEvent?.payload?.driverId || !driver?.id) {
      return;
    }

    if (String(latestRideEvent.payload.driverId) !== String(driver.id)) {
      if (latestRideEvent.type === 'ride-requested') {
        setRideRequests((current) => {
          const exists = current.some((ride) => String(ride.id) === String(latestRideEvent.payload.rideId));

          if (exists) {
            return current;
          }

          return [
            {
              id: latestRideEvent.payload.rideId,
              riderId: latestRideEvent.payload.riderId,
              driverId: null,
              status: latestRideEvent.payload.status || 'REQUESTED',
              fare: latestRideEvent.payload.fare,
              pickupLatitude: latestRideEvent.payload.pickupLatitude,
              pickupLongitude: latestRideEvent.payload.pickupLongitude,
              dropLatitude: latestRideEvent.payload.dropLatitude,
              dropLongitude: latestRideEvent.payload.dropLongitude,
              pickupAddress: latestRideEvent.payload.pickupAddress || null,
              dropAddress: latestRideEvent.payload.dropAddress || null,
              createdAt: latestRideEvent.payload.updatedAt || new Date().toISOString(),
            },
            ...current,
          ];
        });
      }

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

    if (latestRideEvent.type === 'ride-accepted' || latestRideEvent.type === 'ride-requested') {
      setRideRequests((current) => current.filter((ride) => String(ride.id) !== String(latestRideEvent.payload.rideId)));
    }
  }, [driver?.id, latestRideEvent]);

  const openRequests = useMemo(
    () => rideRequests.filter((ride) => String(ride.status || '').toUpperCase() === 'REQUESTED'),
    [rideRequests]
  );

  const nearbyRequests = useMemo(() => {
    const driverLatitude = Number(driver?.latitude);
    const driverLongitude = Number(driver?.longitude);

    return openRequests
      .map((ride) => ({
        ...ride,
        distanceKm: getDistanceKm(driverLatitude, driverLongitude, Number(ride.pickupLatitude), Number(ride.pickupLongitude)),
      }))
      .sort((left, right) => {
        if (left.distanceKm === null && right.distanceKm === null) return 0;
        if (left.distanceKm === null) return 1;
        if (right.distanceKm === null) return -1;
        return left.distanceKm - right.distanceKm;
      });
  }, [driver?.latitude, driver?.longitude, openRequests]);

  useEffect(() => {
    if (mapInstanceRef.current || !mapRef.current) {
      return undefined;
    }

    const map = L.map(mapRef.current, {
      zoomControl: true,
    }).setView(DEFAULT_CENTER, 12);

    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      driverMarkerRef.current = null;
      requestMarkersRef.current = [];
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) {
      return;
    }

    requestMarkersRef.current.forEach((marker) => marker.remove());
    requestMarkersRef.current = [];

    if (driverMarkerRef.current) {
      driverMarkerRef.current.remove();
      driverMarkerRef.current = null;
    }

    const validRequests = nearbyRequests.filter(
      (ride) => Number.isFinite(Number(ride.pickupLatitude)) && Number.isFinite(Number(ride.pickupLongitude))
    );

    if (driver?.latitude !== null && driver?.latitude !== undefined && driver?.longitude !== null && driver?.longitude !== undefined) {
      driverMarkerRef.current = L.marker([driver.latitude, driver.longitude], {
        title: 'Driver location',
      })
        .addTo(map)
        .bindPopup('Your current location');
    }

    validRequests.forEach((ride, index) => {
      const marker = L.marker([ride.pickupLatitude, ride.pickupLongitude], {
        title: `Ride ${ride.id}`,
      })
        .addTo(map)
        .bindPopup(
          `<strong>Ride #${ride.id}</strong><br/>${formatRequestLocation(ride)}<br/>${formatDropLocation(ride)}<br/>Fare: $${ride.fare}`
        );

      marker.on('click', () => {
        map.setView([ride.pickupLatitude, ride.pickupLongitude], Math.max(map.getZoom(), 13));
      });

      requestMarkersRef.current.push(marker);

      if (index === 0 && !driverMarkerRef.current) {
        map.setView([ride.pickupLatitude, ride.pickupLongitude], 12);
      }
    });

    if (driverMarkerRef.current && validRequests.length > 0) {
      const firstRequest = validRequests[0];
      const bounds = L.latLngBounds([
        [driver.latitude, driver.longitude],
        [firstRequest.pickupLatitude, firstRequest.pickupLongitude],
      ]);
      map.fitBounds(bounds, { padding: [40, 40] });
    } else if (validRequests.length > 0) {
      map.setView([validRequests[0].pickupLatitude, validRequests[0].pickupLongitude], 12);
    } else if (driverMarkerRef.current) {
      map.setView([driver.latitude, driver.longitude], 13);
    }
  }, [driver?.latitude, driver?.longitude, nearbyRequests]);

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
      if (socket?.connected) {
        socket.emit('driver-location-update', { latitude, longitude });
        setDriver((current) => (current ? { ...current, latitude, longitude } : current));
        return;
      }

      const response = await driverService.updateLocation(latitude, longitude);
      setDriver(response.driver);
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
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    }
  };

  const acceptRideRequest = async (rideId) => {
    setActionError('');

    try {
      const response = await rideService.acceptRide(rideId);
      const acceptedRide = response?.ride || response;
      setCurrentRide(acceptedRide);
      setRideRequests((current) => current.filter((ride) => String(ride.id) !== String(rideId)));
      navigate('/driver');
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
          loading={loading}
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

      <Card className="space-y-4">
        <div className="section-label">Nearby requests</div>
        <h3 className="text-2xl font-bold text-white">Request map</h3>
        <p className="text-sm text-slate-400">
          Nearby ride requests are plotted here so you can scan them before accepting.
        </p>

        <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="overflow-hidden rounded-3xl border border-white/5 bg-slate-950/40">
            <div ref={mapRef} className="h-[420px] w-full" />
          </div>

          <div className="grid gap-3">
            {requestsLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : nearbyRequests.length ? (
              nearbyRequests.map((ride) => (
                <div key={ride.id} className="rounded-2xl border border-white/5 bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">Ride #{ride.id}</div>
                      <div className="mt-1 text-xs text-slate-400">{formatRequestLocation(ride)}</div>
                    </div>
                    <div className="text-sm font-semibold text-cyan-300">${ride.fare}</div>
                  </div>
                  <div className="mt-3 text-xs text-slate-400">
                    {ride.distanceKm === null
                      ? 'Distance unavailable until driver location is set'
                      : `${ride.distanceKm} km away`}
                  </div>
                  <div className="mt-4 text-xs text-slate-400">
                    {driver?.isOnline ? 'Click the marker or use Accept ride to take this request.' : 'Go online to accept ride requests.'}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-sm text-slate-400">
                No nearby requests right now.
              </div>
            )}
          </div>
        </div>
      </Card>

      {actionError ? <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{actionError}</div> : null}
      <RideSummaryCard ride={currentRide} />
    </div>
  );
}
