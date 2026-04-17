export default function Skeleton({ className = '' }) {
  return (
    <div
      className={`animate-pulse rounded-2xl bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 bg-[length:200%_100%] ${className}`}
      style={{ animation: 'shimmer 1.6s linear infinite' }}
    />
  );
}
