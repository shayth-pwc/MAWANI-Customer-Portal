import { useId } from 'react'

export default function Input({ id, label, className = '', ...props }) {
  const generatedId = useId()
  const fieldId = id || generatedId

  return (
    <label htmlFor={fieldId} className={`flex flex-col gap-1.5 text-sm font-medium text-text-secondary ${className}`}>
      {label}
      <input
        id={fieldId}
        className="h-10 rounded-lg border border-border bg-white px-3 text-sm font-normal text-text-primary shadow-xs outline-none placeholder:text-text-placeholder focus:ring-2 focus:ring-brand/30"
        {...props}
      />
    </label>
  )
}
