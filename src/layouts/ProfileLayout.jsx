import { useState } from 'react'
import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom'
import { icons } from '../assets'
import Dialog from '../components/profile/Dialog'
import Button from '../components/ui/Button'
import { INITIAL_DETAILS } from '../constants/profile'
import { useApp } from '../hooks/useApp'

export default function ProfileLayout() {
  const { signedIn, t } = useApp()
  const tabs = [
    { to: '/profile', label: t('crMyDetails'), end: true },
    { to: '/profile/registration', label: t('crCommercial') },
  ]
  const navigate = useNavigate()
  const [details, setDetails] = useState(INITIAL_DETAILS)
  const [baseline, setBaseline] = useState(INITIAL_DETAILS)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [validating, setValidating] = useState(false)
  const dirty = JSON.stringify(details) !== JSON.stringify(baseline)

  if (!signedIn) return <Navigate to="/login" replace />

  return (
    <div className="min-h-screen bg-bg-neutral">
      <header className="sticky top-0 z-20 border-b border-border bg-bg-neutral">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-3 px-4 py-6 sm:px-8 lg:px-16">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/')}
              aria-label={t('crBack')}
              className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[#e9eaeb] bg-white"
            >
              <img src={icons.chevronLeft} alt="" width={20} height={20} className="rtl:rotate-180" />
            </button>
            <h1 className="truncate text-lg font-semibold text-text-primary">{t('companyProfile')}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                if (!dirty) return
                setDiscardOpen(true)
              }}
            >
              {t('crDiscard')}
            </Button>
            <Button onClick={() => setConfirmOpen(true)} disabled={validating}>
              {t('save')}
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-4 py-8 sm:px-8 lg:flex-row lg:px-16">
        <nav aria-label={t('companyProfile')} className="flex w-full shrink-0 gap-1 lg:w-[172px] lg:flex-col">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `flex h-9 items-center border-s-2 px-3 text-sm font-semibold ${
                  isActive ? 'border-brand text-brand' : 'border-transparent text-text-placeholder'
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
        <div className="min-w-0 flex-1">
          <Outlet context={{ details, setDetails, setValidating }} />
        </div>
      </div>

      <Dialog
        open={confirmOpen}
        title={t('crSubmitChanges')}
        description={t('crSubmitBody')}
        onClose={() => setConfirmOpen(false)}
        icon={
          <span className="flex size-12 items-center justify-center rounded-full bg-brand-50">
            <img src={icons.checkCircle} alt="" width={24} height={24} />
          </span>
        }
      >
        <div className="mt-6 flex gap-3 border-t border-border px-6 py-4">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirmOpen(false)}>
            {t('crDiscard')}
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              setBaseline(details)
              setConfirmOpen(false)
            }}
          >
            {t('crConfirm')}
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={discardOpen}
        title={t('crUnsaved')}
        description={t('crDiscardAsk')}
        onClose={() => setDiscardOpen(false)}
        icon={<UnsavedMark />}
      >
        <div className="mt-6 flex gap-3 border-t border-border px-6 py-4">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => {
              setDetails(baseline)
              setDiscardOpen(false)
            }}
          >
            {t('crDiscard')}
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              setBaseline(details)
              setDiscardOpen(false)
            }}
          >
            {t('crConfirm')}
          </Button>
        </div>
      </Dialog>
    </div>
  )
}

function UnsavedMark() {
  return (
    <span className="relative flex size-12 items-center justify-center">
      <span className="absolute size-12 rounded-full bg-[#FEF0C7]/50" />
      <span className="absolute size-9 rounded-full bg-[#FEF0C7]" />
      <svg className="relative" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M6 2.5h5.5L16 7v10.5H6V2.5Z" stroke="#DC6803" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M11.5 2.5V7H16" stroke="#DC6803" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M8 11h4M8 14h4" stroke="#DC6803" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </span>
  )
}
