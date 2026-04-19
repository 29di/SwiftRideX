import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CarFront, Radio, Wifi } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Card from '../components/ui/Card';
import Skeleton from '../components/ui/Skeleton';
import Button from '../components/ui/Button';
import DriverInfoCard from '../components/ride/DriverInfoCard';
import RideSummaryCard from '../components/ride/RideSummaryCard';
import { useAuth } from '../context/AuthContext';
import { useSocketRealtime } from '../hooks/useSocketRealtime';
import { getApiErrorMessage } from '../services/api';
import { formatRideId } from '../services/rideId';
import { driverService } from '../services/driverService';
import { rideService } from '../services/rideService';

const DEFAULT_CENTER = [28.6139, 77.209];
const AUTO_LOCATION_INTERVAL_MS = 8000;

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
  const { latestRideEvent, connectionStatus, socket } = useSocketRealtime();
  const [driver, setDriver] = useState(session?.user || null);
  const [currentRide, setCurrentRide] = useState(null);
  const [rideRequests, setRideRequests] = useState([]);
  const [rideHistory, setRideHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [updateNameLoading, setUpdateNameLoading] = useState(false);
  const [acceptingRideId, setAcceptingRideId] = useState(null);
  const [actionError, setActionError] = useState('');
  const hasLoadedRef = useRef(false);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const driverMarkerRef = useRef(null);
  const requestMarkersRef = useRef([]);
  const activeMapRef = useRef(null);
  const activeMapInstanceRef = useRef(null);
  const activeDriverMarkerRef = useRef(null);
  const activeTargetMarkerRef = useRef(null);
  const activeRouteLineRef = useRef(null);

  useEffect(() => {
    if (hasLoadedRef.current) {
      return;
    }

    hasLoadedRef.current = true;

    const loadDriver = async () => {
      setLoading(true);
      setRequestsLoading(true);
      setHistoryLoading(true);
      try {
        const refreshed = await refreshSession();
        setDriver(refreshed?.user || session?.user || null);

        const activeRideResponse = await rideService.getActiveRideForDriver();
        setCurrentRide(activeRideResponse?.ride || null);

        const requestResponse = await driverService.getRideRequests();
        setRideRequests(Array.isArray(requestResponse?.rides) ? requestResponse.rides : []);

        const historyResponse = await driverService.getRideHistory();
        setRideHistory(Array.isArray(historyResponse?.rides) ? historyResponse.rides : []);
      } catch (error) {
        console.error('Driver dashboard data load failed:', error);
        setDriver(session?.user || null);
      } finally {
        setLoading(false);
        setRequestsLoading(false);
        setHistoryLoading(false);
      }
    };

    loadDriver();
  }, [refreshSession, session?.user]);

  useEffect(() => {
    if (!latestRideEvent?.payload?.rideId || !driver?.id) {
      return;
    }

    const payload = latestRideEvent.payload;
    const eventRideId = String(payload.rideId);
    const payloadStatus = String(payload.status || '').toUpperCase();
    const isAssignedToCurrentDriver = payload.driverId && String(payload.driverId) === String(driver.id);
    const isRequestEvent = latestRideEvent.type === 'ride-requested';

    // Keep request queue consistent by ride id, including cancelled/accepted/completed updates
    // that may not carry a driverId for this driver.
    if (!isRequestEvent) {
      setRideRequests((current) => {
        if (payloadStatus === 'REQUESTED' && !isAssignedToCurrentDriver) {
          return current;
        }

        return current.filter((ride) => String(ride.id) !== eventRideId);
      });
    }

    if (!isAssignedToCurrentDriver) {
      if (isRequestEvent) {
        setRideRequests((current) => {
          const exists = current.some((ride) => String(ride.id) === eventRideId);

          if (exists) {
            return current;
          }

          return [
            {
              id: payload.rideId,
              riderId: payload.riderId,
              driverId: null,
              status: payload.status || 'REQUESTED',
              fare: payload.fare,
              pickupLatitude: payload.pickupLatitude,
              pickupLongitude: payload.pickupLongitude,
              dropLatitude: payload.dropLatitude,
              dropLongitude: payload.dropLongitude,
              pickupAddress: payload.pickupAddress || null,
              dropAddress: payload.dropAddress || null,
              createdAt: payload.updatedAt || new Date().toISOString(),
            },
            ...current,
          ];
        });
      }

      return;
    }

    setCurrentRide((current) => ({
      ...(current || {}),
      id: payload.rideId,
      driverId: payload.driverId,
      riderId: payload.riderId,
      status: payload.status,
      fare: payload.fare,
    }));

    if (payloadStatus === 'COMPLETED' || payloadStatus === 'CANCELLED') {
      setCurrentRide(null);
      setRideHistory((current) => {
        const exists = current.some((ride) => String(ride.id) === eventRideId);
        const normalizedRide = {
          id: payload.rideId,
          riderId: payload.riderId,
          driverId: payload.driverId,
          status: payload.status,
          fare: payload.fare,
          pickupLatitude: payload.pickupLatitude,
          pickupLongitude: payload.pickupLongitude,
          dropLatitude: payload.dropLatitude,
          dropLongitude: payload.dropLongitude,
          pickupAddress: payload.pickupAddress || null,
          dropAddress: payload.dropAddress || null,
          createdAt: payload.updatedAt || new Date().toISOString(),
        };

        if (exists) {
          return current.map((ride) => (String(ride.id) === eventRideId ? { ...ride, ...normalizedRide } : ride));
        }

        return [normalizedRide, ...current];
      });
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

  const showActiveRidePanel = !loading && Boolean(currentRide?.id);
  const showNearbyRequestsPanel = !loading && !currentRide?.id;

  useEffect(() => {
    if (!showNearbyRequestsPanel || mapInstanceRef.current || !mapRef.current) {
      return undefined;
    }

    const map = L.map(mapRef.current, {
      zoomControl: true,
    }).setView(DEFAULT_CENTER, 12);

    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    setTimeout(() => map.invalidateSize(), 0);
    setTimeout(() => map.invalidateSize(), 250);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      driverMarkerRef.current = null;
      requestMarkersRef.current = [];
    };
  }, [showNearbyRequestsPanel]);

  useEffect(() => {
    // Active ride panel is conditionally rendered, so initialize and dispose with ride visibility.
    if (!showActiveRidePanel || activeMapInstanceRef.current || !activeMapRef.current) {
      return undefined;
    }

    const map = L.map(activeMapRef.current, {
      zoomControl: true,
    }).setView(DEFAULT_CENTER, 12);

    activeMapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    // Ensure tiles are laid out after the container becomes visible.
    setTimeout(() => map.invalidateSize(), 0);
    setTimeout(() => map.invalidateSize(), 250);

    return () => {
      map.remove();
      activeMapInstanceRef.current = null;
      activeDriverMarkerRef.current = null;
      activeTargetMarkerRef.current = null;
      activeRouteLineRef.current = null;
    };
  }, [showActiveRidePanel]);

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
          `<strong>Ride #${formatRideId(ride.id)}</strong><br/>${formatRequestLocation(ride)}<br/>${formatDropLocation(ride)}<br/>Fare: $${ride.fare}`
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

  useEffect(() => {
    const map = activeMapInstanceRef.current;
    if (!map) {
      return;
    }

    map.invalidateSize();

    const driverLatitude = Number(driver?.latitude);
    const driverLongitude = Number(driver?.longitude);
    const rideStatus = String(currentRide?.status || '').toUpperCase();
    const isStarted = rideStatus === 'STARTED';

    const targetLatitude = Number(isStarted ? currentRide?.dropLatitude : currentRide?.pickupLatitude);
    const targetLongitude = Number(isStarted ? currentRide?.dropLongitude : currentRide?.pickupLongitude);

    if (activeDriverMarkerRef.current) {
      activeDriverMarkerRef.current.remove();
      activeDriverMarkerRef.current = null;
    }

    if (activeTargetMarkerRef.current) {
      activeTargetMarkerRef.current.remove();
      activeTargetMarkerRef.current = null;
    }

    if (activeRouteLineRef.current) {
      activeRouteLineRef.current.remove();
      activeRouteLineRef.current = null;
    }

    const points = [];

    if (currentRide?.id && Number.isFinite(driverLatitude) && Number.isFinite(driverLongitude)) {
      activeDriverMarkerRef.current = L.circleMarker([driverLatitude, driverLongitude], {
        radius: 9,
        color: '#22d3ee',
        fillColor: '#22d3ee',
        fillOpacity: 0.9,
      })
        .addTo(map)
        .bindPopup('Driver location');
      points.push([driverLatitude, driverLongitude]);
    }

    if (currentRide?.id && Number.isFinite(targetLatitude) && Number.isFinite(targetLongitude)) {
      activeTargetMarkerRef.current = L.circleMarker([targetLatitude, targetLongitude], {
        radius: 9,
        color: isStarted ? '#fb7185' : '#34d399',
        fillColor: isStarted ? '#fb7185' : '#34d399',
        fillOpacity: 0.9,
      })
        .addTo(map)
        .bindPopup(isStarted ? 'Destination location' : 'Rider pickup location');
      points.push([targetLatitude, targetLongitude]);
    }

    if (points.length > 1) {
      activeRouteLineRef.current = L.polyline(points, {
        color: '#22d3ee',
        weight: 4,
        opacity: 0.85,
        dashArray: '8 10',
      }).addTo(map);
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
    } else if (points.length === 1) {
      map.setView(points[0], 14);
    } else {
      map.setView(DEFAULT_CENTER, 12);
    }
  }, [currentRide?.dropLatitude, currentRide?.dropLongitude, currentRide?.id, currentRide?.pickupLatitude, currentRide?.pickupLongitude, currentRide?.status, driver?.latitude, driver?.longitude]);

  const metrics = useMemo(
    () => [
      {
        label: 'Socket status',
        value: connectionStatus === 'connected' ? 'Live' : 'Syncing',
        Icon: Wifi,
        iconClassName: connectionStatus === 'connected'
          ? 'text-emerald-300 bg-emerald-500/15 ring-emerald-300/30'
          : 'text-amber-300 bg-amber-500/15 ring-amber-300/30',
      },
      {
        label: 'Availability',
        value: driver?.isOnline ? 'Online' : 'Offline',
        Icon: Radio,
        iconClassName: driver?.isOnline
          ? 'text-cyan-300 bg-cyan-500/15 ring-cyan-300/30'
          : 'text-slate-300 bg-slate-500/15 ring-slate-300/25',
      },
      {
        label: 'Active ride',
        value: currentRide?.id ? `#${formatRideId(currentRide.id)}` : 'None',
        Icon: CarFront,
        iconClassName: currentRide?.id
          ? 'text-brand-300 bg-brand-500/15 ring-brand-300/30'
          : 'text-slate-300 bg-slate-500/15 ring-slate-300/25',
      },
    ],
    [connectionStatus, currentRide?.id, driver?.isOnline]
  );

  const riderPickupDistanceKm = useMemo(() => {
    const driverLatitude = Number(driver?.latitude);
    const driverLongitude = Number(driver?.longitude);
    const riderLatitude = Number(currentRide?.pickupLatitude);
    const riderLongitude = Number(currentRide?.pickupLongitude);

    return getDistanceKm(driverLatitude, driverLongitude, riderLatitude, riderLongitude);
  }, [currentRide?.pickupLatitude, currentRide?.pickupLongitude, driver?.latitude, driver?.longitude]);

  const canStartRideByDistance = riderPickupDistanceKm !== null && riderPickupDistanceKm <= 0.2;
  const isAcceptedRide = String(currentRide?.status || '').toUpperCase() === 'ACCEPTED';
  const isStartedRide = String(currentRide?.status || '').toUpperCase() === 'STARTED';
  const canStartRide = Boolean(currentRide?.id) && isAcceptedRide && canStartRideByDistance;

  const pushDriverLocation = useCallback(
    async (latitude, longitude, { silent = false } = {}) => {
      try {
        if (socket?.connected && currentRide?.id) {
          socket.emit('driver-location-update', { latitude, longitude });
          setDriver((current) => (current ? { ...current, latitude, longitude } : current));
          return;
        }

        const response = await driverService.updateLocation(latitude, longitude);
        setDriver(response.driver);
      } catch (error) {
        if (!silent) {
          setActionError(getApiErrorMessage(error));
        }
      }
    },
    [currentRide?.id, socket?.connected]
  );

  useEffect(() => {
    if (!currentRide?.id || !driver?.isOnline) {
      return undefined;
    }

    if (!navigator.geolocation) {
      return undefined;
    }

    let isDisposed = false;

    const syncFromCurrentPosition = () => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          if (isDisposed) {
            return;
          }

          const { latitude, longitude } = position.coords;
          await pushDriverLocation(latitude, longitude, { silent: true });
        },
        () => {
          // Silent in auto-mode to avoid noisy repeated errors.
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 5000,
        }
      );
    };

    syncFromCurrentPosition();
    const intervalId = setInterval(syncFromCurrentPosition, AUTO_LOCATION_INTERVAL_MS);

    return () => {
      isDisposed = true;
      clearInterval(intervalId);
    };
  }, [currentRide?.id, driver?.isOnline, pushDriverLocation]);

  const syncLocation = async () => {
    setActionError('');

    if (!navigator.geolocation) {
      setActionError('Geolocation is not supported in this browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          await pushDriverLocation(latitude, longitude);
        } catch (error) {
          setActionError(getApiErrorMessage(error));
        }
      },
      () => {
        setActionError('Unable to read your current location.');
      }
    );
  };

  const syncLocationSilently = useCallback(() => {
    if (!navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        await pushDriverLocation(latitude, longitude, { silent: true });
      },
      () => {
        // Silent by design for background refresh.
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      }
    );
  }, [pushDriverLocation]);

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
    setAcceptingRideId(String(rideId));

    try {
      const response = await rideService.acceptRide(rideId);
      const acceptedRide = response?.ride || response;
      setCurrentRide(acceptedRide);
      setRideRequests((current) => current.filter((ride) => String(ride.id) !== String(rideId)));
      syncLocationSilently();
      navigate('/driver');
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    } finally {
      setAcceptingRideId((current) => (current === String(rideId) ? null : current));
    }
  };

  const updateDriverName = async (name, onSuccess) => {
    setActionError('');
    setUpdateNameLoading(true);

    try {
      const response = await driverService.updateProfile({ name });
      setDriver(response?.driver || driver);
      if (typeof onSuccess === 'function') {
        onSuccess();
      }
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    } finally {
      setUpdateNameLoading(false);
    }
  };

  const activeRideLabel = String(currentRide?.status || '').toUpperCase() === 'STARTED'
    ? 'Driver to destination route'
    : 'Driver to rider pickup route';

  const startCurrentRide = async () => {
    if (!currentRide?.id) {
      return;
    }

    if (!isAcceptedRide) {
      setActionError('Ride can only be started after it is accepted.');
      return;
    }

    if (!canStartRideByDistance) {
      setActionError('Move within 200 meters of the rider before starting the ride.');
      return;
    }

    setActionError('');

    try {
      const response = await rideService.startRide(currentRide.id);
      const startedRide = response?.ride || response;
      setCurrentRide(startedRide);
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    } finally {
    }
  };

  const endCurrentRide = async () => {
    if (!currentRide?.id) {
      return;
    }

    if (!isStartedRide) {
      setActionError('Ride can only be ended after it has started.');
      return;
    }

    setActionError('');

    try {
      const response = await rideService.endRide(currentRide.id);
      const endedRide = response?.ride || response;
      setCurrentRide(endedRide);
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    } finally {
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
            <div className={`flex h-14 w-14 items-center justify-center rounded-3xl ring-1 ${metric.iconClassName}`}>
              <metric.Icon className="h-6 w-6" />
            </div>
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
          onUpdateName={updateDriverName}
          updateNameLoading={updateNameLoading}
        />

        <div className="grid gap-6">
          {currentRide?.id ? (
            <Card className="space-y-4">
              <div className="section-label">Active ride</div>
              <h3 className="text-2xl font-bold text-white">Current assignment</h3>
              <button
                type="button"
                className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-brand-400/30 hover:bg-brand-500/10"
                onClick={() => navigate(`/driver/rides/${currentRide.id}`)}
              >
                <div className="text-sm font-semibold text-white">Ride #{formatRideId(currentRide.id)}</div>
                <div className="mt-2 text-xs text-slate-300">Status: {String(currentRide.status || '').toUpperCase()}</div>
                <div className="mt-1 text-xs text-slate-400">Open detailed ride page</div>
              </button>

              <div>
                <div className="mb-2 text-xs uppercase tracking-[0.24em] text-slate-400">{activeRideLabel}</div>
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/50">
                  <div ref={activeMapRef} className="h-[260px] w-full" />
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Ride controls</div>
                <div className="mt-2 text-sm text-slate-300">
                  {isAcceptedRide
                    ? canStartRideByDistance
                      ? 'You are within 200 meters of pickup. You can start the ride.'
                      : riderPickupDistanceKm === null
                        ? 'Sync your location to check pickup distance before starting.'
                        : `Move closer to pickup to start. Current distance: ${riderPickupDistanceKm} km`
                    : isStartedRide
                      ? 'Ride has started. End it when you reach the destination.'
                      : 'Ride controls are not available for this status.'}
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  {isAcceptedRide ? (
                    <Button onClick={startCurrentRide} disabled={!canStartRide}>
                      Start ride
                    </Button>
                  ) : null}

                  {isStartedRide ? (
                    <Button variant="secondary" onClick={endCurrentRide}>
                      End ride
                    </Button>
                  ) : null}
                </div>
              </div>
            </Card>
          ) : (
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
                            <div className="text-sm font-semibold text-white">Ride #{formatRideId(ride.id)}</div>
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
                        <div className="mt-4">
                          <Button
                            onClick={() => acceptRideRequest(ride.id)}
                            disabled={!driver?.isOnline || Boolean(currentRide?.id) || acceptingRideId === String(ride.id)}
                            className="w-full"
                          >
                            {acceptingRideId === String(ride.id) ? 'Accepting ride...' : 'Accept ride'}
                          </Button>
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
          )}
        </div>
      </div>

      {currentRide?.id ? <RideSummaryCard ride={currentRide} /> : null}

      <Card className="space-y-4">
        <div className="section-label">Completed rides</div>
        <h3 className="text-2xl font-bold text-white">History</h3>
        <p className="text-sm text-slate-400">Open any completed or cancelled ride for full details.</p>

        {historyLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : rideHistory.length ? (
          <div className="grid gap-3">
            {rideHistory.map((ride) => (
              <button
                key={ride.id}
                type="button"
                onClick={() => navigate(`/driver/rides/${ride.id}`)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-brand-400/30 hover:bg-brand-500/10"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">Ride #{formatRideId(ride.id)}</div>
                    <div className="mt-1 text-xs text-slate-400">{ride.pickupAddress || 'Pickup unavailable'} → {ride.dropAddress || 'Drop unavailable'}</div>
                  </div>
                  <div className="text-xs font-semibold text-slate-300">{String(ride.status || '').toUpperCase()}</div>
                </div>
                <div className="mt-3 text-xs text-slate-400">Fare: ${ride.fare ?? '—'} · {ride.createdAt ? new Date(ride.createdAt).toLocaleString() : '—'}</div>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-sm text-slate-400">
            No completed rides yet.
          </div>
        )}
      </Card>

      {actionError ? <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{actionError}</div> : null}
    </div>
  );
}
