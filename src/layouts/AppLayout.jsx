import { useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import ContactModal from '../components/common/ContactModal'
import Sidebar from '../components/layout/Sidebar'
import TopBar from '../components/layout/TopBar'
import { useApp } from '../hooks/useApp'

const pageMeta = {
  '/': { titleKey: 'welcomeBack', supportingKey: 'summary' },
  '/empty': { titleKey: 'welcome', supportingKey: 'summary' },
  '/activities': { titleKey: 'activitiesTitle', supportingKey: 'activitiesBody' },
  '/invoices': { titleKey: 'invoices' },
  '/licenses': { titleKey: 'licenses' },
  '/violations': { titleKey: 'violations' },
  '/visits': { titleKey: 'visits' },
  '/requests': { titleKey: 'myRequests' },
  '/permits': { titleKey: 'permits' },
  '/surveys': { titleKey: 'surveys' },
  '/support': { titleKey: 'supportTitle', supportingKey: 'supportBody' },
  '/settings': { titleKey: 'settingsTitle', supportingKey: 'settingsBody' },
}

export default function AppLayout() {
  const { signedIn, t, setContactOpen, language } = useApp()
  const { pathname } = useLocation()
  const adminUserPage = pathname === '/user-management'
  const [collapsed, setCollapsed] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [supportOpen, setSupportOpen] = useState(false)
  const [panel, setPanel] = useState(null)

  if (!signedIn) return <Navigate to="/login" replace />

  const meta = pageMeta[pathname] || { titleKey: 'home', supportingKey: 'summary' }
  const pageOwnsTitle = pathname === '/licenses' || pathname === '/permits' || pathname === '/visits'

  return (
    <div className="flex min-h-screen bg-bg-neutral">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        onToggleCollapse={() => setCollapsed((value) => !value)}
        supportOpen={supportOpen}
        onCloseSupport={() => setSupportOpen(false)}
        onToggleSupport={(action) => {
          if (action === 'contact') {
            setSupportOpen(false)
            setMobileOpen(false)
            setContactOpen(true)
            return
          }
          setSupportOpen((value) => !value)
        }}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          title={adminUserPage ? (language === 'ar' ? 'إدارة المستخدمين' : 'User Management') : t(meta.titleKey)}
          supporting={adminUserPage ? (language === 'ar' ? 'إدارة حسابات SAP IAS' : 'Manage SAP IAS accounts') : (meta.supportingKey ? t(meta.supportingKey) : '')}
          showHeader={!pageOwnsTitle}
          onToggleMenu={() => setMobileOpen(true)}
          panel={panel}
          setPanel={setPanel}
        />
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
      <ContactModal />
    </div>
  )
}
