export const formatRideId = (rideId) => {
  const normalized = String(rideId ?? '').trim();

  if (!normalized) {
    return '-----';
  }

  return normalized.slice(-5);
};
