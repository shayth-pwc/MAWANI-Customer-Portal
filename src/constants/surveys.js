// SURVEYS and SURVEY_COMMENT stay. GET /survey/stats and POST /survey/responses
// do not return these cards. Keep SURVEY_RATINGS; those label keys are not records.

export const SURVEY_COMMENT =
  'We would love to hear your thoughts! Please share your feedback about our product or service. Your insights are invaluable to us and help us improve. Whether it\'s a suggestion for new features, comments on usability, or any issues you\'ve encountered, we want to know. Thank you for taking the time to help us enhance your experience!'

const SERVICES = ['Objections', 'Licenses', 'Permits']

const REQUEST_KEYS = {
  Objections: 'surveyObjectionRequest',
  Licenses: 'surveyLicenseRequest',
  Permits: 'surveyPermitRequest',
}

const SYSTEM_KEYS = {
  Objections: 'violations',
  Licenses: 'licenses',
  Permits: 'permits',
}

export const SURVEY_RATINGS = [
  { id: 'overall', labelKey: 'surveyOverall' },
  { id: 'ease', labelKey: 'surveyEase' },
  { id: 'clarity', labelKey: 'surveyClarity' },
  { id: 'speed', labelKey: 'surveySpeed' },
  { id: 'quality', labelKey: 'surveyQuality' },
]

export const SURVEYS = Array.from({ length: 24 }, (_, index) => {
  const service = SERVICES[index % SERVICES.length]
  return {
    id: `survey-${index + 1}`,
    name: 'Olivia Rhye',
    email: 'olivia@pwc.com',
    phone: '5321048800',
    location: 'Lebanon',
    submittedAt: '2026-08-25T13:10:29',
    service,
    requestKey: REQUEST_KEYS[service],
    licensePermit: 'Ship Supplier',
    requestNo: '2327',
    systemKey: SYSTEM_KEYS[service],
    scores: { overall: 4, ease: 4, clarity: 4, speed: 4, quality: 4 },
    comment: SURVEY_COMMENT,
  }
})
