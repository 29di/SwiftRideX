import { LocateFixed, SendHorizontal } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Input from '../ui/Input';

const EMPTY_FORM = {
  pickupAddress: '',
  pickupLat: null,
  pickupLng: null,
  dropAddress: '',
  dropLat: null,
  dropLng: null,
  fare: '',
};

const useDebouncedValue = (value, delay = 350) => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timeoutId);
  }, [delay, value]);

  return debounced;
};

const searchPlaces = async (query, signal) => {
  const trimmed = String(query || '').trim();
  if (!trimmed) {
    return [];
  }

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=${encodeURIComponent(trimmed)}`,
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
    throw new Error('Failed to resolve your location address');
  }

  const data = await response.json();
  return data?.display_name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
};

export default function RideRequestCard({ onSubmit, loading = false, initialValues }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [pickupSuggestions, setPickupSuggestions] = useState([]);
  const [dropSuggestions, setDropSuggestions] = useState([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState({ pickup: -1, drop: -1 });
  const [suggestionLoading, setSuggestionLoading] = useState({ pickup: false, drop: false });
  const [suggestionError, setSuggestionError] = useState({ pickup: '', drop: '' });
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState('');

  const debouncedPickupAddress = useDebouncedValue(form.pickupAddress);
  const debouncedDropAddress = useDebouncedValue(form.dropAddress);

  useEffect(() => {
    if (initialValues) {
      setForm((current) => ({
        ...current,
        pickupAddress: initialValues.pickupAddress || current.pickupAddress,
        pickupLat: initialValues.pickupLatitude ?? current.pickupLat,
        pickupLng: initialValues.pickupLongitude ?? current.pickupLng,
        dropAddress: initialValues.dropAddress || current.dropAddress,
        dropLat: initialValues.dropLatitude ?? current.dropLat,
        dropLng: initialValues.dropLongitude ?? current.dropLng,
        fare: initialValues.fare ?? current.fare,
      }));
    }
  }, [initialValues]);

  const suggestionGroups = useMemo(
    () => ({
      pickup: pickupSuggestions,
      drop: dropSuggestions,
    }),
    [pickupSuggestions, dropSuggestions]
  );

  const updateField = (field) => (event) => {
    const value = event.target.value;

    if (field === 'pickupAddress') {
      setForm((current) => ({ ...current, pickupAddress: value, pickupLat: null, pickupLng: null }));
      return;
    }

    if (field === 'dropAddress') {
      setForm((current) => ({ ...current, dropAddress: value, dropLat: null, dropLng: null }));
      return;
    }

    setForm((current) => ({ ...current, [field]: value }));
  };

  const selectSuggestion = (field, item) => {
    if (field === 'pickup') {
      setForm((current) => ({
        ...current,
        pickupAddress: item.address,
        pickupLat: item.lat,
        pickupLng: item.lng,
      }));
      setPickupSuggestions([]);
      setActiveSuggestionIndex((current) => ({ ...current, pickup: -1 }));
      return;
    }

    setForm((current) => ({
      ...current,
      dropAddress: item.address,
      dropLat: item.lat,
      dropLng: item.lng,
    }));
    setDropSuggestions([]);
    setActiveSuggestionIndex((current) => ({ ...current, drop: -1 }));
  };

  const handleSuggestionKeyDown = (field, event) => {
    const suggestions = suggestionGroups[field];
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
      selectSuggestion(field, suggestions[activeIndex]);
    }

    if (event.key === 'Escape') {
      if (field === 'pickup') {
        setPickupSuggestions([]);
      } else {
        setDropSuggestions([]);
      }
      setActiveSuggestionIndex((current) => ({ ...current, [field]: -1 }));
    }
  };

  const submitRide = async (event) => {
    event.preventDefault();

    if (form.pickupLat === null || form.pickupLng === null || form.dropLat === null || form.dropLng === null) {
      setLocationError('Select pickup and drop locations from suggestions before requesting a ride.');
      return;
    }

    setLocationError('');

    await onSubmit?.({
      pickupLatitude: form.pickupLat,
      pickupLongitude: form.pickupLng,
      dropLatitude: form.dropLat,
      dropLongitude: form.dropLng,
      pickupAddress: form.pickupAddress,
      dropAddress: form.dropAddress,
      fare: form.fare,
    });
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported in this browser.');
      return;
    }

    setLocationLoading(true);
    setLocationError('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const address = await reverseGeocode(latitude, longitude);

          setForm((current) => ({
            ...current,
            pickupAddress: address,
            pickupLat: Number(latitude),
            pickupLng: Number(longitude),
          }));

          setPickupSuggestions([]);
          setActiveSuggestionIndex((current) => ({ ...current, pickup: -1 }));
        } catch (error) {
          setLocationError(error.message || 'Unable to resolve your current address.');
        } finally {
          setLocationLoading(false);
        }
      },
      (error) => {
        if (error.code === 1) {
          setLocationError('Location permission denied. Please allow location access.');
        } else {
          setLocationError('Unable to read your current location.');
        }
        setLocationLoading(false);
      }
    );
  };

  useEffect(() => {
    const query = debouncedPickupAddress.trim();

    if (!query || (form.pickupLat !== null && form.pickupLng !== null && query === form.pickupAddress)) {
      setPickupSuggestions([]);
      setSuggestionError((current) => ({ ...current, pickup: '' }));
      setSuggestionLoading((current) => ({ ...current, pickup: false }));
      return undefined;
    }

    const abortController = new AbortController();
    setSuggestionLoading((current) => ({ ...current, pickup: true }));
    setSuggestionError((current) => ({ ...current, pickup: '' }));

    searchPlaces(query, abortController.signal)
      .then((items) => {
        setPickupSuggestions(items);
        setActiveSuggestionIndex((current) => ({ ...current, pickup: items.length ? 0 : -1 }));
      })
      .catch((error) => {
        if (error?.name === 'AbortError') return;
        setSuggestionError((current) => ({ ...current, pickup: error.message || 'Search failed' }));
        setPickupSuggestions([]);
      })
      .finally(() => {
        setSuggestionLoading((current) => ({ ...current, pickup: false }));
      });

    return () => abortController.abort();
  }, [debouncedPickupAddress, form.pickupAddress, form.pickupLat, form.pickupLng]);

  useEffect(() => {
    const query = debouncedDropAddress.trim();

    if (!query || (form.dropLat !== null && form.dropLng !== null && query === form.dropAddress)) {
      setDropSuggestions([]);
      setSuggestionError((current) => ({ ...current, drop: '' }));
      setSuggestionLoading((current) => ({ ...current, drop: false }));
      return undefined;
    }

    const abortController = new AbortController();
    setSuggestionLoading((current) => ({ ...current, drop: true }));
    setSuggestionError((current) => ({ ...current, drop: '' }));

    searchPlaces(query, abortController.signal)
      .then((items) => {
        setDropSuggestions(items);
        setActiveSuggestionIndex((current) => ({ ...current, drop: items.length ? 0 : -1 }));
      })
      .catch((error) => {
        if (error?.name === 'AbortError') return;
        setSuggestionError((current) => ({ ...current, drop: error.message || 'Search failed' }));
        setDropSuggestions([]);
      })
      .finally(() => {
        setSuggestionLoading((current) => ({ ...current, drop: false }));
      });

    return () => abortController.abort();
  }, [debouncedDropAddress, form.dropAddress, form.dropLat, form.dropLng]);

  const renderSuggestions = (field) => {
    const suggestions = field === 'pickup' ? pickupSuggestions : dropSuggestions;
    const loadingState = suggestionLoading[field];
    const errorState = suggestionError[field];
    const activeIndex = activeSuggestionIndex[field];

    if (!loadingState && !errorState && suggestions.length === 0) {
      return null;
    }

    return (
      <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/95 shadow-2xl shadow-slate-950/50 backdrop-blur">
        {loadingState ? (
          <div className="flex items-center gap-3 px-4 py-3 text-sm text-slate-300">Searching locations...</div>
        ) : errorState ? (
          <div className="px-4 py-3 text-sm text-rose-300">{errorState}</div>
        ) : (
          <ul className="max-h-72 overflow-auto py-2">
            {suggestions.map((item, index) => (
              <li key={`${field}-${item.address}-${item.lat}-${item.lng}`}>
                <button
                  type="button"
                  onMouseEnter={() => setActiveSuggestionIndex((current) => ({ ...current, [field]: index }))}
                  onClick={() => selectSuggestion(field, item)}
                  className={`w-full px-4 py-3 text-left text-sm transition duration-200 ${
                    activeIndex === index
                      ? 'bg-cyan-500/15 text-cyan-100'
                      : 'text-slate-200 hover:bg-slate-800/80 hover:text-white'
                  }`}
                >
                  <div className="font-medium leading-5">{item.address}</div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <Card className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="section-label">Ride booking</div>
          <h3 className="mt-2 text-2xl font-bold text-white">Request a ride</h3>
          <p className="mt-2 text-sm text-slate-400">
            Search addresses to create a live ride request with a production-style location flow.
          </p>
        </div>
        <Button variant="secondary" onClick={useCurrentLocation} className="shrink-0" disabled={locationLoading}>
          <LocateFixed className="h-4 w-4" />
          {locationLoading ? 'Locating...' : 'Use my location'}
        </Button>
      </div>

      <form className="grid gap-4" onSubmit={submitRide}>
        <div className="grid gap-4">
          <div className="relative">
            <Input
              label="Pickup location"
              value={form.pickupAddress}
              onChange={updateField('pickupAddress')}
              onKeyDown={(event) => handleSuggestionKeyDown('pickup', event)}
              placeholder="Search pickup address"
            />
            {renderSuggestions('pickup')}
          </div>

          <div className="relative">
            <Input
              label="Drop location"
              value={form.dropAddress}
              onChange={updateField('dropAddress')}
              onKeyDown={(event) => handleSuggestionKeyDown('drop', event)}
              placeholder="Search destination address"
            />
            {renderSuggestions('drop')}
          </div>
        </div>

        <Input label="Estimated fare" value={form.fare} onChange={updateField('fare')} placeholder="18.50" helperText="Optional. Leave empty if you want backend pricing defaults." />

        {locationError ? <p className="text-sm text-rose-300">{locationError}</p> : null}

        <Button type="submit" disabled={loading} className="w-full sm:w-auto">
          <SendHorizontal className="h-4 w-4" />
          {loading ? 'Requesting ride...' : 'Request ride'}
        </Button>
      </form>
    </Card>
  );
}
