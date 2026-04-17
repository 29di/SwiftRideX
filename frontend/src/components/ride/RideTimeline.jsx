const STEP_ORDER = ['REQUESTED', 'ACCEPTED', 'STARTED', 'COMPLETED', 'CANCELLED'];

export default function RideTimeline({ status = 'REQUESTED' }) {
  const normalizedStatus = String(status).toUpperCase();
  const currentIndex = STEP_ORDER.indexOf(normalizedStatus);
  const isCancelled = normalizedStatus === 'CANCELLED';

  return (
    <div className="grid gap-3">
      {STEP_ORDER.map((step, index) => {
        const active = isCancelled ? step === 'CANCELLED' : index <= currentIndex;
        const done = isCancelled ? false : index < currentIndex;

        return (
          <div key={step} className="flex items-center gap-4 rounded-2xl border border-white/5 bg-white/5 px-4 py-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-2xl border text-sm font-bold ${
                done
                  ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300'
                  : active
                    ? 'border-brand-400/40 bg-brand-500/15 text-brand-300'
                    : 'border-slate-600 bg-slate-900/70 text-slate-400'
              }`}
            >
              {index + 1}
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-white">{step}</div>
              <div className="text-xs text-slate-400">
                {step === 'REQUESTED' && 'Ride is waiting for the nearest driver.'}
                {step === 'ACCEPTED' && 'Driver has been assigned and accepted the trip.'}
                {step === 'STARTED' && 'Trip is in progress.'}
                {step === 'COMPLETED' && 'Trip has finished successfully.'}
                {step === 'CANCELLED' && 'Trip was cancelled by rider or system.'}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
