export default function Button({ variant = 'primary', className = '', type = 'button', children, ...props }) {
  const variants = {
    primary: 'soft-button-primary',
    secondary: 'soft-button-secondary',
    ghost: 'rounded-2xl px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/5 hover:text-white',
  };

  return (
    <button type={type} className={`${variants[variant] || variants.primary} ${className}`} {...props}>
      {children}
    </button>
  );
}
