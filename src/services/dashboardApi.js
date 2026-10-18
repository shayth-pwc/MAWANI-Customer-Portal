// GET /dashboard replaces METRICS, ACTIVITIES, UPCOMING, and NOTIFICATIONS.
// Use the body when it has metrics and activities. Otherwise dashboardService
// keeps the static fallback. USER is not part of this response.

import { apiClient } from './client'

const DASHBOARD_ENDPOINT = '/dashboard'

export function fetchDashboard(client = apiClient) {
  return client.get(DASHBOARD_ENDPOINT)
}
