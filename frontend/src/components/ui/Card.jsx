export default function Card({ className = '', children, ...props }) {
  return (
    <section className={`card-shell ${className}`} {...props}>
      {children}
    </section>
  );
}
