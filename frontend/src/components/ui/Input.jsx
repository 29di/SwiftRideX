export default function Input({ label, error, helperText, className = '', icon: Icon, ...props }) {
  return (
    <label className="block">
      {label ? <span className="field-label">{label}</span> : null}
      <div className="relative">
        {Icon ? (
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
        <input className={`field-input ${Icon ? 'pl-10' : ''} ${className}`} {...props} />
      </div>
      {error ? <span className="mt-2 block text-sm text-rose-300">{error}</span> : null}
      {!error && helperText ? <span className="mt-2 block text-sm text-slate-400">{helperText}</span> : null}
    </label>
  );
}
