import { useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { icons, images } from '../../assets'
import { ACCOUNT_TYPES, PRIMARY_NAV } from '../../constants/navigation'
import { useApp } from '../../hooks/useApp'
import { useAdminAccess } from '../../hooks/useAdminAccess'
import { useClickOutside } from '../../hooks/useClickOutside'
import Avatar from '../ui/Avatar'
import Button from '../ui/Button'
import Icon from '../ui/Icon'

export default function Sidebar({
  collapsed,
  mobileOpen,
  onClose,
  onToggleCollapse,
  supportOpen,
  onToggleSupport,
  onCloseSupport,
}) {
  const { t, accountType, language, user, toggleLanguage, setAccountType, leaveApp } = useApp()
  const navigate = useNavigate()
  const supportRef = useRef(null)
  const [switchOpen, setSwitchOpen] = useState(false)
  const [draftAccount, setDraftAccount] = useState(accountType)
  useClickOutside(supportRef, onCloseSupport, supportOpen)

  const { status: adminAccess } = useAdminAccess()
  const showLabels = !collapsed || mobileOpen

  const closeMobile = () => {
    setSwitchOpen(false)
    onClose()
  }

  const openSwitch = () => {
    setDraftAccount(accountType)
    setSwitchOpen(true)
  }

  const confirmSwitch = () => {
    setAccountType(draftAccount)
    setSwitchOpen(false)
  }

  const signOut = () => {
    closeMobile()
    navigate('/signed-out')
    leaveApp()
  }

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-[#0a0d12]/70 lg:hidden"
          aria-label={t('closeMenu')}
          onClick={closeMobile}
        />
      ) : null}
      {mobileOpen ? (
        <button
          type="button"
          aria-label={t('closeMenu')}
          onClick={closeMobile}
          className="fixed end-3 top-4 z-50 flex size-10 items-center justify-center rounded-lg lg:hidden"
        >
          <CloseIcon />
        </button>
      ) : null}
      <aside
        className={`fixed inset-y-0 start-0 z-40 flex h-screen flex-col justify-between border-e border-border bg-white transition-[width,transform] lg:sticky ${
          mobileOpen ? 'translate-x-0' : 'max-lg:-translate-x-full max-lg:rtl:translate-x-full'
        } ${mobileOpen ? 'w-[min(100%,320px)]' : showLabels ? 'w-64' : 'w-[72px]'}`}
      >
        <div className={`flex min-h-0 flex-1 flex-col ${showLabels ? 'items-stretch pt-5' : 'items-center gap-4 pt-6'}`}>
          {showLabels ? (
            <div className="flex items-center justify-between gap-2 px-4">
              <img src={images.logo} alt="Mawani" className="h-10 w-auto max-w-[148px] object-contain object-left" />
              <span className="shrink-0 rounded-full bg-brand-25 px-2.5 py-1 text-xs font-semibold text-brand">{t(accountType)}</span>
            </div>
          ) : (
            <>
              <div className="relative h-[38px] w-7 overflow-hidden" aria-hidden="true">
                <img src={images.logo} alt="" className="absolute top-[-0.12%] left-[-190.41%] h-full w-[290.42%] max-w-none" />
              </div>
              <p className="sr-only">Mawani</p>
              <p className="w-full truncate bg-brand-25 px-1 py-1 text-center text-[12px] font-semibold leading-3 text-brand">{t(accountType)}</p>
            </>
          )}
          <nav className={`mt-4 flex w-full flex-col gap-1 overflow-y-auto ${showLabels ? 'px-3' : 'items-center px-2'}`} aria-label="Primary">
            {PRIMARY_NAV.map((item) => (
              <NavLink
                key={item.id}
                to={item.to}
                end={item.to === '/'}
                title={t(item.labelKey)}
                onClick={closeMobile}
                className={({ isActive }) =>
                  `relative flex h-10 items-center gap-3 rounded-lg text-sm font-semibold ${
                    isActive
                      ? mobileOpen
                        ? 'bg-bg-active text-brand'
                        : 'bg-bg-active text-text-primary'
                      : 'text-text-secondary hover:bg-bg-neutral'
                  } ${showLabels ? 'px-3' : 'w-10 justify-center'}`
                }
              >
                {({ isActive }) => (
                  <>
                    {!mobileOpen && isActive ? (
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none absolute top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-brand ${
                          showLabels ? '-start-2.5' : '-start-3.5'
                        }`}
                      />
                    ) : null}
                    <Icon name={isActive ? item.activeIcon : item.icon} size={20} />
                    {showLabels ? (
                      <>
                        <span className="min-w-0 flex-1 truncate">{t(item.labelKey)}</span>
                        {item.id === 'requests' && mobileOpen ? (
                          <img src={icons.chevronDown} alt="" width={20} height={20} className="opacity-60" />
                        ) : null}
                      </>
                    ) : (
                      <span className="sr-only">{t(item.labelKey)}</span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
                      {adminAccess === 'allowed' ? (
              <NavLink
                to="/user-management"
                title={language === 'ar' ? 'إدارة المستخدمين' : 'User Management'}
                onClick={closeMobile}
                className={({ isActive }) =>
                  `relative flex h-10 items-center gap-3 rounded-lg text-sm font-semibold ${
                    isActive ? (mobileOpen ? 'bg-bg-active text-brand' : 'bg-bg-active text-text-primary')
                      : 'text-text-secondary hover:bg-bg-neutral'
                  } ${showLabels ? 'px-3' : 'w-10 justify-center'}`
                }
              >
                {({ isActive }) => (
                  <>
                    {!mobileOpen && isActive ? (
                      <span aria-hidden="true" className={`pointer-events-none absolute top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-brand ${showLabels ? '-start-2.5' : '-start-3.5'}`} />
                    ) : null}
                    <Icon name="user" size={20} />
                    {showLabels ? <span className="truncate">{language === 'ar' ? 'إدارة المستخدمين' : 'User Management'}</span> :
                      <span className="sr-only">{language === 'ar' ? 'إدارة المستخدمين' : 'User Management'}</span>}
                  </>
                )}
              </NavLink>
            ) : null}
          </nav>
        </div>

        {mobileOpen ? (
          <div className="shrink-0 border-t border-border px-3 py-4">
            <div className="mb-3 flex items-center gap-3 px-1">
              <Avatar size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-text-secondary">{user.name}</p>
                <p className="truncate text-sm text-text-tertiary">{user.email}</p>
              </div>
            </div>
            <div className="flex flex-col">
              <MobileMenuButton
                icon="edit"
                label={t('companyProfile')}
                onClick={() => {
                  closeMobile()
                  navigate('/profile')
                }}
              />
              <MobileMenuButton
                icon="globe"
                label={t(language === 'ar' ? 'switchToEnglish' : 'switchToArabic')}
                onClick={() => {
                  toggleLanguage()
                  closeMobile()
                }}
              />
              <MobileMenuButton
                icon="tool"
                label={t('manageSite')}
                trailing="linkExternal"
                onClick={() => {
                  closeMobile()
                  navigate('/settings')
                }}
              />
              <MobileMenuButton icon="switchHorizontal" label={t('switchProfiles')} onClick={openSwitch} />
              <MobileMenuButton icon="logout" label={t('signOut')} onClick={signOut} />
            </div>
          </div>
        ) : (
          <div ref={supportRef} className={`relative flex flex-col gap-1 pb-5 ${showLabels ? 'items-stretch px-3' : 'items-center px-2'}`}>
            {supportOpen ? (
              <div
                role="menu"
                className="absolute bottom-16 start-4 z-20 w-[222px] overflow-hidden rounded-xl border border-border bg-white py-1.5 shadow-lg"
              >
                <SupportLink icon="messageChat" label={t('contactSupport')} onClick={() => onToggleSupport('contact')} />
                <SupportLink icon="messageSmile" label={t('hearFeedback')} to="/feedback" onClick={onCloseSupport} />
              </div>
            ) : null}
            <button
              type="button"
              className={`flex h-10 items-center gap-3 rounded-lg text-sm font-semibold text-text-secondary hover:bg-bg-active ${showLabels ? 'px-3' : 'w-10 justify-center'}`}
              aria-expanded={supportOpen}
              aria-label={t('contactSupport')}
              onClick={() => onToggleSupport('toggle')}
            >
              <Icon name="navSupport" size={20} />
              {showLabels ? <span>{t('contactSupport')}</span> : null}
            </button>
            <button
              type="button"
              className={`flex size-10 items-center justify-center rounded-lg hover:bg-bg-active ${showLabels ? 'self-start' : ''}`}
              aria-label={collapsed ? t('expandNav') : t('collapseNav')}
              onClick={onToggleCollapse}
            >
              <img src={icons.layoutRight} alt="" width={20} height={20} className={collapsed ? '' : 'rotate-180'} />
            </button>
          </div>
        )}
      </aside>

      {switchOpen && mobileOpen ? (
        <SwitchProfileSheet
          draftAccount={draftAccount}
          onSelect={setDraftAccount}
          onClose={() => setSwitchOpen(false)}
          onConfirm={confirmSwitch}
        />
      ) : null}
    </>
  )
}

function MobileMenuButton({ icon, label, trailing, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-10 w-full items-center gap-2 rounded-lg px-2 text-start text-sm font-semibold text-text-secondary hover:bg-bg-neutral"
    >
      <Icon name={icon} size={16} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailing ? <Icon name={trailing} size={16} /> : null}
    </button>
  )
}

function SwitchProfileSheet({ draftAccount, onSelect, onClose, onConfirm }) {
  const { t } = useApp()
  const selected = ACCOUNT_TYPES.find((account) => account.id === draftAccount) || ACCOUNT_TYPES[0]

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button type="button" aria-label={t('close')} className="absolute inset-0 bg-[#0a0d12]/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('switchProfile')}
        className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white px-4 pb-6 pt-4 shadow-lg"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">{t('switchProfile')}</h2>
          <button type="button" aria-label={t('close')} onClick={onClose} className="flex size-9 items-center justify-center rounded-lg hover:bg-bg-active">
            <img src={icons.xClose} alt="" width={20} height={20} />
          </button>
        </div>
        <div className="flex flex-col gap-3">
          {ACCOUNT_TYPES.map((account) => {
            const active = draftAccount === account.id
            return (
              <button
                key={account.id}
                type="button"
                onClick={() => onSelect(account.id)}
                className={`flex h-14 items-center gap-3 rounded-xl border px-4 text-start ${
                  active ? 'border-brand bg-brand-25' : 'border-border bg-white'
                }`}
              >
                <Icon name={account.icon} size={20} />
                <span className="min-w-0 flex-1 text-sm font-semibold text-text-secondary">{t(account.switchLabelKey)}</span>
                <span
                  aria-hidden="true"
                  className={`flex size-5 items-center justify-center rounded-full border-2 ${
                    active ? 'border-brand' : 'border-[#d5d7da]'
                  }`}
                >
                  {active ? <span className="size-2.5 rounded-full bg-brand" /> : null}
                </span>
              </button>
            )
          })}
        </div>
        <Button className="mt-5 w-full" onClick={onConfirm}>
          {t('switchToNamed', { name: t(selected.switchLabelKey) })}
        </Button>
      </div>
    </div>
  )
}

function SupportLink({ icon, label, to, onClick }) {
  const className =
    'flex h-[38px] w-full items-center gap-2 px-3 text-start text-sm font-semibold text-text-secondary hover:bg-bg-active'

  if (to) {
    return (
      <NavLink to={to} role="menuitem" className={className} onClick={onClick}>
        <Icon name={icon} size={16} />
        {label}
      </NavLink>
    )
  }

  return (
    <button type="button" role="menuitem" className={className} onClick={onClick}>
      <Icon name={icon} size={16} />
      {label}
    </button>
  )
}

function CloseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
