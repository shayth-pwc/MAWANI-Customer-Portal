import { useEffect, useState } from 'react'
import { getCachedDashboard, loadDashboard } from '../services/dashboardService'

export function useDashboard() {
  const cached = getCachedDashboard()
  const [data, setData] = useState(cached)
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    loadDashboard()
      .then((result) => {
        if (active) setData(result)
      })
      .catch(() => {
        if (active) setError('unavailable')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  return { data, loading, error }
}
