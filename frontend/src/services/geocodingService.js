const DEFAULT_TIMEOUT_MS = 8000;
const SEARCH_RESULT_LIMIT = 6;

const reverseCache = new Map();
const searchCache = new Map();
const forwardCache = new Map();

const withTimeout = async (requestPromise, timeoutMs = DEFAULT_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await requestPromise(controller.signal);
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const combineSignals = (externalSignal, timeoutSignal) => {
  if (!externalSignal) {
    return timeoutSignal;
  }

  if (externalSignal.aborted || timeoutSignal.aborted) {
    return AbortSignal.abort();
  }

  const combinedController = new AbortController();

  const onAbort = () => {
    combinedController.abort();
    externalSignal.removeEventListener('abort', onAbort);
    timeoutSignal.removeEventListener('abort', onAbort);
  };

  externalSignal.addEventListener('abort', onAbort, { once: true });
  timeoutSignal.addEventListener('abort', onAbort, { once: true });

  return combinedController.signal;
};

const toCoordinateLabel = (latitude, longitude) => `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;

const normalizeWhitespace = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const toPhotonAddress = (properties) => {
  const parts = [
    properties?.name,
    properties?.street,
    properties?.district,
    properties?.city,
    properties?.state,
    properties?.country,
  ]
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);

  return parts.join(', ');
};

const fetchBigDataCloudReverse = async (latitude, longitude, signal) => {
  const response = await fetch(
    `https://api-bdc.io/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
    {
      signal,
      headers: {
        Accept: 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error('BigDataCloud reverse lookup failed');
  }

  const data = await response.json();

  const label = [
    data?.locality,
    data?.city,
    data?.principalSubdivision,
    data?.countryName,
  ]
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean)
    .join(', ');

  return label || toCoordinateLabel(latitude, longitude);
};

const fetchPhotonReverse = async (latitude, longitude, signal) => {
  const response = await fetch(`https://photon.komoot.io/reverse?lat=${latitude}&lon=${longitude}`, {
    signal,
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Photon reverse lookup failed');
  }

  const data = await response.json();
  const feature = Array.isArray(data?.features) ? data.features[0] : null;
  const label = toPhotonAddress(feature?.properties || {});

  return label || toCoordinateLabel(latitude, longitude);
};

const fetchNominatimReverse = async (latitude, longitude, signal) => {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
    {
      signal,
      headers: {
        Accept: 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error('Nominatim reverse lookup failed');
  }

  const data = await response.json();
  return data?.display_name || toCoordinateLabel(latitude, longitude);
};

const fetchPhotonSearch = async (query, limit, signal) => {
  const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=${limit}`, {
    signal,
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Photon location search failed');
  }

  const data = await response.json();
  const features = Array.isArray(data?.features) ? data.features : [];

  return features
    .map((feature) => {
      const coordinates = Array.isArray(feature?.geometry?.coordinates) ? feature.geometry.coordinates : [];
      const longitude = Number(coordinates[0]);
      const latitude = Number(coordinates[1]);
      const address = toPhotonAddress(feature?.properties || {});

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !address) {
        return null;
      }

      return {
        address,
        lat: latitude,
        lng: longitude,
      };
    })
    .filter(Boolean);
};

const fetchNominatimSearch = async (query, limit, signal) => {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=${limit}&q=${encodeURIComponent(query)}`,
    {
      signal,
      headers: {
        Accept: 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error('Nominatim location search failed');
  }

  const data = await response.json();

  return Array.isArray(data)
    ? data
        .map((item) => ({
          address: item.display_name,
          lat: Number(item.lat),
          lng: Number(item.lon),
        }))
        .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng) && item.address)
    : [];
};

const runWithProviders = async (providers) => {
  let lastError = null;

  for (const provider of providers) {
    try {
      const result = await provider();
      if (result !== undefined && result !== null) {
        return result;
      }
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Geocoding request failed');
};

export const reverseGeocode = async (latitude, longitude) => {
  const lat = Number(latitude);
  const lng = Number(longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('Invalid coordinates');
  }

  const cacheKey = `${lat.toFixed(6)},${lng.toFixed(6)}`;
  if (reverseCache.has(cacheKey)) {
    return reverseCache.get(cacheKey);
  }

  const label = await runWithProviders([
    () => withTimeout((timeoutSignal) => fetchBigDataCloudReverse(lat, lng, timeoutSignal)),
    () => withTimeout((timeoutSignal) => fetchPhotonReverse(lat, lng, timeoutSignal)),
    () => withTimeout((timeoutSignal) => fetchNominatimReverse(lat, lng, timeoutSignal)),
  ]);

  reverseCache.set(cacheKey, label);
  return label;
};

export const searchLocations = async (query, signal, limit = SEARCH_RESULT_LIMIT) => {
  const trimmedQuery = String(query || '').trim();

  if (!trimmedQuery) {
    return [];
  }

  const normalizedLimit = Number.isInteger(limit) && limit > 0 ? limit : SEARCH_RESULT_LIMIT;
  const cacheKey = `${trimmedQuery.toLowerCase()}::${normalizedLimit}`;

  if (searchCache.has(cacheKey)) {
    return searchCache.get(cacheKey);
  }

  const results = await runWithProviders([
    () =>
      withTimeout((timeoutSignal) => fetchPhotonSearch(trimmedQuery, normalizedLimit, combineSignals(signal, timeoutSignal))),
    () =>
      withTimeout((timeoutSignal) => fetchNominatimSearch(trimmedQuery, normalizedLimit, combineSignals(signal, timeoutSignal))),
  ]);

  searchCache.set(cacheKey, results);
  return results;
};

export const geocodeLocation = async (query, signal) => {
  const trimmedQuery = String(query || '').trim();

  if (!trimmedQuery) {
    throw new Error('Enter a location first');
  }

  const cacheKey = trimmedQuery.toLowerCase();

  if (forwardCache.has(cacheKey)) {
    return forwardCache.get(cacheKey);
  }

  const matches = await searchLocations(trimmedQuery, signal, 1);
  const match = matches[0];

  if (!match) {
    throw new Error(`Could not find coordinates for "${trimmedQuery}"`);
  }

  forwardCache.set(cacheKey, match);
  return match;
};
