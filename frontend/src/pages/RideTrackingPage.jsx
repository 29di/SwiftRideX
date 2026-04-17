import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Skeleton from '../components/ui/Skeleton';
import { useSocketRealtime } from '../hooks/useSocketRealtime';
import { rideService } from '../services/rideService';

const ACTIVE_RIDE_KEY = 'swiftridex_active_ride';
const DEFAULT_CENTER = [28.6139, 77.209];
const AVG_CITY_SPEED_KMPH = 28;
const MOCK_ROUTE_STEPS = 30;
const MOCK_ROUTE_INTERVAL_MS = 800;
const ROUTE_SERVICE_URL = 'https://router.project-osrm.org/route/v1/driving';

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
  const { latestRideEvent, events } = useSocketRealtime();
  const [ride, setRide] = useState(() => readRide());
  const [loading, setLoading] = useState(true);
  const [cancelRideLoading, setCancelRideLoading] = useState(false);
  const [isMockingRoute, setIsMockingRoute] = useState(false);
  const [mockProgressPercent, setMockProgressPercent] = useState(0);
  const [mockError, setMockError] = useState('');
  const [routeLinePoints, setRouteLinePoints] = useState([]);
  const [routeMetrics, setRouteMetrics] = useState({ distanceKm: null, durationMinutes: null });
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
  const mockIntervalRef = useRef(null);
  const isMockingRef = useRef(false);

  const latestDriverLocationEvent = useMemo(
    () => events.find((eventItem) => eventItem.name === 'driver-location-updated') || null,
    [events]
  );

  const rideStatus = String(ride?.status || '').toUpperCase();
  const isRideStarted = rideStatus === 'STARTED' || rideStatus === 'COMPLETED';
  const canCancelRide = rideStatus === 'REQUESTED' || rideStatus === 'ACCEPTED';

  const dropLocation = useMemo(() => {
    const lat = toFiniteNumber(ride?.dropLatitude);
    const lng = toFiniteNumber(ride?.dropLongitude);

    if (lat === null || lng === null) {
      return null;
    }

    return { lat, lng };
  }, [ride?.dropLatitude, ride?.dropLongitude]);

  const mapTargetLocation = isRideStarted ? dropLocation : driverLocation;

  const mockSourceLocation = useMemo(() => {
    const pickupLat = toFiniteNumber(ride?.pickupLatitude);
    const pickupLng = toFiniteNumber(ride?.pickupLongitude);

    if (pickupLat !== null && pickupLng !== null) {
      return { lat: pickupLat, lng: pickupLng };
    }

    if (Number.isFinite(riderLocation?.lat) && Number.isFinite(riderLocation?.lng)) {
      return { lat: riderLocation.lat, lng: riderLocation.lng };
    }

    return null;
  }, [ride?.pickupLatitude, ride?.pickupLongitude, riderLocation?.lat, riderLocation?.lng]);

  const mockDestinationLocation = dropLocation;
  const canMockRoute = Boolean(mockSourceLocation && mockDestinationLocation);

  const trackingDistanceKm = useMemo(() => {
    if (!mapTargetLocation) {
      return null;
    }

    return getDistanceKm(riderLocation?.lat, riderLocation?.lng, mapTargetLocation.lat, mapTargetLocation.lng);
  }, [mapTargetLocation, riderLocation?.lat, riderLocation?.lng]);

  const etaMinutes = useMemo(() => getEtaMinutes(trackingDistanceKm), [trackingDistanceKm]);
  const displayDistanceKm = routeMetrics.distanceKm ?? trackingDistanceKm;
  const displayEtaMinutes = routeMetrics.durationMinutes ?? etaMinutes;
  const fromLabel = useMemo(
    () => formatRoutePoint(ride?.pickupAddress, ride?.pickupLatitude, ride?.pickupLongitude, 'Pickup unavailable'),
    [ride?.pickupAddress, ride?.pickupLatitude, ride?.pickupLongitude]
  );
  const toLabel = useMemo(
    () => formatRoutePoint(ride?.dropAddress, ride?.dropLatitude, ride?.dropLongitude, 'Drop unavailable'),
    [ride?.dropAddress, ride?.dropLatitude, ride?.dropLongitude]
  );

  const stopMockRoute = useCallback((completed = false) => {
    if (mockIntervalRef.current) {
      clearInterval(mockIntervalRef.current);
      mockIntervalRef.current = null;
    }

    isMockingRef.current = false;
    setIsMockingRoute(false);

    if (completed) {
      setMockProgressPercent(100);
    }
  }, []);

  const handleCancelRide = async () => {
    if (!ride?.id || !canCancelRide) {
      return;
    }

    setCancelRideLoading(true);
    try {
      const response = await rideService.cancelRide(ride.id);
      const cancelledRide = response?.ride || null;

      if (cancelledRide) {
        setRide(cancelledRide);
      }

      localStorage.removeItem(ACTIVE_RIDE_KEY);
      stopMockRoute();
    } catch (error) {
      setMockError(error?.message || 'Unable to cancel ride right now.');
    } finally {
      setCancelRideLoading(false);
    }
  };

  const startMockRoute = useCallback(() => {
    if (!mockSourceLocation || !mockDestinationLocation) {
      setMockError('Mock route needs valid source and destination coordinates.');
      return;
    }

    setMockError('');
    stopMockRoute();

    isMockingRef.current = true;
    setIsMockingRoute(true);
    setMockProgressPercent(0);
    setRiderLocation({
      lat: mockSourceLocation.lat,
      lng: mockSourceLocation.lng,
      source: 'mock',
      updatedAt: new Date().toISOString(),
    });

    let step = 0;
    const deltaLat = mockDestinationLocation.lat - mockSourceLocation.lat;
    const deltaLng = mockDestinationLocation.lng - mockSourceLocation.lng;

    mockIntervalRef.current = setInterval(() => {
      step += 1;
      const progress = Math.min(step / MOCK_ROUTE_STEPS, 1);

      setRiderLocation({
        lat: mockSourceLocation.lat + deltaLat * progress,
        lng: mockSourceLocation.lng + deltaLng * progress,
        source: 'mock',
        updatedAt: new Date().toISOString(),
      });
      setMockProgressPercent(Math.round(progress * 100));

      if (progress >= 1) {
        stopMockRoute(true);
      }
    }, MOCK_ROUTE_INTERVAL_MS);
  }, [mockDestinationLocation, mockSourceLocation, stopMockRoute]);

  useEffect(() => {
    isMockingRef.current = isMockingRoute;
  }, [isMockingRoute]);

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

    const payloadRideId = latestDriverLocationEvent.payload.rideId;
    if (!ride?.id || !payloadRideId || String(payloadRideId) !== String(ride.id)) {
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
        if (isMockingRef.current) {
          return;
        }

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

  useEffect(() => () => stopMockRoute(), [stopMockRoute]);

  useEffect(() => {
    const hasRiderCoords = Number.isFinite(riderLocation?.lat) && Number.isFinite(riderLocation?.lng);
    const hasTargetCoords = Number.isFinite(mapTargetLocation?.lat) && Number.isFinite(mapTargetLocation?.lng);

    if (!hasRiderCoords || !hasTargetCoords) {
      setRouteLinePoints([]);
      setRouteMetrics({ distanceKm: null, durationMinutes: null });
      return undefined;
    }

    const abortController = new AbortController();
    const source = `${riderLocation.lng},${riderLocation.lat}`;
    const destination = `${mapTargetLocation.lng},${mapTargetLocation.lat}`;

    fetch(`${ROUTE_SERVICE_URL}/${source};${destination}?overview=full&geometries=geojson`, {
      signal: abortController.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Route request failed');
        }
        return response.json();
      })
      .then((payload) => {
        const bestRoute = Array.isArray(payload?.routes) ? payload.routes[0] : null;
        const coordinates = Array.isArray(bestRoute?.geometry?.coordinates) ? bestRoute.geometry.coordinates : [];

        if (coordinates.length < 2) {
          setRouteLinePoints([]);
          setRouteMetrics({ distanceKm: null, durationMinutes: null });
          return;
        }

        setRouteLinePoints(coordinates.map(([lng, lat]) => [Number(lat), Number(lng)]));
        setRouteMetrics({
          distanceKm: Number.isFinite(bestRoute?.distance) ? Number((bestRoute.distance / 1000).toFixed(2)) : null,
          durationMinutes: Number.isFinite(bestRoute?.duration) ? Math.max(1, Math.round(bestRoute.duration / 60)) : null,
        });
      })
      .catch((error) => {
        if (error?.name === 'AbortError') {
          return;
        }

        setRouteLinePoints([]);
        setRouteMetrics({ distanceKm: null, durationMinutes: null });
      });

    return () => abortController.abort();
  }, [mapTargetLocation?.lat, mapTargetLocation?.lng, riderLocation?.lat, riderLocation?.lng]);

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
    const hasTargetCoords = Number.isFinite(mapTargetLocation?.lat) && Number.isFinite(mapTargetLocation?.lng);
    const targetLabel = isRideStarted ? 'Drop location' : 'Driver location';
    const targetColor = isRideStarted ? '#fb7185' : '#34d399';

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

    if (hasTargetCoords) {
      driverMarkerRef.current = L.circleMarker([mapTargetLocation.lat, mapTargetLocation.lng], {
        radius: 9,
        color: targetColor,
        weight: 2,
        fillColor: targetColor,
        fillOpacity: 0.9,
      })
        .addTo(map)
        .bindPopup(targetLabel);
      points.push([mapTargetLocation.lat, mapTargetLocation.lng]);
    }

    if (routeLinePoints.length > 1) {
      pathLineRef.current = L.polyline(routeLinePoints, {
        color: '#22d3ee',
        weight: 4,
        opacity: 0.85,
      }).addTo(map);
    } else if (hasRiderCoords && hasTargetCoords) {
      pathLineRef.current = L.polyline(
        [
          [riderLocation.lat, riderLocation.lng],
          [mapTargetLocation.lat, mapTargetLocation.lng],
        ],
        {
          color: '#22d3ee',
          weight: 4,
          opacity: 0.8,
          dashArray: '8 10',
        }
      ).addTo(map);
    }

    if (routeLinePoints.length > 1) {
      map.fitBounds(L.latLngBounds(routeLinePoints), { padding: [40, 40] });
    } else if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
    } else if (points.length === 1) {
      map.setView(points[0], 14);
    } else {
      map.setView(DEFAULT_CENTER, 12);
    }
  }, [isRideStarted, mapTargetLocation?.lat, mapTargetLocation?.lng, riderLocation?.lat, riderLocation?.lng, routeLinePoints]);

  if (loading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (!ride?.id) {
    return (
      <Card className="space-y-4">
        <div className="section-label">Tracking</div>
        <h3 className="text-2xl font-bold text-white">No active ride to track</h3>
        <p className="text-sm text-slate-400">Start a ride from the rider dashboard and come back here for live route tracking.</p>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
      <div className="grid gap-6">
        <Card>
          <div className="section-label">Live map</div>
          <h3 className="mt-2 text-2xl font-bold text-white">{isRideStarted ? 'Rider to destination tracking' : 'Rider to driver tracking'}</h3>
          <p className="mt-2 text-sm text-slate-400">
            {isRideStarted
              ? 'Ride has started. Route now tracks your live position to the drop destination.'
              : 'Your location and driver position update in real time when location events are available.'}
          </p>
          <div ref={mapRef} className="mt-5 h-[430px] w-full overflow-hidden rounded-2xl border border-white/10" />
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
              <span className="text-slate-400">{isRideStarted ? 'Remaining distance:' : 'Driver distance:'}</span> {formatDistance(displayDistanceKm)}
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <span className="text-slate-400">ETA (approx):</span> {formatEta(displayEtaMinutes)}
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

            <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 p-3">
              <div className="text-xs uppercase tracking-[0.24em] text-cyan-200">Testing controls</div>
              <div className="mt-2 text-xs text-slate-300">
                Mock rider movement from source to destination coordinates for map testing.
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="secondary" onClick={startMockRoute} disabled={isMockingRoute || !canMockRoute}>
                  Start Mock Route
                </Button>
                <Button variant="secondary" onClick={() => stopMockRoute()} disabled={!isMockingRoute}>
                  Stop Mock
                </Button>
              </div>
              <div className="mt-2 text-xs text-slate-300">Mock progress: {mockProgressPercent}%</div>
              {mockError ? <div className="mt-2 text-xs text-rose-300">{mockError}</div> : null}
            </div>

            <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-3">
              <div className="text-xs uppercase tracking-[0.24em] text-rose-200">Ride controls</div>
              <div className="mt-2 text-xs text-slate-300">You can cancel only while ride is in REQUESTED or ACCEPTED state.</div>
              <div className="mt-3">
                <Button
                  variant="secondary"
                  onClick={handleCancelRide}
                  disabled={!canCancelRide || cancelRideLoading}
                >
                  {cancelRideLoading ? 'Cancelling ride...' : 'Cancel Ride'}
                </Button>
              </div>
            </div>
          </div>
        </Card>

      </div>
    </div>
  );
}
