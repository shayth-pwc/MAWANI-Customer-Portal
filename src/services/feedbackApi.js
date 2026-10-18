// POST /feedback body: { ratings, comments }.
// FEEDBACK_QUESTIONS stays for the form ids and copy keys. Remove only its preset `value` scores.

import { apiClient } from './client'

const FEEDBACK_ENDPOINT = '/feedback'

export function submitFeedback(payload, client = apiClient) {
  return client.post(FEEDBACK_ENDPOINT, payload)
}
