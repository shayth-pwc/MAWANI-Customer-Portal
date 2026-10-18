// POST /support body: { email, subject, message }.
// No static list to remove. email still comes from USER in constants/dashboard.js.

import { apiClient } from './client'

const SUPPORT_ENDPOINT = '/support'

export function submitSupportMessage(payload, client = apiClient) {
  return client.post(SUPPORT_ENDPOINT, payload)
}
