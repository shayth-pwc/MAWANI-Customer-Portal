import { useCallback, useEffect, useMemo, useState } from 'react'
import { copy } from '../constants/copy'
import { NOTIFICATIONS } from '../constants/dashboard'
import { clearDashboardCache } from '../services/dashboardService'
import { bootstrapPortalProfile, logoutFromPortal, startIasSignIn } from '../services/portalSession'
import { toPortalUser } from '../services/portalProfile'
import { AppContext } from './app-context'

const PUBLIC_PATHS = new Set(['/login', '/signup', '/forgot-password', '/signed-out'])

export function AppProvider({ children }) {
  const publicRoute = PUBLIC_PATHS.has(window.location.pathname)
  const [language, setLanguage] = useState('en')
  const [accountType, setAccountType] = useState('companies')
  const [authStatus, setAuthStatus] = useState(publicRoute ? 'anonymous' : 'checking')
  const [sessionError, setSessionError] = useState('')
  const [profile, setProfile] = useState(null)
  const [boot, setBoot] = useState(publicRoute ? 'idle' : 'loading')
  // The notification service is not part of v0.7.4; only show samples locally.
  const [notifications, setNotifications] = useState(import.meta.env.DEV ? NOTIFICATIONS : [])
  const [contactOpen, setContactOpen] = useState(false)

  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
  }, [language])

  useEffect(() => {
    if (publicRoute) return undefined
    let cancelled = false
    bootstrapPortalProfile()
      .then((verified) => {
        if (cancelled) return
        setProfile(verified)
        setSessionError('')
        setAuthStatus('authenticated')
      })
      .catch((error) => {
        if (cancelled) return
        setProfile(null)
        setAuthStatus('error')
        setSessionError(error?.message || 'Unable to verify your portal session.')
      })
      .finally(() => { if (!cancelled) setBoot('idle') })
    return () => { cancelled = true }
  }, [publicRoute])

  const t = useCallback((key, values) => {
    const template = copy[language][key] ?? key
    if (!values) return template
    return Object.entries(values).reduce(
      (text, [name, value]) => text.replace(`{${name}}`, String(value)), template,
    )
  }, [language])

  const unreadCount = notifications.filter((item) => item.unread).length
  const markAllRead = useCallback(() => {
    setNotifications((items) => items.map((item) => ({ ...item, unread: false })))
  }, [])
  const toggleLanguage = useCallback(() => {
    setLanguage((current) => (current === 'en' ? 'ar' : 'en'))
  }, [])
  const enterApp = useCallback(() => { startIasSignIn() }, [])
  const leaveApp = useCallback(() => {
    clearDashboardCache()
    setProfile(null)
    setAuthStatus('anonymous')
    logoutFromPortal()
  }, [])

  const signedIn = authStatus === 'authenticated' && profile?.ACTIVE_STATUS === true
  const user = useMemo(() => toPortalUser(profile), [profile])

  const value = useMemo(() => ({
    language, setLanguage, toggleLanguage,
    accountType, setAccountType,
    signedIn, authStatus, sessionError, profile,
    boot, enterApp, leaveApp, user,
    notifications, unreadCount, markAllRead,
    contactOpen, setContactOpen, t,
  }), [
    language, toggleLanguage, accountType, signedIn, authStatus, sessionError,
    profile, boot, enterApp, leaveApp, user, notifications, unreadCount,
    markAllRead, contactOpen, t,
  ])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
