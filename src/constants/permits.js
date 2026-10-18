// No permits endpoint yet. Remove PERMITS, PERMIT_REQUESTS, and PERMIT_LICENSES when one is added.
// Keep PERMIT_TYPE_OPTIONS, PORT_OPTIONS, UPLOAD_HINT, UNDERTAKING, and UNDERTAKING_PREVIEW.

const nestedStatuses = ['Open', 'Open', 'In Review', 'In Review', 'In Review', 'In Review']
const requestStatuses = ['Open', 'Open', 'In Review', 'In Review', 'In Review', 'In Review', 'Canceled', 'Open', 'Open', 'Open', 'In Review', 'Open']

export const PERMIT_TYPE_OPTIONS = ['Activity in port', 'Activity In Port', 'Port entry']
export const PORT_OPTIONS = ['Jubail Commercial', 'Yanbu Commercial Port', 'King Abdulaziz In Dammam']

export const UPLOAD_HINT =
  'Please attach copies of all the required documents as per the Operational Controls in the General Regulations for Licenses and Permits'

export const UNDERTAKING =
  'I / We, the applicant hereby undertake to comply with all instructions and requirements issued by the General Directorate of Civil Defense, the Saudi Ports Authority, and the relevant port administrations.'

export const UNDERTAKING_PREVIEW =
  'I / We, the applicant hereby undertake to comply with all instructions and requirements issued by the General Directorate of Civil Defense, the Sau.'

function nestedPermit(index, status) {
  return {
    id: `nested-${index}`,
    number: '2327',
    permitNumber: 'SAJED-0064',
    type: 'Activity in port',
    start: '2028-12-21',
    expiry: '2028-12-21',
    status,
    ports: 'King Abdulaziz in Dammam',
  }
}

export const PERMIT_LICENSES = [1, 2, 3].map((id) => ({
  id: `permit-license-${id}`,
  code: '331501-0003',
  name: 'Routine Repair And Maintenance Of Ships',
  title: 'Routine repair and maintenance of ships',
  status: 'Active',
  amount: '70000 SAR',
  startLabel: 'Jan 1, 2025',
  expiryLabel: 'Jan 31, 2025',
  start: '2025-01-01',
  expiry: '2025-01-31',
  drawerExpiry: 'April 22, 2025',
  drawerStatus: 'Expired',
  permits: nestedStatuses.map((status, index) => nestedPermit(`${id}-${index + 1}`, status)),
}))

export const PERMITS = Array.from({ length: 12 }, (_, index) => ({
  id: `permit-${index + 1}`,
  number: 'SADAM-0029',
  company: 'Olivia Rhye',
  license: 'License name here',
  type: 'Activity in port',
  start: '2028-12-21',
  expiry: '2028-12-21',
  cancellation: '2021-12-21',
}))

export const PERMIT_REQUESTS = requestStatuses.map((status, index) => ({
  id: `permit-req-${index + 1}`,
  number: '2327',
  permitType: 'Activity in port',
  license: 'License name here',
  date: '2028-12-21',
  requestDate: 'April 22, 2025',
  status,
  ports: 'King Abdulaziz In Dammam',
}))
