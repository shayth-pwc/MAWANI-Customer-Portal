import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { icons, images } from '../../assets'
import { ACCOUNT_TYPES } from '../../constants/navigation'
import { useApp } from '../../hooks/useApp'
import { useClickOutside } from '../../hooks/useClickOutside'
import Avatar from '../ui/Avatar'
import Icon from '../ui/Icon'
import NotificationItem from '../common/NotificationItem'
import PageHeader from './PageHeader'

export default function TopBar({ title, supporting, showHeader = true, onToggleMenu, panel, setPanel }) {
  const { t, language, user, notifications, unreadCount, markAllRead, toggleLanguage, accountType, setAccountType, leaveApp } =
    useApp()
  const navigate = useNavigate()
  const bellRef = useRef(null)
  const profileRef = useRef(null)
  const [notifFilter, setNotifFilter] = useState('all')

  useClickOutside(bellRef, () => setPanel(null), panel === 'notifications')
  useClickOutside(profileRef, () => setPanel(null), panel === 'profile' || panel === 'accounts')

  const signOut = () => {
    setPanel(null)
    leaveApp() // SAP App Router central logout, not just local React state
  }

  const filtered = useMemo(() => {
    if (notifFilter === 'unread') return notifications.filter((item) => item.unread)
    return notifications
  }, [notifications, notifFilter])

  const today = filtered.filter((item) => item.day !== 'yesterday')
  const yesterday = filtered.filter((item) => item.day === 'yesterday')

  return (
    <>
      <div className="px-4 pt-4 md:px-8 md:pt-8">
        <div className="relative flex items-center justify-between gap-3 lg:hidden">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-white"
              aria-label={t('openMenu')}
              onClick={onToggleMenu}
            >
              <MenuIcon />
            </button>
            <span className="shrink-0 rounded-lg border border-brand px-2.5 py-1 text-xs font-semibold text-brand">{t(accountType)}</span>
          </div>
          <div className="pointer-events-none absolute inset-y-0 left-1/2 flex -translate-x-1/2 items-center">
            <LogoMark />
          </div>
          <button
            type="button"
            aria-expanded={panel === 'notifications'}
            aria-label={t('notifications')}
            onClick={() => setPanel(panel === 'notifications' ? null : 'notifications')}
            className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-white shadow-xs"
          >
            <img src={unreadCount ? icons.bellNew : icons.bell} alt="" width={20} height={20} />
          </button>
        </div>

        <div className={`flex flex-wrap items-start justify-between gap-4 ${showHeader ? 'mt-4 lg:mt-0' : 'mt-0 max-lg:hidden'}`}>
          {showHeader ? (
            <>
              <div className="hidden min-w-0 items-start gap-3 lg:flex">
                <PageHeader title={title} supporting={supporting} />
              </div>
              <div className="min-w-0 flex-1 lg:hidden">
                <PageHeader title={title} supporting={supporting} />
              </div>
            </>
          ) : (
            <div className="hidden min-w-0 items-start gap-3 lg:flex">
              <PageHeader title={title} supporting={supporting} />
            </div>
          )}
          <div className="ms-auto hidden items-center gap-3 lg:flex">
            <div className="relative" ref={bellRef}>
              <button
                type="button"
                aria-expanded={panel === 'notifications'}
                aria-label={t('notifications')}
                onClick={() => setPanel(panel === 'notifications' ? null : 'notifications')}
                className="flex size-10 items-center justify-center rounded-lg border border-border bg-white shadow-xs"
              >
                <img src={unreadCount ? icons.bellNew : icons.bell} alt="" width={20} height={20} />
              </button>
              {panel === 'notifications' ? (
                <div
                  role="menu"
                  className="absolute end-0 top-12 z-30 w-[min(350px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-white shadow-lg"
                >
                  <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-text-secondary">{t('notifications')}</p>
                      {unreadCount ? (
                        <p className="text-sm text-text-tertiary">{t('unreadCount', { count: unreadCount })}</p>
                      ) : null}
                    </div>
                    {unreadCount ? (
                      <button type="button" className="text-sm font-semibold text-brand" onClick={markAllRead}>
                        {t('markAllRead')}
                      </button>
                    ) : null}
                  </div>
                  {notifications.map((item) => (
                    <NotificationItem key={item.id} item={item} />
                  ))}
                </div>
              ) : null}
            </div>
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                aria-expanded={panel === 'profile' || panel === 'accounts'}
                aria-label={user.name}
                onClick={() => setPanel(panel === 'profile' ? null : 'profile')}
                className="rounded-full"
              >
                <Avatar />
              </button>
              {panel === 'profile' || panel === 'accounts' ? (
                <div
                  role="menu"
                  className="absolute end-0 top-12 z-30 w-[240px] overflow-visible rounded-xl border border-border bg-white shadow-lg"
                >
                  <div className="flex items-center gap-3 border-b border-border px-3 py-3">
                    <Avatar size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-text-secondary">{user.name}</p>
                      <p className="truncate text-sm text-text-tertiary">{user.email}</p>
                    </div>
                    <button
                      type="button"
                      aria-label={t('switchProfile')}
                      aria-expanded={panel === 'accounts'}
                      className="rounded-sm p-1 hover:bg-bg-active"
                      onClick={() => setPanel(panel === 'accounts' ? 'profile' : 'accounts')}
                    >
                      <Icon name="chevronSelector" size={16} />
                    </button>
                  </div>
                  <MenuButton
                    icon="edit"
                    label={t('companyProfile')}
                    active
                    onClick={() => {
                      setPanel(null)
                      navigate('/profile')
                    }}
                  />
                  <MenuButton
                    icon="globe"
                    label={t(language === 'ar' ? 'switchToEnglish' : 'switchToArabic')}
                    onClick={() => {
                      toggleLanguage()
                      setPanel(null)
                    }}
                  />
                  <MenuButton
                    icon="tool"
                    label={t('manageSite')}
                    trailing="linkExternal"
                    onClick={() => {
                      setPanel(null)
                      navigate('/settings')
                    }}
                  />
                  <div className="my-1 border-t border-border" />
                  <MenuButton icon="logout" label={t('signOut')} onClick={signOut} />
                  {panel === 'accounts' ? (
                    <div
                      role="menu"
                      className="absolute end-full top-2 z-40 me-2 w-44 overflow-hidden rounded-xl border border-border bg-white py-1 shadow-lg"
                    >
                      <p className="px-3 py-2 text-xs font-medium text-text-tertiary">{t('switchProfile')}</p>
                      {ACCOUNT_TYPES.map((account) => (
                        <button
                          key={account.id}
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm font-semibold text-text-secondary hover:bg-bg-active"
                          onClick={() => {
                            setAccountType(account.id)
                            setPanel(null)
                          }}
                        >
                          <Icon name={account.icon} size={16} />
                          <span className="flex-1">{t(account.labelKey)}</span>
                          {accountType === account.id ? <Icon name="check" size={16} /> : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {panel === 'notifications' ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-white lg:hidden">
          <div className="flex items-center justify-between px-4 pb-2 pt-4">
            <button
              type="button"
              aria-label={t('close')}
              onClick={() => setPanel(null)}
              className="flex size-10 items-center justify-center rounded-lg text-text-secondary"
            >
              <img src={icons.chevronLeft} alt="" width={20} height={20} className="rtl:rotate-180" />
            </button>
            <LogoMark />
            <span className="size-10" aria-hidden="true" />
          </div>
          <div className="flex items-center justify-between gap-3 px-4 pt-2">
            <h1 className="text-display-xs font-semibold text-text-primary">{t('notifications')}</h1>
            <button type="button" className="text-sm font-semibold text-brand" onClick={markAllRead}>
              {t('markAllRead')}
            </button>
          </div>
          <div className="mt-4 flex gap-1 px-4">
            <div className="flex w-full gap-1 rounded-xl bg-[#f2f4f7] p-1">
              {[
                { id: 'all', label: t('notifAll'), count: notifications.length },
                { id: 'unread', label: t('notifUnread'), count: unreadCount },
              ].map((tab) => {
                const active = notifFilter === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setNotifFilter(tab.id)}
                    className={`inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-semibold ${
                      active ? 'bg-brand-50 text-brand' : 'text-text-tertiary'
                    }`}
                  >
                    {tab.label}
                    <span className={`rounded-md px-1.5 py-0.5 text-xs ${active ? 'border border-brand/30' : 'bg-white text-text-placeholder'}`}>
                      {tab.count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="mt-4 flex-1 overflow-y-auto">
            {today.length ? (
              <section>
                <p className="px-4 py-2 text-sm font-medium text-text-tertiary">{t('notifToday')}</p>
                {today.map((item) => (
                  <NotificationItem key={item.id} item={item} mobile />
                ))}
              </section>
            ) : null}
            {yesterday.length ? (
              <section>
                <p className="px-4 py-2 text-sm font-medium text-text-tertiary">{t('notifYesterday')}</p>
                {yesterday.map((item) => (
                  <NotificationItem key={item.id} item={item} mobile />
                ))}
              </section>
            ) : null}
          </div>
          <p className="px-4 py-4 text-center text-xs text-text-placeholder">{t('rightsReserved')}</p>
        </div>
      ) : null}
    </>
  )
}

function MenuButton({ icon, label, trailing, active, onClick }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex h-10 w-full items-center gap-2 px-3 text-start text-sm font-semibold ${active ? 'bg-bg-active text-text-hover' : 'text-text-secondary hover:bg-bg-neutral'}`}
    >
      <Icon name={icon} size={16} />
      <span className="flex-1">{label}</span>
      {trailing ? <Icon name={trailing} size={16} /> : null}
    </button>
  )
}

function LogoMark() {
  return (
    <div className="relative h-9 w-8 overflow-hidden" aria-label="Mawani">
      <img src={images.logo} alt="" className="absolute top-[-0.12%] left-[-190.41%] h-full w-[290.42%] max-w-none" />
    </div>
  )
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3.333 5h13.334M3.333 10h13.334M3.333 15h13.334" stroke="#535862" strokeWidth="1.67" strokeLinecap="round" />
    </svg>
  )
}
