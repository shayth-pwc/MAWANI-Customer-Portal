import { useId } from 'react'

export default function Select({ id, label, children, className = '', ...props }) {
  const generatedId = useId()
  const fieldId = id || generatedId

  return (
    <label htmlFor={fieldId} className={`flex flex-col gap-1.5 text-sm font-medium text-text-secondary ${className}`}>
      {label}
      <select
        id={fieldId}
        className="h-10 rounded-lg border border-border bg-white px-3 text-sm font-normal text-text-primary shadow-xs outline-none focus:ring-2 focus:ring-brand/30"
        {...props}
      >
        {children}
      </select>
    </label>
  )
}
