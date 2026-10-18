// No visits endpoint yet. Remove VISITS and VISIT_TODAY when one is added.
// Keep PORT_OPTIONS, VISIT_TYPES, and VISIT_RANGES.

const pdf = { name: 'Visitform.pdf', kind: 'PDF' }
const jpg = { name: 'Image.jpg', kind: 'JPG' }

const fullTitle = 'The fifth shipping company for system installation'
const shortTitle = 'The fifth shipping company for system'

const weekPattern = [
  { urgency: 'none', title: fullTitle, files: [pdf, jpg, jpg] },
  { urgency: 'today', title: shortTitle, files: [pdf] },
  { urgency: 'none', title: fullTitle, files: [pdf, jpg] },
  { urgency: 'none', title: fullTitle, files: [pdf, jpg, jpg] },
  { urgency: 'due', title: shortTitle, files: [pdf] },
  { urgency: 'none', title: fullTitle, files: [pdf, jpg] },
  { urgency: 'none', title: shortTitle, files: [pdf, jpg] },
  { urgency: 'none', title: fullTitle, files: [pdf, jpg] },
  { urgency: 'none', title: shortTitle, files: [pdf] },
]

export const VISIT_TODAY = '2026-08-25'
export const PORT_OPTIONS = ['Yanbu Commercial Port', 'Jeddah Islamic Port', 'King Abdulaziz Port']
export const VISIT_TYPES = ['Sudden', 'Periodic', 'Follow-Up']
export const VISIT_RANGES = [
  { id: 'week', label: 'This week' },
  { id: 'days30', label: 'Next 30 Days' },
  { id: 'days90', label: 'Next 90 Days' },
]

export const VISITS = [
  ...weekPattern.map((item, index) => ({
    id: `visit-${index + 1}`,
    code: '3460',
    date: VISIT_TODAY,
    type: 'Sudden',
    port: 'Yanbu Commercial Port',
    ...item,
  })),
  {
    id: 'visit-periodic-1',
    code: '3461',
    date: '2026-09-10',
    type: 'Periodic',
    port: 'Jeddah Islamic Port',
    urgency: 'none',
    title: fullTitle,
    files: [pdf],
  },
  {
    id: 'visit-periodic-2',
    code: '3462',
    date: '2026-09-18',
    type: 'Periodic',
    port: 'Yanbu Commercial Port',
    urgency: 'none',
    title: shortTitle,
    files: [pdf, jpg],
  },
  {
    id: 'visit-follow-1',
    code: '3463',
    date: '2026-10-20',
    type: 'Follow-Up',
    port: 'King Abdulaziz Port',
    urgency: 'none',
    title: fullTitle,
    files: [pdf, jpg, jpg],
  },
]
