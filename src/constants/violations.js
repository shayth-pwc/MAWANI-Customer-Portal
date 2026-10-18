// No violations endpoint yet. Remove VIOLATIONS, UNPAID_FINES, OBJECTION_REQUESTS, and
// VIOLATION_DETAIL when one is added. Keep LICENSE_TYPE_OPTIONS, PORT_OPTIONS,
// FINE_STATUS_OPTIONS, and OBJECTION_HINT.

const fineStatuses = [
  'Not Paid',
  'Not Applicable',
  'Not Paid',
  'Not Applicable',
  'Not Applicable',
  'Not Paid',
  'Not Paid',
  'Not Applicable',
  'Not Applicable',
  'Not Applicable',
  'Not Paid',
  'Not Paid',
]

const requestStatuses = [
  'Open',
  'Open',
  'Approved',
  'Rejected',
  'Rejected',
  'Rejected',
  'Rejected',
  'Open',
  'Approved',
  'Open',
  'Rejected',
  'Open',
]

export const LICENSE_TYPE_OPTIONS = ['Ships Supplier', 'Marine Agents', 'Shipping Agent']
export const PORT_OPTIONS = ['Yanbu Commercial Port', 'Jeddah Islamic Port', 'King Abdulaziz Port']
export const FINE_STATUS_OPTIONS = ['Not Paid', 'Paid', 'Not Applicable', 'Cancelled']

export const OBJECTION_HINT =
  'Please attach an official letter objecting to the issued violation, explaining the reasons and justifications with the supporting documents, within a period of (30) days from the violation date.'

export const VIOLATION_DETAIL = {
  fineId: '9000003843',
  description: 'Description of objection request',
  subject: 'المادة (6-أولاً-التعهدات)',
  type: 'Fine',
  amount: '70000',
  company: 'The fifth shipping company',
  expiryLabel: '5,April 22, 2025',
  expiry: '2025-04-22',
  title: 'Article (6-First-Undertakings-1)',
  violationDate: 'April 22, 2025',
  licenseNumber: '522912-0002',
  licenseType: 'Ships Supplier',
  crNational: '7001384663',
  crNumber: '2054100441',
  fineAmount: '10,000 SAR',
  objectionExpiry: 'April 22, 2025',
  sadad: '21321321321312',
  port: 'Yanbu Commercial Port',
  body: 'Regulations for Ship Suppliers – Article (6 – First – Undertakings – 1): Compliance with all instructions and regulations issued by the General Authority for Ports and port administrations.',
}

export const VIOLATIONS = Array.from({ length: 29 }, (_, index) => {
  let status = fineStatuses[index % fineStatuses.length]
  if (index === 26 || index === 27) status = 'Paid'
  if (index === 28) status = 'Cancelled'
  return {
    id: `vio-${index + 1}`,
    ...VIOLATION_DETAIL,
    status,
  }
})

export const UNPAID_FINES = Array.from({ length: 11 }, (_, index) => ({
  id: `unpaid-${index + 1}`,
  ...VIOLATION_DETAIL,
  status: 'Not Paid',
}))

export const OBJECTION_REQUESTS = Array.from({ length: 29 }, (_, index) => ({
  id: `obj-${index + 1}`,
  number: '2327',
  related: 'Violation name here',
  date: '2028-12-21',
  requestDate: 'April 22, 2025',
  status: requestStatuses[index % requestStatuses.length],
  subject: 'طلب الاعتراض على الفاتورة رقم 21321321321312',
  reason: 'Reason here',
  objectionSubject: 'Activity in port',
  reasonDetail: 'طلب اعتراض على الفاتورة رقم',
}))
