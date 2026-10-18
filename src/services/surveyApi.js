// Public page questionnaire. unwrap() returns `data` from { data, isSuccess }.
// GET /survey/stats?pageKey is aggregate stats, not the Surveys card list.
// POST /survey/responses body: { pageKey, surveyVersion, answer: 'yes' | 'no', reasonCodes, comment?, gender? }.
// Keep SURVEYS, SURVEY_COMMENT, and SURVEY_RATINGS in constants/surveys.js.

import { apiClient } from './client'
import { unwrap } from './response'

const SURVEY_STATS_ENDPOINT = '/survey/stats'
const SURVEY_RESPONSES_ENDPOINT = '/survey/responses'

export function getSurveyStats(pageKey, client = apiClient) {
  return client.get(SURVEY_STATS_ENDPOINT, { params: { pageKey } }).then(unwrap)
}

export function submitSurveyResponse(payload, client = apiClient) {
  return client.post(SURVEY_RESPONSES_ENDPOINT, payload).then(unwrap)
}
