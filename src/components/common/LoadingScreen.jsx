import { useApp } from '../../hooks/useApp'

export default function LoadingScreen({ exiting = false, label }) {
  const { t } = useApp()

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-0 z-50 bg-white transition-opacity duration-500 ${exiting ? 'opacity-0' : 'opacity-100'}`}
    >
      <div className="flex h-full flex-col items-center justify-center">
        <div className="flex size-44 items-center justify-center rounded-full bg-[radial-gradient(circle,rgba(15,118,140,0.16),transparent_68%)]">
          <img src="/favicon.png" alt="" className="size-16" />
        </div>
        <p className="text-sm font-medium text-[#0e7490]">{label}</p>
      </div>
      <p className="absolute bottom-6 end-8 text-xs text-text-placeholder">{t('rightsReserved')}</p>
    </div>
  )
}

export function SessionTransition() {
  const { boot, t } = useApp()
  if (boot === 'idle') return null
  return <LoadingScreen exiting={boot === 'leaving'} label={t('loading')} />
}
