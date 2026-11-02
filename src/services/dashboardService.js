// Remove localDashboard() and the four imports below once GET /dashboard
// always returns { metrics, activities, upcoming, notifications }.

import { ACTIVITIES, METRICS, NOTIFICATIONS, UPCOMING } from '../constants/dashboard'
import { fetchDashboard } from './dashboardApi'

let cachedDashboard = null
let dashboardRequest = null

export function clearDashboardCache() {
  cachedDashboard = null
  dashboardRequest = null
}

export function getCachedDashboard() {
  return cachedDashboard
}

export function loadDashboard() {
  if (cachedDashboard) return Promise.resolve(cachedDashboard)
  if (!dashboardRequest) {
    dashboardRequest = fetchDashboard()
      .then((remote) => {
        cachedDashboard = remote?.metrics && remote?.activities ? remote : localDashboard()
        return cachedDashboard
      })
      .catch(() => {
        cachedDashboard = localDashboard()
        return cachedDashboard
      })
  }
  return dashboardRequest
}

export function localDashboard() {
  return {
    isDemo: true,
    metrics: METRICS,
    activities: ACTIVITIES,
    upcoming: UPCOMING,
    notifications: NOTIFICATIONS,
  }
}
