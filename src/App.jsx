import { BrowserRouter } from 'react-router-dom'
import { useEffect } from 'react'
import { SessionTransition } from './components/common/LoadingScreen'
import { AppProvider } from './context/AppContext'
import AppRoutes from './routes/AppRoutes'
import { isLocalUiPreview } from './services/portalSession'

function LocalPreviewWriteGuard() {
  useEffect(() => {
    const nativeFetch = window.fetch
    window.fetch = (input, options = {}) => {
      const method = String(options.method || input?.method || 'GET').toUpperCase()
      if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return nativeFetch(input, options)
      return Promise.resolve(new Response(JSON.stringify({ error: { message: 'Backend writes are disabled in local UI preview mode.' } }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      }))
    }
    return () => { window.fetch = nativeFetch }
  }, [])
  return null
}

export default function App() {
  const localUiPreview = isLocalUiPreview()
  return (
    <BrowserRouter>
      <AppProvider>
        {localUiPreview ? <LocalPreviewWriteGuard /> : null}
        {localUiPreview ? (
          <div className="fixed inset-x-0 top-0 z-[100] bg-amber-100 px-4 py-2 text-center text-xs font-semibold text-amber-950" role="status">
            Local UI preview — IAS login, CSRF, and backend writes are disabled in this development-only mode.
          </div>
        ) : null}
        <AppRoutes />
        <SessionTransition />
      </AppProvider>
    </BrowserRouter>
  )
}
