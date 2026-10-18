// Remove METRICS, ACTIVITIES, UPCOMING, and NOTIFICATIONS when GET /dashboard is used.
// Keep STATUS_STYLES, FEEDBACK_QUESTIONS, and USER.
// On FEEDBACK_QUESTIONS, remove only the preset `value` scores when POST /feedback is used.

export const METRICS = [
  { id: 'invoices', to: '/invoices', labelKey: 'invoices', value: 12, icon: 'coins', flip: false },
  { id: 'licenses', to: '/licenses', labelKey: 'activeLicenses', value: 29, icon: 'certificate', flip: true },
  { id: 'violations', to: '/violations', labelKey: 'violations', value: 7, icon: 'flag', flip: false },
  { id: 'visits', to: '/visits', labelKey: 'visits', value: 16, icon: 'users', flip: true },
  { id: 'requests', to: '/requests', labelKey: 'myRequests', value: 16, icon: 'clipboard', flip: false },
  { id: 'permits', to: '/permits', labelKey: 'permits', value: 16, icon: 'folderCheck', flip: true },
]

export const ACTIVITIES = [
  {
    id: 'act-1',
    ref: '#LIC2',
    titleKey: 'licenseApplication',
    detailKey: 'submittedBy',
    timeKey: 'ago3d',
    status: 'inReview',
    service: 'licenses',
  },
  {
    id: 'act-2',
    ref: '#LIC2',
    titleKey: 'invoice',
    detailKey: 'amount',
    timeKey: 'ago2d',
    status: 'paid',
    service: 'invoices',
  },
  {
    id: 'act-3',
    ref: '#LIC2',
    titleKey: 'violationNotice',
    detailKey: 'issuedOn',
    timeKey: 'ago5d',
    status: 'open',
    service: 'violations',
    highlighted: true,
  },
  {
    id: 'act-4',
    ref: '#LIC2',
    titleKey: 'permit',
    detailKey: 'portEntry',
    timeKey: 'ago2d',
    status: 'approved',
    service: 'permits',
  },
  {
    id: 'act-5',
    ref: '#LIC2',
    titleKey: 'violationNotice',
    detailKey: 'issuedOn',
    timeKey: 'ago5d',
    status: 'open',
    service: 'violations',
  },
  {
    id: 'act-6',
    ref: '#LIC2',
    titleKey: 'permit',
    detailKey: 'portEntry',
    timeKey: 'ago2d',
    status: 'approved',
    service: 'permits',
  },
  {
    id: 'act-7',
    ref: '#LIC2',
    titleKey: 'permit',
    detailKey: 'submittedBy',
    timeKey: 'ago2d',
    status: 'approved',
    service: 'permits',
  },
]

export const UPCOMING = [
  {
    id: 'up-1',
    ref: '#LIC2',
    titleKey: 'invoiceName',
    detailKey: 'payment',
    dueKey: 'dueOn',
    tone: 'success',
    icon: 'bankNote',
    service: 'invoices',
  },
  {
    id: 'up-2',
    ref: '#LIC2',
    titleKey: 'violation',
    detailKey: 'submitResponse',
    dueKey: 'byDate',
    tone: 'warning',
    icon: 'flagViolation',
    service: 'violations',
  },
  {
    id: 'up-3',
    ref: '#LIC2',
    titleKey: 'violation',
    detailKey: 'submitResponse',
    dueKey: 'byDate',
    tone: 'warning',
    icon: 'flagViolation',
    service: 'violations',
  },
  {
    id: 'up-4',
    ref: '#LIC2',
    titleKey: 'invoiceName',
    detailKey: 'payment',
    dueKey: 'dueOn',
    tone: 'success',
    icon: 'bankNote',
    service: 'invoices',
  },
]

export const NOTIFICATIONS = [
  {
    id: 'nt-1',
    titleKey: 'permitApproved',
    detailKey: 'permitNumber',
    timeKey: 'ago10m',
    unread: true,
  },
  {
    id: 'nt-2',
    titleKey: 'permitApproved',
    detailKey: 'permitNumber',
    timeKey: 'ago1h',
    unread: true,
  },
  {
    id: 'nt-3',
    titleKey: 'permitApproved',
    detailKey: 'permitNumber',
    timeKey: 'ago1d',
    unread: false,
  },
]

export const FEEDBACK_QUESTIONS = [
  { id: 'overall', titleKey: 'qOverall', hintKey: 'qOverallHint', value: 4 },
  { id: 'access', titleKey: 'qAccess', hintKey: 'qAccessHint', value: 5 },
  { id: 'clarity', titleKey: 'qClarity', hintKey: 'qClarityHint', value: 4 },
  { id: 'speed', titleKey: 'qSpeed', hintKey: 'qSpeedHint', value: 5 },
  { id: 'quality', titleKey: 'qQuality', hintKey: 'qQualityHint', value: 0 },
]

export const USER = {
  name: 'Loki Bright',
  email: 'loki@pwc.com',
  welcomeName: 'Ahmad',
}

export const STATUS_STYLES = {
  inReview: 'border-blue-200 bg-blue-50 text-blue-700',
  paid: 'border-success-200 bg-success-50 text-success-700',
  approved: 'border-success-200 bg-success-50 text-success-700',
  open: 'border-indigo-200 bg-indigo-50 text-indigo-700',
}
