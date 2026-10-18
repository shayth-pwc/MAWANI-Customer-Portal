export default function PageHeader({ title, supporting }) {
  return (
    <div className="min-w-0">
      <h1 className="text-display-xs font-semibold leading-8 text-text-primary">{title}</h1>
      {supporting ? <p className="mt-1 text-sm font-medium leading-5 text-text-tertiary">{supporting}</p> : null}
    </div>
  )
}
