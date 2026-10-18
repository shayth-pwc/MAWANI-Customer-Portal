export default function Loader({ label }) {
  return (
    <div className="flex min-h-64 items-center justify-center" role="status">
      <div className="flex items-center gap-3 text-sm text-text-tertiary">
        <span className="size-5 animate-spin rounded-full border-2 border-brand-50 border-t-brand" />
        {label}
      </div>
    </div>
  )
}
