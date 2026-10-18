export const PRIMARY_NAV = [
  { id: 'home', to: '/', icon: 'navHomeLine', activeIcon: 'navHome', labelKey: 'home' },
  { id: 'invoices', to: '/invoices', icon: 'navInvoices', activeIcon: 'navInvoicesSolid', labelKey: 'invoices' },
  { id: 'licenses', to: '/licenses', icon: 'navLicenses', activeIcon: 'navLicensesSolid', labelKey: 'licenses' },
  { id: 'violations', to: '/violations', icon: 'navViolations', activeIcon: 'navViolationsSolid', labelKey: 'violations' },
  { id: 'visits', to: '/visits', icon: 'navVisits', activeIcon: 'navVisitsSolid', labelKey: 'visits' },
  { id: 'requests', to: '/requests', icon: 'navRequests', activeIcon: 'navRequestsSolid', labelKey: 'myRequests' },
  { id: 'permits', to: '/permits', icon: 'navPermits', activeIcon: 'navPermitsSolid', labelKey: 'permits' },
  // { id: 'surveys', to: '/surveys', icon: 'messageSmile', activeIcon: 'messageSmile', labelKey: 'surveys' },
]

export const ACCOUNT_TYPES = [
  { id: 'companies', labelKey: 'companies', switchLabelKey: 'companyPossessive', icon: 'building' },
  { id: 'individual', labelKey: 'individual', switchLabelKey: 'individual', icon: 'user' },
  { id: 'employee', labelKey: 'employee', switchLabelKey: 'employee', icon: 'briefcase' },
]

export const SERVICES = {
  invoices: { labelKey: 'invoices', emptyKey: 'emptyInvoices' },
  licenses: { labelKey: 'licenses', emptyKey: 'emptyLicenses' },
  violations: { labelKey: 'violations', emptyKey: 'emptyViolations' },
  visits: { labelKey: 'visits', emptyKey: 'emptyVisits' },
  requests: { labelKey: 'requests', emptyKey: 'emptyRequests' },
  permits: { labelKey: 'permits', emptyKey: 'emptyPermits' },
}
