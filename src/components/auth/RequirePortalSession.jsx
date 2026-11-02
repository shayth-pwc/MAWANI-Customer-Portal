import { Navigate } from 'react-router-dom'
import { useApp } from '../../hooks/useApp'

/** Only a successfully read-back CAP profile authorizes rendering portal screens. */
export default function RequirePortalSession({ children }) {
  const { authStatus, signedIn, sessionError, language, t } = useApp()
  if (authStatus === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-neutral px-5 text-center" role="status">
        <p className="text-md text-text-secondary">{t('loading')}</p>
      </div>
    )
  }
  if (authStatus === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-neutral px-5 text-center">
        <div className="max-w-md rounded-xl border border-border bg-white p-8">
          <h1 className="text-lg font-semibold text-text-primary">
            {language === 'ar' ? 'تعذّر تحميل حساب البوابة' : 'Unable to load your portal account'}
          </h1>
          <p className="mt-3 text-sm text-text-secondary" role="alert">
            {sessionError || (language === 'ar' ? 'يرجى المحاولة مرة أخرى.' : 'Please try again.')}
          </p>
          <button type="button" className="mt-5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white"
            onClick={() => window.location.reload()}>
            {language === 'ar' ? 'إعادة المحاولة' : 'Retry'}
          </button>
        </div>
      </div>
    )
  }
  if (!signedIn) return <Navigate to="/login" replace />
  return children
}
