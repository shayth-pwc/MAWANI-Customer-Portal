export default function Card({ children, className = '' }) {
  return (
    <section className={`overflow-hidden rounded-3xl border border-border bg-white shadow-xs ${className}`}>
      {children}
    </section>
  )
}
