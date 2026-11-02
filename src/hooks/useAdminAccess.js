import { useEffect, useState } from 'react'
import { checkAdminAccess } from '../services/adminIasApi'

/** Display permission is informative only: every action is guarded by CAP. */
export function useAdminAccess() {
  const [state, setState] = useState({ status: 'checking', error: '' })
  const [retryKey, setRetryKey] = useState(0)
  useEffect(() => {
    let cancelled = false
    checkAdminAccess()
      .then((allowed) => {
        if (!cancelled) setState({ status: allowed ? 'allowed' : 'denied', error: '' })
      })
      .catch((error) => {
        if (!cancelled) setState({ status: 'error', error: error.message })
      })
    return () => { cancelled = true }
  }, [retryKey])
  const retry = () => {
    setState({ status: 'checking', error: '' })
    setRetryKey((key) => key + 1)
  }
  return { ...state, retry }
}
