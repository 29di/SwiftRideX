export default function RideActivityFeed({ events = [] }) {
  return (
    <div className="grid gap-3">
      {events.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-5 text-sm text-slate-400">
          No live events yet. Socket.io updates will appear here as ride state changes.
        </div>
      ) : (
        events.map((event) => (
          <div key={event.id} className="rounded-3xl border border-white/5 bg-white/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-white">{event.name}</div>
              <div className="text-xs uppercase tracking-[0.24em] text-slate-500">{new Date(event.timestamp).toLocaleTimeString()}</div>
            </div>
            <pre className="mt-3 overflow-x-auto rounded-2xl bg-slate-950/70 p-3 text-xs leading-6 text-slate-300">{JSON.stringify(event.payload, null, 2)}</pre>
          </div>
        ))
      )}
    </div>
  );
}
