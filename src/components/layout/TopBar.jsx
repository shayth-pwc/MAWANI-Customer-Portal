import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { icons } from '../../assets'
import { ACCOUNT_TYPES } from '../../constants/navigation'
import { useApp } from '../../hooks/useApp'
import { useClickOutside } from '../../hooks/useClickOutside'
import Avatar from '../ui/Avatar'
import Icon from '../ui/Icon'
import NotificationItem from '../common/NotificationItem'
import PageHeader from './PageHeader'

export default function TopBar({ title, supporting, onToggleMenu, panel, setPanel }) {
  const { t, language, user, notifications, unreadCount, markAllRead, toggleLanguage, accountType, setAccountType, leaveApp } =
    useApp()
  const navigate = useNavigate()
  const bellRef = useRef(null)
  const profileRef = useRef(null)

  useClickOutside(bellRef, () => setPanel(null), panel === 'notifications')
  useClickOutside(profileRef, () => setPanel(null), panel === 'profile' || panel === 'accounts')

  const signOut = () => {
    setPanel(null)
    navigate('/signed-out')
    leaveApp()
  }

  return (
    <div className="flex flex-wrap items-start justify-between gap-4 px-4 pt-6 md:px-8 md:pt-8">
      <div className="flex min-w-0 items-start gap-3">
        <button
          type="button"
          className="mt-1 flex size-10 items-center justify-center rounded-lg border border-border bg-white lg:hidden"
          aria-label={t('openMenu')}
          onClick={onToggleMenu}
        >
          <Icon name="grid" size={18} />
        </button>
        <PageHeader title={title} supporting={supporting} />
      </div>
      <div className="ms-auto flex items-center gap-3">
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
        <div className="relative hidden lg:block" ref={profileRef}>
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
