import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { createRiderSocket } from '../socket/socket';
import { formatRideId } from '../services/rideId';
import { rideService } from '../services/rideService';

const STATUS_STYLES = {
  REQUESTED: 'border-slate-500/50 bg-slate-500/10 text-slate-300',
  ACCEPTED: 'border-sky-400/40 bg-sky-400/10 text-sky-300',
  STARTED: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
  COMPLETED: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300',
};

function StatusBadge({ status }) {
  const normalized = String(status || 'REQUESTED').toUpperCase();
  const style = STATUS_STYLES[normalized] || STATUS_STYLES.REQUESTED;

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.12em] ${style}`}>
      {normalized}
    </span>
  );
}

function Card({ title, children }) {
  return (
    <section className="rounded-2xl border border-slate-700/60 bg-slate-800/90 p-6 shadow-xl shadow-slate-950/30 transition duration-300 hover:-translate-y-0.5 hover:shadow-cyan-950/40">
      <h2 className="mb-4 text-lg font-semibold text-slate-100">{title}</h2>
      {children}
    </section>
  );
}

function Spinner() {
  return <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300/30 border-t-cyan-300" />;
}

const DEFAULT_CENTER = [28.6139, 77.209];
const LOCATION_QUERY_MIN_LENGTH = 3;

const createLocationState = () => ({
  address: '',
  lat: null,
  lng: null,
});

const createSuggestionState = () => ({
  items: [],
  loading: false,
  error: '',
});

const useDebouncedValue = (value, delay = 350) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timeoutId);
  }, [delay, value]);

  return debouncedValue;
};

const geocodeLocation = async (query) => {
  const trimmedQuery = String(query || '').trim();

  if (!trimmedQuery) {
    throw new Error('Enter a location first');
  }

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(trimmedQuery)}`,
    {
      headers: {
        Accept: 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error('Location lookup failed');
  }

  const data = await response.json();
  const match = data?.[0];

  if (!match) {
    throw new Error(`Could not find coordinates for "${trimmedQuery}"`);
  }

  return {
    address: match.display_name || trimmedQuery,
    lat: Number(match.lat),
    lng: Number(match.lon),
  };
};

const searchLocations = async (query, signal) => {
  const trimmedQuery = String(query || '').trim();

  if (!trimmedQuery) {
    return [];
  }

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=${encodeURIComponent(trimmedQuery)}`,
    {
      signal,
      headers: {
        Accept: 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error('Location search failed');
  }

  const data = await response.json();

  return Array.isArray(data)
    ? data.map((item) => ({
        address: item.display_name,
        lat: Number(item.lat),
        lng: Number(item.lon),
      }))
    : [];
};

const reverseGeocode = async (latitude, longitude) => {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
    {
      headers: {
        Accept: 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error('Location reverse lookup failed');
  }

  const data = await response.json();

  return data?.display_name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
};

export default function Dashboard() {
  const ACTIVE_RIDE_KEY = 'swiftridex_active_ride';
  const navigate = useNavigate();
  const socketRef = useRef(null);
  const mapRef = useRef(null);
  const pickupMarkerRef = useRef(null);
  const dropMarkerRef = useRef(null);
  const pickupCircleRef = useRef(null);
  const dropCircleRef = useRef(null);
  const rideIdRef = useRef('');
  const driverIdRef = useRef('');
  const rideStatusRef = useRef('REQUESTED');
  const pickupLocationRef = useRef(createLocationState());
  const dropLocationRef = useRef(createLocationState());
  const activePinRef = useRef('pickup');
  const pickupSearchAbortRef = useRef(null);
  const dropSearchAbortRef = useRef(null);
  const initialRideHydratedRef = useRef(false);
  const [pickupLocation, setPickupLocation] = useState(createLocationState());
  const [dropLocation, setDropLocation] = useState(createLocationState());
  const [activePin, setActivePin] = useState('pickup');
  const [pickupInput, setPickupInput] = useState('');
  const [dropInput, setDropInput] = useState('');
  const debouncedPickupInput = useDebouncedValue(pickupInput);
  const debouncedDropInput = useDebouncedValue(dropInput);
  const [pickupSuggestions, setPickupSuggestions] = useState(createSuggestionState());
  const [dropSuggestions, setDropSuggestions] = useState(createSuggestionState());
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState({ pickup: -1, drop: -1 });
  const [rideStatus, setRideStatus] = useState('REQUESTED');
  const [rideId, setRideId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [ride, setRide] = useState(null);
  const [requestMessage, setRequestMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [requestLoading, setRequestLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [pickupLookupLoading, setPickupLookupLoading] = useState(false);
  const [dropLookupLoading, setDropLookupLoading] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);

  const userEmail = localStorage.getItem('swiftridex_user_email') || 'rider@swiftridex.com';
  const resolvedDriverName = ride?.driver?.name || (ride?.driverId || driverId ? 'Assigned driver' : '-');

  const resetSuggestions = (field) => {
    if (field === 'pickup') {
      setPickupSuggestions(createSuggestionState());
      setActiveSuggestionIndex((current) => ({ ...current, pickup: -1 }));
      return;
    }

    setDropSuggestions(createSuggestionState());
    setActiveSuggestionIndex((current) => ({ ...current, drop: -1 }));
  };

  const selectLocation = (field, location) => {
    const normalizedLocation = {
      address: location.address,
      lat: location.lat,
      lng: location.lng,
    };

    if (field === 'pickup') {
      setPickupInput(location.address);
      setPickupLocation(normalizedLocation);
      pickupLocationRef.current = normalizedLocation;
      resetSuggestions('pickup');
      updateMapMarkers(normalizedLocation, dropLocationRef.current);
      mapRef.current?.setView([location.lat, location.lng], 13);
      return;
    }

    setDropInput(location.address);
    setDropLocation(normalizedLocation);
    dropLocationRef.current = normalizedLocation;
    resetSuggestions('drop');
    updateMapMarkers(pickupLocationRef.current, normalizedLocation);
    mapRef.current?.setView([location.lat, location.lng], 13);
  };

  const handleLocationKeyDown = (field, event) => {
    const suggestions = field === 'pickup' ? pickupSuggestions.items : dropSuggestions.items;
    const activeIndex = activeSuggestionIndex[field];

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!suggestions.length) return;
      setActiveSuggestionIndex((current) => ({
        ...current,
        [field]: Math.min((current[field] ?? -1) + 1, suggestions.length - 1),
      }));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!suggestions.length) return;
      setActiveSuggestionIndex((current) => ({
        ...current,
        [field]: Math.max((current[field] ?? 0) - 1, -1),
      }));
      return;
    }

    if (event.key === 'Enter' && activeIndex >= 0 && suggestions[activeIndex]) {
      event.preventDefault();
      selectLocation(field, suggestions[activeIndex]);
    }

    if (event.key === 'Escape') {
      resetSuggestions(field);
    }
  };

  const renderSuggestions = (field) => {
    const suggestionState = field === 'pickup' ? pickupSuggestions : dropSuggestions;
    const suggestions = suggestionState.items;
    const activeIndex = activeSuggestionIndex[field];

    if (!suggestionState.loading && !suggestionState.error && !suggestions.length && !((field === 'pickup' ? pickupInput : dropInput).trim())) {
      return null;
    }

    return (
      <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/95 shadow-2xl shadow-slate-950/50 backdrop-blur">
        {suggestionState.loading ? (
          <div className="flex items-center gap-3 px-4 py-3 text-sm text-slate-300">
            <Spinner />
            Searching locations...
          </div>
        ) : suggestionState.error ? (
          <div className="px-4 py-3 text-sm text-rose-300">{suggestionState.error}</div>
        ) : suggestions.length ? (
          <ul className="max-h-72 overflow-auto py-2">
            {suggestions.map((item, index) => (
              <li key={`${item.address}-${item.lat}-${item.lng}`}>
                <button
                  type="button"
                  onMouseEnter={() =>
                    setActiveSuggestionIndex((current) => ({
                      ...current,
                      [field]: index,
                    }))
                  }
                  onClick={() => selectLocation(field, item)}
                  className={`w-full px-4 py-3 text-left text-sm transition duration-200 ${
                    activeIndex === index
                      ? 'bg-cyan-500/15 text-cyan-100'
                      : 'text-slate-200 hover:bg-slate-800/80 hover:text-white'
                  }`}
                >
                  <div className="font-medium leading-5">{item.address}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    {item.lat.toFixed(5)}, {item.lng.toFixed(5)}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-4 py-3 text-sm text-slate-400">No results</div>
        )}
      </div>
    );
  };

  const updateMapMarkers = (nextPickup = pickupLocation, nextDrop = dropLocation) => {
    if (!mapRef.current) {
      return;
    }

    if (pickupMarkerRef.current) {
      pickupMarkerRef.current.remove();
      pickupMarkerRef.current = null;
    }

    if (dropMarkerRef.current) {
      dropMarkerRef.current.remove();
      dropMarkerRef.current = null;
    }

    if (pickupCircleRef.current) {
      pickupCircleRef.current.remove();
      pickupCircleRef.current = null;
    }

    if (dropCircleRef.current) {
      dropCircleRef.current.remove();
      dropCircleRef.current = null;
    }

    if (nextPickup.lat && nextPickup.lng) {
      pickupMarkerRef.current = L.marker([nextPickup.lat, nextPickup.lng], {
        title: 'Pickup location',
      })
        .addTo(mapRef.current)
        .bindPopup(`Pickup: ${nextPickup.address || 'Selected location'}`);

      pickupCircleRef.current = L.circle([nextPickup.lat, nextPickup.lng], {
        radius: 90,
        color: '#38BDF8',
        fillColor: '#38BDF8',
        fillOpacity: 0.18,
      }).addTo(mapRef.current);
    }

    if (nextDrop.lat && nextDrop.lng) {
      dropMarkerRef.current = L.marker([nextDrop.lat, nextDrop.lng], {
        title: 'Drop location',
      })
        .addTo(mapRef.current)
        .bindPopup(`Drop: ${nextDrop.address || 'Selected location'}`);

      dropCircleRef.current = L.circle([nextDrop.lat, nextDrop.lng], {
        radius: 90,
        color: '#22C55E',
        fillColor: '#22C55E',
        fillOpacity: 0.16,
      }).addTo(mapRef.current);
    }
  };

  const handleMapClick = async (event) => {
    const { lat, lng } = event.latlng;
    const label = await reverseGeocode(lat, lng);
    const nextLocation = {
      address: label,
      lat,
      lng,
    };

    if (activePinRef.current === 'drop') {
      setDropInput(label);
      setDropLocation(nextLocation);
      dropLocationRef.current = nextLocation;
      setDropLookupLoading(false);
      updateMapMarkers(pickupLocationRef.current, nextLocation);
      return;
    }

    setPickupInput(label);
    setPickupLocation(nextLocation);
    pickupLocationRef.current = nextLocation;
    setPickupLookupLoading(false);
    updateMapMarkers(nextLocation, dropLocationRef.current);
  };

  const focusFieldOnMap = (field) => {
    activePinRef.current = field;
    setActivePin(field);
    resetSuggestions(field);
    setRequestMessage('');
    setErrorMessage('');
  };

  const handleLogout = () => {
    localStorage.removeItem('swiftridex_token');
    localStorage.removeItem('swiftridex_user_email');
    localStorage.removeItem('swiftridex_user_id');
    localStorage.removeItem('swiftridex_user_role');
    localStorage.removeItem('swiftridex_session');
    localStorage.removeItem(ACTIVE_RIDE_KEY);
    navigate('/login', { replace: true });
  };

  const applyRideUpdate = (payload, fallbackStatus) => {
    const nextStatus = String(payload?.status || fallbackStatus || rideStatusRef.current || 'REQUESTED').toUpperCase();
    const nextRideId = payload?.rideId ? String(payload.rideId) : rideIdRef.current;
    const nextDriverId = payload?.driverId ? String(payload.driverId) : driverIdRef.current;

    setRide((current) => ({
      ...(current || {}),
      id: nextRideId || current?.id || null,
      status: nextStatus,
      driverId: nextDriverId || current?.driverId || null,
    }));

    setRideStatus(nextStatus);
    rideStatusRef.current = nextStatus;

    if (nextRideId) {
      setRideId(nextRideId);
      rideIdRef.current = nextRideId;
    }

    if (nextDriverId) {
      setDriverId(nextDriverId);
      driverIdRef.current = nextDriverId;
    }

    if (nextStatus === 'COMPLETED') {
      localStorage.removeItem(ACTIVE_RIDE_KEY);
      setRideId('');
      rideIdRef.current = '';
    }
  };

  useEffect(() => {
    if (mapRef.current || !document.getElementById('ride-map')) {
      return undefined;
    }

    const map = L.map('ride-map', {
      zoomControl: true,
    }).setView(DEFAULT_CENTER, 13);

    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    map.on('click', handleMapClick);

    updateMapMarkers();

    return () => {
      map.off('click', handleMapClick);
      map.remove();
      mapRef.current = null;
      pickupMarkerRef.current = null;
      dropMarkerRef.current = null;
      pickupCircleRef.current = null;
      dropCircleRef.current = null;
    };
  }, []);

  useEffect(() => {
    updateMapMarkers();
  }, [pickupLocation, dropLocation]);

  useEffect(() => {
    pickupLocationRef.current = pickupLocation;
  }, [pickupLocation]);

  useEffect(() => {
    dropLocationRef.current = dropLocation;
  }, [dropLocation]);

  useEffect(() => {
    const query = debouncedPickupInput.trim();

    if (!query || query.length < LOCATION_QUERY_MIN_LENGTH) {
      resetSuggestions('pickup');
      return undefined;
    }

    const abortController = new AbortController();
    if (pickupSearchAbortRef.current) {
      pickupSearchAbortRef.current.abort();
    }
    pickupSearchAbortRef.current = abortController;

    setPickupSuggestions((current) => ({ ...current, loading: true, error: '' }));

    searchLocations(query, abortController.signal)
      .then((items) => {
        setPickupSuggestions({ items, loading: false, error: '' });
        setActiveSuggestionIndex((current) => ({ ...current, pickup: items.length ? 0 : -1 }));
      })
      .catch((error) => {
        if (error?.name === 'AbortError') {
          return;
        }
        setPickupSuggestions({ items: [], loading: false, error: error?.message || 'Location search failed' });
      });

    return () => abortController.abort();
  }, [debouncedPickupInput]);

  useEffect(() => {
    const query = debouncedDropInput.trim();

    if (!query || query.length < LOCATION_QUERY_MIN_LENGTH) {
      resetSuggestions('drop');
      return undefined;
    }

    const abortController = new AbortController();
    if (dropSearchAbortRef.current) {
      dropSearchAbortRef.current.abort();
    }
    dropSearchAbortRef.current = abortController;

    setDropSuggestions((current) => ({ ...current, loading: true, error: '' }));

    searchLocations(query, abortController.signal)
      .then((items) => {
        setDropSuggestions({ items, loading: false, error: '' });
        setActiveSuggestionIndex((current) => ({ ...current, drop: items.length ? 0 : -1 }));
      })
      .catch((error) => {
        if (error?.name === 'AbortError') {
          return;
        }
        setDropSuggestions({ items: [], loading: false, error: error?.message || 'Location search failed' });
      });

    return () => abortController.abort();
  }, [debouncedDropInput]);

  useEffect(() => {
    const token = localStorage.getItem('swiftridex_token');

    if (!token) {
      return undefined;
    }

    const socket = createRiderSocket({
      token,
    });

    socketRef.current = socket;

    const handleRideEvent = (payload, fallbackStatus) => {
      if (payload?.rideId && rideIdRef.current && String(payload.rideId) !== String(rideIdRef.current)) {
        return;
      }

      applyRideUpdate(payload, fallbackStatus);
    };

    socket.on('connect', () => {
      setSocketConnected(true);
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    socket.on('registered', () => {
      setSocketConnected(true);
    });

    socket.on('ride-accepted', (payload) => {
      handleRideEvent(payload, 'ACCEPTED');
    });

    socket.on('ride-started', (payload) => {
      handleRideEvent(payload, 'STARTED');
    });

    socket.on('ride-completed', (payload) => {
      handleRideEvent(payload, 'COMPLETED');
    });

    socket.on('ride-status-updated', (payload) => {
      handleRideEvent(payload, payload?.status);
    });

    socket.on('socket-error', (payload) => {
      setErrorMessage(payload?.message || 'Socket connection error');
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setSocketConnected(false);
    };
  }, []);

  useEffect(() => {
    if (initialRideHydratedRef.current) {
      return;
    }

    initialRideHydratedRef.current = true;
    setStatusLoading(true);
    setErrorMessage('');

    rideService
      .getActiveRideForRider()
      .then((response) => {
        const fetchedRide = Array.isArray(response) ? response[0] : response?.ride || response;

        if (!fetchedRide) {
          setRide(null);
          setRideId('');
          rideIdRef.current = '';
          localStorage.removeItem(ACTIVE_RIDE_KEY);
          return;
        }

        setRide(fetchedRide);
        applyRideUpdate(fetchedRide, fetchedRide?.status);
        localStorage.setItem(ACTIVE_RIDE_KEY, JSON.stringify(fetchedRide));
      })
      .catch((error) => {
        setErrorMessage(error?.message || 'Unable to fetch ride status.');
      })
      .finally(() => {
        setStatusLoading(false);
      });
  }, []);

  const handleRequestRide = async (event) => {
    event.preventDefault();

    setRequestLoading(true);
    setErrorMessage('');
    setRequestMessage('');

    try {
      const nextPickupLocation =
        pickupLocation.lat && pickupLocation.lng ? pickupLocation : await geocodeLocation(pickupInput);
      const nextDropLocation =
        dropLocation.lat && dropLocation.lng ? dropLocation : await geocodeLocation(dropInput);

      setPickupInput(nextPickupLocation.address);
      setDropInput(nextDropLocation.address);
      setPickupLocation(nextPickupLocation);
      setDropLocation(nextDropLocation);

      const response = await rideService.requestRide({
        pickupLatitude: nextPickupLocation.lat,
        pickupLongitude: nextPickupLocation.lng,
        dropLatitude: nextDropLocation.lat,
        dropLongitude: nextDropLocation.lng,
        fare: 250,
      });

      const ride = response?.ride || response;
      const nextRideId = ride?.id ? String(ride.id) : '';

      if (!nextRideId) {
        throw new Error('Ride request succeeded but no ride id was returned.');
      }

      setRideId(nextRideId);
      setRide(ride);
      rideIdRef.current = nextRideId;
      localStorage.setItem(ACTIVE_RIDE_KEY, JSON.stringify(ride));
      setRideStatus(ride?.status || 'REQUESTED');
      rideStatusRef.current = String(ride?.status || 'REQUESTED').toUpperCase();
      setDriverId(ride?.driverId ? String(ride.driverId) : '');
      driverIdRef.current = ride?.driverId ? String(ride.driverId) : '';
      setRequestMessage(`Ride requested successfully. Ride ID: ${formatRideId(nextRideId)}`);
    } catch (error) {
      setErrorMessage(error?.message || 'Failed to request ride.');
    } finally {
      setRequestLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-900 px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <Card title="Ride Map">
          <div className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
            <div id="ride-map" className="h-[420px] overflow-hidden rounded-2xl border border-slate-700/70" />
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => focusFieldOnMap('pickup')}
                className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition duration-200 ${
                  activePin === 'pickup'
                    ? 'border-cyan-400/60 bg-cyan-500/10 text-cyan-200'
                    : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-500'
                }`}
              >
                Set pickup with map click
              </button>
              <button
                type="button"
                onClick={() => focusFieldOnMap('drop')}
                className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition duration-200 ${
                  activePin === 'drop'
                    ? 'border-cyan-400/60 bg-cyan-500/10 text-cyan-200'
                    : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-500'
                }`}
              >
                Set drop with map click
              </button>
              <div className="rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3 text-xs text-slate-300">
                Click the map to place a marker for the selected field.
              </div>
            </div>
          </div>
        </Card>

        <header className="rounded-2xl border border-slate-700/60 bg-slate-800/90 p-5 shadow-xl shadow-slate-950/30">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-3xl font-bold text-transparent">
                SwiftrideX
              </h1>
              <p className="mt-1 text-sm text-slate-300">Signed in as {userEmail}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl border border-slate-600 bg-slate-900/60 px-4 py-2 text-sm font-semibold text-slate-100 transition duration-200 hover:border-cyan-400/60 hover:text-cyan-300"
            >
              Logout
            </button>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Ride Booking">
            <form onSubmit={handleRequestRide} className="space-y-4">
              <div>
                <label htmlFor="pickup" className="mb-2 block text-sm font-medium text-slate-200">
                  Pickup location
                </label>
                <div className="relative">
                  <input
                    id="pickup"
                    type="text"
                    value={pickupInput}
                    onChange={(event) => {
                      setPickupInput(event.target.value);
                      setPickupLocation(createLocationState());
                      pickupLocationRef.current = createLocationState();
                      setRequestMessage('');
                      setErrorMessage('');
                      activePinRef.current = 'pickup';
                      setActivePin('pickup');
                    }}
                    onFocus={() => focusFieldOnMap('pickup')}
                    onKeyDown={(event) => handleLocationKeyDown('pickup', event)}
                    placeholder="Enter pickup location"
                    className="w-full rounded-xl border border-slate-600 bg-slate-900/80 px-4 py-3 text-sm text-slate-100 outline-none transition duration-200 placeholder:text-slate-400 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/20"
                    required
                  />
                  {renderSuggestions('pickup')}
                </div>
                {pickupLocation.address ? <p className="mt-2 text-xs text-emerald-300">{pickupLocation.address}</p> : null}
              </div>

              <div>
                <label htmlFor="drop" className="mb-2 block text-sm font-medium text-slate-200">
                  Drop location
                </label>
                <div className="relative">
                  <input
                    id="drop"
                    type="text"
                    value={dropInput}
                    onChange={(event) => {
                      setDropInput(event.target.value);
                      setDropLocation(createLocationState());
                      dropLocationRef.current = createLocationState();
                      setRequestMessage('');
                      setErrorMessage('');
                      activePinRef.current = 'drop';
                      setActivePin('drop');
                    }}
                    onFocus={() => focusFieldOnMap('drop')}
                    onKeyDown={(event) => handleLocationKeyDown('drop', event)}
                    placeholder="Enter destination"
                    className="w-full rounded-xl border border-slate-600 bg-slate-900/80 px-4 py-3 text-sm text-slate-100 outline-none transition duration-200 placeholder:text-slate-400 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/20"
                    required
                  />
                  {renderSuggestions('drop')}
                </div>
                {dropLocation.address ? <p className="mt-2 text-xs text-emerald-300">{dropLocation.address}</p> : null}
              </div>

              <button
                type="submit"
                disabled={requestLoading}
                className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-cyan-400 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/35 transition duration-200 hover:-translate-y-0.5 hover:from-blue-500 hover:to-cyan-300 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
              >
                {requestLoading ? 'Requesting Ride...' : 'Request Ride'}
              </button>

              {requestMessage ? (
                <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
                  {requestMessage}
                </p>
              ) : null}

              {errorMessage ? (
                <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-300">
                  {errorMessage}
                </p>
              ) : null}
            </form>
          </Card>

          <Card title="Ride Status">
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3">
                <p className="text-sm text-slate-300">Ride ID</p>
                <p className="text-sm font-medium text-slate-200">{ride?.id || rideId || '-'}</p>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3">
                <p className="text-sm text-slate-300">Current status</p>
                <StatusBadge status={ride?.status || rideStatus} />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3">
                <p className="text-sm text-slate-300">Driver</p>
                <p className="text-sm font-medium text-slate-200">{resolvedDriverName}</p>
              </div>
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 text-xs text-slate-300">
                {socketConnected ? 'Live updates connected' : 'Connecting to live updates...'}
              </div>
              {statusLoading ? (
                <p className="text-xs text-slate-400">Loading ride status...</p>
              ) : null}
            </div>
          </Card>
        </div>

        {ride?.driver || driverId ? (
          <Card title="Driver Info">
            <div className="space-y-3 text-sm text-slate-200">
              <p>
                <span className="text-slate-400">Driver:</span> {resolvedDriverName}
              </p>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <span className="text-emerald-300">Driver assigned</span>
              </div>
            </div>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
