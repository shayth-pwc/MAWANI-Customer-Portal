// No invoices endpoint yet. Remove INVOICES and INVOICE_REQUESTS when one is added.
// Keep NOTES_PLACEHOLDER.

const invoiceRow = (id, status, issueDate) => ({
  id,
  code: '331-501',
  description: 'Description of the invoice here',
  amount: '5,500',
  vatApplication: 'Yes',
  vatPercent: '90%',
  vatAmount: '5,500',
  total: '5,500',
  status,
  issueDate,
})

export const INVOICES = Array.from({ length: 29 }, (_, index) =>
  invoiceRow(
    `inv-${index + 1}`,
    index > 23 ? 'Expired' : 'Paid',
    index % 5 === 0 ? '2026-08-01' : '2026-02-04',
  ),
)

const requestPattern = [
  ['Approved', 'Yes'],
  ['Approved', 'Yes'],
  ['Pending', 'Yes'],
  ['Pending', 'No'],
  ['Pending', 'Yes'],
  ['Pending', 'No'],
  ['Approved', 'Yes'],
  ['Approved', 'Yes'],
  ['Approved', 'Yes'],
  ['Approved', 'Yes'],
  ['Pending', 'Yes'],
]

export const INVOICE_REQUESTS = requestPattern.map(([status, vat], index) => ({
  id: `req-${index + 1}`,
  code: '331-501',
  description: 'Description of the invoice here',
  invoiceNumber: '12',
  sadad: '1123',
  amount: '20000',
  status,
  vat,
  vatPercent: '90%',
  vatAmount: '70000',
}))

export const NOTES_PLACEHOLDER =
  'e.g. I joined Stripe’s Customer Success team to help them scale their checkout product. I focused mainly on onboarding new customers and resolving complaints.'
