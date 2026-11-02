// No profile endpoint yet. Remove INITIAL_DETAILS, COMPANY, COMPANY_AR, CR_RECORDS, RECORD,
// INITIAL_ADDRESS, ADDRESS_ROWS, EDIT_ADDRESS, RECORD_PHONES, INITIAL_CONTACTS,
// INITIAL_OWNERS, INITIAL_ACTIVITIES, and PREVIOUS_PASSWORD when one is added.
// Keep NATIONALITIES, DOCUMENT_TYPES, GENDERS, COUNTRIES, REGIONS, and CITY_CODES
// unless that endpoint also returns the lookup lists.

export const INITIAL_DETAILS = {
  photo: '',
  firstName: '', fatherName: '', grandfatherName: '', lastName: '',
  nationality: '', documentType: '', documentNo: '',
  email: '', phone: '', dob: '', gender: '',
  building: '', apartment: '', street: '', city: '', postal: '',
}

export const NATIONALITIES = ['Saudi Arabia', 'United Arab Emirates', 'Bahrain', 'Kuwait', 'Oman', 'Qatar']
export const DOCUMENT_TYPES = ['National ID', 'Iqama', 'Passport']
export const GENDERS = ['Male', 'Female']
export const COUNTRIES = ['Saudi Arabia', 'United Arab Emirates', 'Bahrain', 'Kuwait', 'Oman', 'Qatar']
export const REGIONS = ['Riyadh', 'Makkah', 'Eastern Province', 'Madinah', 'Asir', 'Qassim']

export const COMPANY = 'alqutban littijarah Company Ltd.'
export const COMPANY_AR = 'شركة القطيان للتجارة المحدودة'

export const CR_RECORDS = [
  { id: '1', cr: '1009083256', national: '7041285169', description: COMPANY, from: '04-02-2026', to: '04-02-2026', api: 'Active', poa: 'Yes' },
  { id: '2', cr: '1009083256', national: '7041285169', description: COMPANY, from: '04-02-2026', to: '04-02-2026', api: 'Active', poa: 'Yes' },
  { id: '3', cr: '1009083256', national: '7041285169', description: '', from: '04-02-2026', to: '04-02-2026', api: '---', poa: 'No' },
  { id: '4', cr: '1009083256', national: '7041285169', description: COMPANY, from: '04-02-2026', to: '04-02-2026', api: 'Active', poa: 'Yes' },
  { id: '5', cr: '1009083256', national: '7041285169', description: COMPANY, from: '04-02-2026', to: '04-02-2026', api: '---', poa: 'No' },
  { id: '6', cr: '1009083256', national: '7041285169', description: '', from: '04-02-2026', to: '04-02-2026', api: '---', poa: 'No' },
]

export const RECORD = {
  number: '009083256',
  issueDate: 'April 22, 2025',
  expiryDate: 'April 22, 2025',
  cr: [
    ['CR National No', 'Title here'],
    ['Type', 'city name'],
    ['Status', 'Status'],
    ['Status Reason', 'Reason'],
    ['Status Date', 'April 04, 2026'],
    ['Company Period', '1220'],
    ['Nationality', 'Nationality here'],
  ],
  legal: [
    ['Legal type', 'type here'],
    ['Fiscal start date', 'April 04, 2026'],
    ['Fiscal end date', 'April 04, 2026'],
    ['Transition date', 'April 04, 2026'],
  ],
  capital: '650,000',
  shares: '650',
  description:
    'A cross-functional project aimed at redesigning and streamlining the digital onboarding process for new employees across all departments.',
  descriptionAr:
    'مشروع مشترك بين الإدارات يهدف إلى إعادة تصميم عملية تهيئة الموظفين الجدد رقميًا وتبسيطها في جميع الإدارات.',
  website: 'www.mawani.com',
}

export const INITIAL_ADDRESS = {
  poBox: 'Title here',
  city: 'Reason',
  addressLine: 'April 04, 2026',
  vat: 'Yes',
  taxNumber: '1220',
  cityCode: 'RIYADH',
  postal: '11125',
  district: 'nafel',
  street: 'nafel',
  building: '1234',
  shortAddress: 'ry1234',
}

export const ADDRESS_ROWS = [
  ['poBox', 'crPoBox'],
  ['city', 'crCity'],
  ['addressLine', 'crAddressLine'],
  ['vat', 'crVat'],
  ['taxNumber', 'crTaxNumber'],
  ['cityCode', 'crCityCode'],
  ['postal', 'crPostal'],
  ['district', 'crDistrict'],
  ['street', 'crStreet'],
  ['building', 'crBuilding'],
  ['shortAddress', 'reqShortAddress'],
]

export const EDIT_ADDRESS = {
  taxNumber: '006600',
  vat: 'Yes',
  postal: '1010006',
  cityCode: '',
  street: 'nafel',
  district: 'nafel',
  additionalPhone: '532104888',
  building: '1234',
  shortAddress: 'ry1234',
}

export const CITY_CODES = ['RIYADH', 'JEDDAH', 'DAMMAM', 'MAKKAH']

export const RECORD_PHONES = [
  ['crPhone', '00578455555'],
  ['crContactNo', '00578455555'],
  ['crSecondaryNo', '00578455555'],
]

export const INITIAL_CONTACTS = [
  { id: 'c1', name: 'Mahmoud', email: 'Mahmoud@yahoo', phone: '+966 532104888' },
  { id: 'c2', name: 'Mahmoud', email: 'Mahmoud@yahoo', phone: '+966 532104888' },
]

export const INITIAL_OWNERS = [
  { id: 'o1', name: '014 Mahmoud', nationality: 'Nationality here', relation: 'النوع', phone: '+966 532104888' },
  { id: 'o2', name: '014 Mahmoud', nationality: 'Nationality here', relation: 'النوع', phone: '+966 532104888' },
]

export const INITIAL_ACTIVITIES = [
  { id: 'a1', code: 'إنشاء الجسور أو الأنفاق', name: 'Construction of bridges or tunnels' },
  { id: 'a2', code: 'إنشاء الجسور أو الأنفاق', name: 'Construction of bridges or tunnels' },
]

// Password history belongs to SAP IAS; do not ship a sample password.
