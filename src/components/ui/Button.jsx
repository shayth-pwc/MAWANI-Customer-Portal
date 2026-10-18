const variants = {
  primary:
    'h-10 gap-1 rounded-lg border-2 border-white/10 bg-brand px-3.5 text-sm font-semibold text-white shadow-xs hover:bg-brand-400',
  secondary:
    'h-10 gap-1 rounded-lg border border-border bg-white px-3.5 text-sm font-semibold text-text-tertiary shadow-xs hover:bg-bg-neutral',
  tertiary: 'h-6 gap-1.5 rounded-sm px-1 text-md font-semibold text-text-tertiary hover:text-text-primary',
  'tertiary-color':
    'h-12 gap-1.5 rounded-xl bg-bg-neutral px-[18px] text-md font-semibold text-brand hover:bg-brand-50',
  soft: 'h-[74px] flex-1 gap-2 rounded-xl bg-white px-4 text-md font-semibold text-brand shadow-lg hover:bg-brand-25',
  ghost: 'h-10 gap-2 rounded-lg px-2 text-sm font-semibold text-text-secondary hover:bg-bg-active',
}

export default function Button({
  children,
  variant = 'primary',
  type = 'button',
  className = '',
  ...props
}) {
  return (
    <button
      type={type}
      className={`inline-flex cursor-pointer items-center justify-center whitespace-nowrap transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
