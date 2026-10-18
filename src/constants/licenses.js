// No licenses endpoint yet. Remove LICENSES, LICENSE_REQUESTS, and COMMERCIAL_REGISTRATIONS
// when one is added. Keep INVESTOR_TYPES, LICENSE_TYPES, UPLOAD_HINT, and PAYMENT_HINT.

const licensePattern = ['Active', 'Active', 'Expired', 'Expired', 'Expired', 'Expired', 'Active', 'Expired', 'Expired', 'Active', 'Expired', 'Active']

const requestPattern = ['Open', 'Open', 'Open', 'Approved', 'Approved', 'Approved', 'Open', 'Approved', 'Approved', 'Open', 'Approved']

export const COMMERCIAL_REGISTRATIONS = [
  {
    national: '7001928105',
    number: '1010006817',
    nameAr: 'شركة العويضة للصناعات',
    address: '2889 شارع العليا، السليمانية، الرياض',
    cityCode: '1010',
    city: 'RIYADH',
    postal: '1235',
    district: '0',
    street: 'شارع العليا',
    building: '2889',
    secondary: '1234',
    shortAddress: 'الرياض، السليمانية',
  },
]

export const INVESTOR_TYPES = ['Saudi', 'Non-Saudi']
export const LICENSE_TYPES = ['Marine Agents', 'Shipping Agent', 'Port Operator']

function license(id, status) {
  return {
    id: `lic-${id}`,
    code: '331501-0003',
    name: 'Routine Repair And Maintenance Of Ships',
    title: 'Routine repair and maintenance of ships',
    start: '2028-12-21',
    expiry: '2029-12-21',
    drawerExpiry: 'April 22, 2025',
    status,
    service: 'Type here',
    cr: '7001928105',
    amount: '5,500',
    company: 'شركة العويضة للصناعات',
  }
}

const licenseStatuses = Array.from({ length: 29 }, (_, index) =>
  index >= 26 ? 'Suspended' : licensePattern[index % licensePattern.length],
)

export const LICENSES = licenseStatuses.map((status, index) => license(index + 1, status))

export const LICENSE_REQUESTS = requestPattern.map((status, index) => ({
  id: `lreq-${index + 1}`,
  code: '331501-0003',
  name: 'Routine Repair And Maintenance Of Ships',
  title: 'Routine repair and maintenance of ships',
  start: '2028-12-21',
  expiry: '2029-12-21',
  drawerExpiry: 'April 22, 2025',
  status,
  service: 'Type here',
  cr: '7001928105',
  amount: '5,500',
  company: 'شركة العويضة للصناعات',
  payable: status === 'Approved',
}))

export const UPLOAD_HINT =
  'Please attach copies of all the required documents as per the Operational Controls in the General Regulations for Licenses and Permits'

export const PAYMENT_HINT =
  "Pay your Mawani invoices using Mada, Visa, Mastercard, or through your bank's SADAD service using the invoice SADAD number."
