import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Skeleton from '../components/ui/Skeleton';
import RideTimeline from '../components/ride/RideTimeline';
import { useSocketRealtime } from '../hooks/useSocketRealtime';
import { rideService } from '../services/rideService';

const ACTIVE_RIDE_KEY = 'swiftridex_active_ride';
const DEFAULT_CENTER = [28.6139, 77.209];
const AVG_CITY_SPEED_KMPH = 28;

const readRide = () => {
  try {
    const raw = localStorage.getItem(ACTIVE_RIDE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const toFiniteNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

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

const formatDistance = (distanceKm) => (distanceKm === null ? 'Waiting for live location' : `${distanceKm.toFixed(2)} km`);

const getEtaMinutes = (distanceKm) => {
  if (distanceKm === null) {
    return null;
  }

  return Math.max(1, Math.round((distanceKm / AVG_CITY_SPEED_KMPH) * 60));
};

const formatEta = (etaMinutes) => {
  if (etaMinutes === null) {
    return 'Waiting for live location';
  }

  if (etaMinutes < 60) {
    return `${etaMinutes} min`;
  }

  const hours = Math.floor(etaMinutes / 60);
  const minutes = etaMinutes % 60;
  return `${hours}h ${minutes}m`;
};

const formatCoordinates = (lat, lng) => {
  const normalizedLat = toFiniteNumber(lat);
  const normalizedLng = toFiniteNumber(lng);

  if (normalizedLat === null || normalizedLng === null) {
    return null;
  }

  return `${normalizedLat.toFixed(5)}, ${normalizedLng.toFixed(5)}`;
};

const formatRoutePoint = (address, lat, lng, fallbackLabel) => {
  if (address) {
    return address;
  }

  const coordinates = formatCoordinates(lat, lng);
  if (coordinates) {
    return coordinates;
  }

  return fallbackLabel;
};

export default function RideTrackingPage() {
  const navigate = useNavigate();
  const { latestRideEvent, events } = useSocketRealtime();
  const [ride, setRide] = useState(() => readRide());
  const [loading, setLoading] = useState(true);
  const [riderLocation, setRiderLocation] = useState(() => {
    const storedRide = readRide();
    return {
      lat: toFiniteNumber(storedRide?.pickupLatitude),
      lng: toFiniteNumber(storedRide?.pickupLongitude),
      source: 'pickup',
      updatedAt: null,
    };
  });
  const [driverLocation, setDriverLocation] = useState(() => {
    const storedRide = readRide();
    const lat = toFiniteNumber(storedRide?.driver?.latitude);
    const lng = toFiniteNumber(storedRide?.driver?.longitude);

    if (lat === null || lng === null) {
      return null;
    }

    return {
      lat,
      lng,
      updatedAt: storedRide?.updatedAt || null,
    };
  });
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const riderMarkerRef = useRef(null);
  const driverMarkerRef = useRef(null);
  const pathLineRef = useRef(null);

  const latestDriverLocationEvent = useMemo(
    () => events.find((eventItem) => eventItem.name === 'driver-location-updated') || null,
    [events]
  );

  const riderToDriverDistanceKm = useMemo(() => {
    if (!driverLocation) {
      return null;
    }

    return getDistanceKm(riderLocation?.lat, riderLocation?.lng, driverLocation.lat, driverLocation.lng);
  }, [driverLocation, riderLocation?.lat, riderLocation?.lng]);

  const etaMinutes = useMemo(() => getEtaMinutes(riderToDriverDistanceKm), [riderToDriverDistanceKm]);
  const fromLabel = useMemo(
    () => formatRoutePoint(ride?.pickupAddress, ride?.pickupLatitude, ride?.pickupLongitude, 'Pickup unavailable'),
    [ride?.pickupAddress, ride?.pickupLatitude, ride?.pickupLongitude]
  );
  const toLabel = useMemo(
    () => formatRoutePoint(ride?.dropAddress, ride?.dropLatitude, ride?.dropLongitude, 'Drop unavailable'),
    [ride?.dropAddress, ride?.dropLatitude, ride?.dropLongitude]
  );

  useEffect(() => {
    const loadRide = async () => {
      const storedRide = readRide();

      if (storedRide?.id) {
        try {
          const response = await rideService.getRide(storedRide.id);
          setRide(response.ride);
          localStorage.setItem(ACTIVE_RIDE_KEY, JSON.stringify(response.ride));

          const pickupLat = toFiniteNumber(response?.ride?.pickupLatitude);
          const pickupLng = toFiniteNumber(response?.ride?.pickupLongitude);
          if (pickupLat !== null && pickupLng !== null) {
            setRiderLocation({ lat: pickupLat, lng: pickupLng, source: 'pickup', updatedAt: response?.ride?.updatedAt || null });
          }

          const driverLat = toFiniteNumber(response?.ride?.driver?.latitude);
          const driverLng = toFiniteNumber(response?.ride?.driver?.longitude);
          if (driverLat !== null && driverLng !== null) {
            setDriverLocation({ lat: driverLat, lng: driverLng, updatedAt: response?.ride?.updatedAt || null });
          }
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

  useEffect(() => {
    if (!latestDriverLocationEvent?.payload) {
      return;
    }

    const payloadDriverId = latestDriverLocationEvent.payload.driverId;
    const rideDriverId = ride?.driverId || ride?.driver?.id;

    if (rideDriverId && payloadDriverId && String(payloadDriverId) !== String(rideDriverId)) {
      return;
    }

    const latitude = toFiniteNumber(latestDriverLocationEvent.payload.latitude);
    const longitude = toFiniteNumber(latestDriverLocationEvent.payload.longitude);

    if (latitude === null || longitude === null) {
      return;
    }

    setDriverLocation({
      lat: latitude,
      lng: longitude,
      updatedAt: latestDriverLocationEvent.payload.updatedAt || new Date().toISOString(),
    });
  }, [latestDriverLocationEvent, ride?.driver?.id, ride?.driverId]);

  useEffect(() => {
    if (!navigator.geolocation) {
      return undefined;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setRiderLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          source: 'live',
          updatedAt: new Date(position.timestamp).toISOString(),
        });
      },
      () => {
        // Keep fallback pickup coordinates if browser location fails.
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    if (loading) {
      return undefined;
    }

    if (mapInstanceRef.current || !mapRef.current) {
      return undefined;
    }

    const map = L.map(mapRef.current, {
      zoomControl: true,
    }).setView(DEFAULT_CENTER, 13);

    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      riderMarkerRef.current = null;
      driverMarkerRef.current = null;
      pathLineRef.current = null;
    };
  }, [loading]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) {
      return;
    }

    const hasRiderCoords = Number.isFinite(riderLocation?.lat) && Number.isFinite(riderLocation?.lng);
    const hasDriverCoords = Number.isFinite(driverLocation?.lat) && Number.isFinite(driverLocation?.lng);

    if (riderMarkerRef.current) {
      riderMarkerRef.current.remove();
      riderMarkerRef.current = null;
    }

    if (driverMarkerRef.current) {
      driverMarkerRef.current.remove();
      driverMarkerRef.current = null;
    }

    if (pathLineRef.current) {
      pathLineRef.current.remove();
      pathLineRef.current = null;
    }

    const points = [];

    if (hasRiderCoords) {
      riderMarkerRef.current = L.circleMarker([riderLocation.lat, riderLocation.lng], {
        radius: 9,
        color: '#22d3ee',
        weight: 2,
        fillColor: '#22d3ee',
        fillOpacity: 0.9,
      })
        .addTo(map)
        .bindPopup('Your location');
      points.push([riderLocation.lat, riderLocation.lng]);
    }

    if (hasDriverCoords) {
      driverMarkerRef.current = L.circleMarker([driverLocation.lat, driverLocation.lng], {
        radius: 9,
        color: '#34d399',
        weight: 2,
        fillColor: '#34d399',
        fillOpacity: 0.9,
      })
        .addTo(map)
        .bindPopup('Driver location');
      points.push([driverLocation.lat, driverLocation.lng]);
    }

    if (hasRiderCoords && hasDriverCoords) {
      pathLineRef.current = L.polyline(
        [
          [riderLocation.lat, riderLocation.lng],
          [driverLocation.lat, driverLocation.lng],
        ],
        {
          color: '#22d3ee',
          weight: 4,
          opacity: 0.8,
          dashArray: '8 10',
        }
      ).addTo(map);
    }

    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
    } else if (points.length === 1) {
      map.setView(points[0], 14);
    } else {
      map.setView(DEFAULT_CENTER, 12);
    }
  }, [driverLocation?.lat, driverLocation?.lng, riderLocation?.lat, riderLocation?.lng]);

  if (loading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (!ride?.id) {
    return (
      <Card className="space-y-4">
        <div className="section-label">Tracking</div>
        <h3 className="text-2xl font-bold text-white">No active ride to track</h3>
        <p className="text-sm text-slate-400">Start a ride from the rider dashboard and come back here for live route tracking.</p>
        <div>
          <Button variant="secondary" onClick={() => navigate('/rider')}>Back to dashboard</Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
      <div className="grid gap-6">
        <Card>
          <div className="section-label">Live map</div>
          <h3 className="mt-2 text-2xl font-bold text-white">Rider to driver tracking</h3>
          <p className="mt-2 text-sm text-slate-400">Your location and driver position update in real time when location events are available.</p>
          <div ref={mapRef} className="mt-5 h-[430px] w-full overflow-hidden rounded-2xl border border-white/10" />
        </Card>

        <Card>
          <div className="section-label">Ride progress</div>
          <h3 className="mt-2 text-2xl font-bold text-white">Status timeline</h3>
          <div className="mt-5">
            <RideTimeline status={ride.status || 'REQUESTED'} />
          </div>
        </Card>
      </div>

      <div className="grid gap-6">
        <Card>
          <div className="section-label">Live metrics</div>
          <h3 className="mt-2 text-2xl font-bold text-white">Arrival estimate</h3>
          <div className="mt-4 grid gap-3 text-sm text-slate-300">
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <span className="text-slate-400">Ride status:</span> {ride.status || 'REQUESTED'}
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <span className="text-slate-400">Driver distance:</span> {formatDistance(riderToDriverDistanceKm)}
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <span className="text-slate-400">ETA (approx):</span> {formatEta(etaMinutes)}
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <span className="text-slate-400">From:</span> {fromLabel}
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <span className="text-slate-400">To:</span> {toLabel}
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <span className="text-slate-400">Driver location updated:</span>{' '}
              {driverLocation?.updatedAt ? new Date(driverLocation.updatedAt).toLocaleTimeString() : 'Waiting for update'}
            </div>
          </div>
        </Card>

        <Button variant="secondary" onClick={() => navigate('/rider')}>Back to dashboard</Button>
      </div>
    </div>
  );
}
