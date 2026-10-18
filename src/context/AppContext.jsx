import { useCallback, useEffect, useMemo, useState } from 'react'
import { copy } from '../constants/copy'
import { NOTIFICATIONS, USER } from '../constants/dashboard'
import { clearDashboardCache, loadDashboard } from '../services/dashboardService'
import { AppContext } from './app-context'

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export function AppProvider({ children }) {
  const [language, setLanguage] = useState('en')
  const [accountType, setAccountType] = useState('companies')
  const [signedIn, setSignedIn] = useState(false)
  const [boot, setBoot] = useState('idle')
  const [notifications, setNotifications] = useState(NOTIFICATIONS)
  const [contactOpen, setContactOpen] = useState(false)

  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
  }, [language])

  const t = useCallback(
    (key, values) => {
      const template = copy[language][key] ?? key
      if (!values) return template
      return Object.entries(values).reduce(
        (text, [name, value]) => text.replace(`{${name}}`, String(value)),
        template,
      )
    },
    [language],
  )

  const unreadCount = notifications.filter((item) => item.unread).length

  const markAllRead = useCallback(() => {
    setNotifications((items) => items.map((item) => ({ ...item, unread: false })))
  }, [])

  const toggleLanguage = useCallback(() => {
    setLanguage((current) => (current === 'en' ? 'ar' : 'en'))
  }, [])

  const enterApp = useCallback(async () => {
    setBoot('loading')
    setSignedIn(true)
    await Promise.all([loadDashboard(), wait(700)])
    setBoot('leaving')
  }, [])

  const leaveApp = useCallback(() => {
    clearDashboardCache()
    setSignedIn(false)
    setBoot('idle')
  }, [])

  useEffect(() => {
    if (boot !== 'leaving') return undefined
    const timer = setTimeout(() => setBoot('idle'), 500)
    return () => clearTimeout(timer)
  }, [boot])

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      toggleLanguage,
      accountType,
      setAccountType,
      signedIn,
      setSignedIn,
      boot,
      enterApp,
      leaveApp,
      user: USER,
      notifications,
      unreadCount,
      markAllRead,
      contactOpen,
      setContactOpen,
      t,
    }),
    [
      language,
      toggleLanguage,
      accountType,
      signedIn,
      boot,
      enterApp,
      leaveApp,
      notifications,
      unreadCount,
      markAllRead,
      contactOpen,
      t,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
