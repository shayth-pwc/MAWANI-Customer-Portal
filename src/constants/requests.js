// No requests endpoint yet. Remove LICENSE_REQUEST_ROWS, PERMIT_REQUEST_ROWS,
// OBJECTION_REQUEST_ROWS, LICENSE_REQUEST_INFO, and RELATED_LICENSE when one is added.
// Keep PERMIT_TYPES and PERMIT_PORTS.

const licenseStatuses = ['Open', 'Open', 'Approved', 'Approved', 'Approved', 'Approved', 'Rejected', 'Open', 'Open', 'Open', 'Approved', 'Open']
const permitStatuses = ['Open', 'Open', 'In Review', 'In Review', 'In Review', 'In Review', 'Canceled', 'Open', 'Open', 'Open', 'In Review', 'Open']
const objectionStatuses = ['Open', 'Open', 'Approved', 'Rejected', 'Rejected', 'Rejected', 'Rejected', 'Open', 'Approved', 'Open', 'Rejected', 'Open']

export const LICENSE_REQUEST_ROWS = Array.from({ length: 29 }, (_, index) => ({
  id: `req-lic-${index + 1}`,
  number: '2327',
  service: 'Waste Recycling And Ship Waste Management',
  company: 'Al-Qutban Trading Company Limited',
  investor: 'Saudi',
  date: '2028-12-21',
  requestDate: 'April 22, 2025',
  status: licenseStatuses[index % licenseStatuses.length],
  amount: '7,000',
}))

export const PERMIT_REQUEST_ROWS = Array.from({ length: 29 }, (_, index) => ({
  id: `req-permit-${index + 1}`,
  number: '2327',
  permitType: 'Activity in port',
  license: 'License name here',
  date: '2028-12-21',
  requestDate: 'April 22, 2025',
  status: permitStatuses[index % permitStatuses.length],
  ports: 'King Abdulaziz In Dammam',
}))

export const OBJECTION_REQUEST_ROWS = Array.from({ length: 29 }, (_, index) => ({
  id: `req-obj-${index + 1}`,
  number: '2327',
  related: 'Violation name here',
  date: '2028-12-21',
  requestDate: 'April 22, 2025',
  status: objectionStatuses[index % objectionStatuses.length],
  subject: 'طلب اعتراض على الفاتوره رقم 21321321321312',
  reason: 'Reason here',
  objectionSubject: 'Activity in port',
  reasonDetail: 'طلب اعتراض على الفاتوره رقم 21321321321312',
}))

export const LICENSE_REQUEST_INFO = {
  company: 'The fifth shipping company',
  investor: 'Saudi',
  licenseType: 'Waste Recycling And Ship Waste Management',
  amount: '10,000 SAR',
  crNational: '7001384663',
  crNumber: '2054100441',
  sadad: '21321321321312',
  ports: 'King Abdulaziz In Dammam',
}

export const RELATED_LICENSE = {
  code: '331501-0003',
  title: 'Routine repair and maintenance of ships',
  expiry: 'April 22, 2025',
  status: 'Expired',
}

export const PERMIT_TYPES = ['Activity in port', 'Port entry', 'Hot work']
export const PERMIT_PORTS = ['Jubail Commercial Port', 'King Abdulaziz In Dammam', 'Yanbu Commercial Port', 'Jeddah Islamic Port']
