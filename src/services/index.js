/*
  Wire a screen by calling the service, then delete only the static records that
  service returns. Leave copy.js, navigation.js, and label maps in place.

  GET /dashboard
    Use fetchDashboard. Remove METRICS, ACTIVITIES, UPCOMING, and NOTIFICATIONS
    from constants/dashboard.js, and remove localDashboard() in dashboardService.js.
    Keep STATUS_STYLES and FEEDBACK_QUESTIONS.

  POST /feedback
    Use submitFeedback({ ratings, comments }). Remove the preset `value` scores on
    FEEDBACK_QUESTIONS. Keep id, titleKey, and hintKey.

  POST /support
    Use submitSupportMessage({ email, subject, message }). No static list stands in
    for this call. email still comes from USER until a current-user endpoint exists.

  GET /survey/stats?pageKey
  POST /survey/responses
    Use getSurveyStats and submitSurveyResponse. These are the public page
    questionnaire ({ data, isSuccess } or { success: true }). They do not return
    the Surveys cards, so keep SURVEYS, SURVEY_COMMENT, and SURVEY_RATINGS.

  No endpoint in this folder yet, so keep the record arrays in:
    constants/licenses.js, permits.js, invoices.js, violations.js, visits.js,
    requests.js, and profile.js.
*/

export { apiClient, createApiClient, getApiBaseUrl, onApiError } from './client'
export { ApiError, toApiError } from './errors'
export { RequestError } from './requestError'
export { requireSuccess, unwrap } from './response'
export { fetchDashboard } from './dashboardApi'
export { submitFeedback } from './feedbackApi'
export { submitSupportMessage } from './supportApi'
export { getSurveyStats, submitSurveyResponse } from './surveyApi'
