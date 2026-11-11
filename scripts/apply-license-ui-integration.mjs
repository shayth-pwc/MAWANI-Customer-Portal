// Run from the ACTUAL combined Git checkout, after copying the overlay files.
// Anchored patch for the publicly visible LicensesPage.jsx baseline.
// Fails rather than silently changing an unfamiliar updated page.
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
const root = process.cwd()
const file = resolve(root, 'src/pages/LicensesPage.jsx')
const dryRun = process.argv.includes('--check')
function replaceOne(text, before, after, label) {
  if (!text.includes(before)) throw new Error(`Cannot find ${label}; review current main source manually`)
  if (text.indexOf(before) !== text.lastIndexOf(before)) throw new Error(`Ambiguous ${label}; no changes applied`)
  return text.replace(before, after)
}
function between(text, start, end, newText, label) {
  const a = text.indexOf(start)
  if (a < 0 || text.indexOf(start, a + 1) !== -1) throw new Error(`Cannot uniquely find ${label}`)
  const b = text.indexOf(end, a + start.length)
  if (b < 0) throw new Error(`Cannot find end of ${label}`)
  return text.slice(0, a) + newText + text.slice(b)
}
let s = readFileSync(file, 'utf8')
if (s.includes('LicenseDynamicFields')) throw new Error('UI integration appears already installed; do not patch twice')
s = replaceOne(s,
  "import { useEffect, useId, useMemo, useRef, useState } from 'react'",
  "import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'", 'react hooks')
s = between(s, "import {\n  COMMERCIAL_REGISTRATIONS,", "import { useApp }", '', 'mock-data import')
s = between(s, 'const INVESTOR_LABELS =', 'function FunnelIcon(', '', 'hardcoded license labels')
s = s.replace('  const { t, language } = useApp()\n  const [tab, setTab]', '  const { t } = useApp()\n  const [tab, setTab]')
s = replaceOne(s, "import { useApp } from '../hooks/useApp'",
  "import { useApp } from '../hooks/useApp'\nimport LicenseDynamicFields from '../components/licenses/LicenseDynamicFields'\nimport { getMyLicenses, getMyRequests, submitLicenseRequest, fileToC4cAttachment } from '../services/licensesApi'", 'API imports')
s = replaceOne(s, 'const [licenses, setLicenses] = useState(LICENSES)', 'const [licenses, setLicenses] = useState([])', 'license mock state')
s = replaceOne(s, 'const [requests, setRequests] = useState(LICENSE_REQUESTS)', 'const [requests, setRequests] = useState([])', 'request mock state')
s = replaceOne(s, "  const [loading, setLoading] = useState(true)",
  "  const [loading, setLoading] = useState(true)\n  const [pageError, setPageError] = useState('')", 'loading declaration')
const loader = `  const reloadFromC4c = useCallback(async () => {
    setLoading(true)
    setPageError('')
    try {
      const [remoteLicenses, remoteRequests] = await Promise.all([getMyLicenses(), getMyRequests()])
      setLicenses(remoteLicenses.map((r, index) => ({
        id: r.ObjectID || r.AccountID || String(index), code: r.LicenseNumber || '',
        name: r.CompanyName || r.LicenseType || '', title: r.CompanyName || '',
        start: '', expiry: '', status: r.Status || '', service: r.LicenseType || '',
        cr: r.CRNationalNumber || '', amount: '', company: r.CompanyName || ''
      })))
      setRequests(remoteRequests.map((r, index) => ({
        id: r.ObjectID || r.ID || String(index), code: r.ID || '',
        name: r.LicenseType || '', title: r.LicenseType || '', start: '', expiry: '',
        status: r.Status || '', service: r.RequestType || '', cr: r.CRNationalNumber || '',
        amount: r.Amount || '', company: r.CommercialRegistrationNumber || ''
      })))
    } catch (error) {
      setLicenses([])
      setRequests([])
      setPageError(error.message || 'Cannot retrieve C4C licenses')
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { reloadFromC4c() }, [reloadFromC4c])

`
s = between(s, '  useEffect(() => {\n    const timer = window.setTimeout(() => setLoading(false), 800)',
  '  const filtersActive =', loader, 'mock timer')
s = replaceOne(s,
  "    return language === 'ar' ? t('licNameValue') : row.name", "    return row.name", 'mock Arabic name')
s = replaceOne(s,
  "    setLicenses((current) => current.map((item) => (item.id === row.id ? { ...item, status: 'Active' } : item)))\n    setDrawer(null)",
  "    setPageError('Renewal requires verified CR details and applicant data; no renewal was submitted.')\n    setDrawer(null)", 'unsafe local renewal')
s = replaceOne(s, '<div className="px-4 pb-10 pt-4 md:px-8">',
  '<div className="px-4 pb-10 pt-4 md:px-8">\n      {pageError ? <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{pageError}</p> : null}', 'page error container')
const submit = `        onSubmit={async (draft) => {
          const attachments = draft.file ? [await fileToC4cAttachment(draft.file)] : []
          const result = await submitLicenseRequest({
            clientRequestId: draft.clientRequestId,
            crNationalNumber: draft.national, crNumber: draft.number,
            licenseTypes: draft.comprehensive ? draft.licenseTypes : [draft.licenseType],
            investorType: draft.investor, serviceType: draft.serviceType,
            portCode: draft.portCode || '', activityType: draft.activityType || '',
            shipName: draft.shipName || '', ministryEnergyLicenseDate: draft.ministryEnergyLicenseDate || null,
            applicant: { name: draft.applicantName, id: draft.applicantId,
              documentType: draft.documentType, mobile: draft.applicantMobile, email: draft.applicantEmail },
            address: { cityCode: draft.cityCode, postalCode: draft.postal, district: draft.district,
              street: draft.street, building: draft.building, secondaryNumber: draft.secondary },
            attachments
          })
          const incomplete = result.results?.filter(item => !['SUCCEEDED', 'ALREADY_SUCCEEDED'].includes(item.status)) || []
          if (incomplete.length) throw new Error('C4C needs attention: ' + incomplete.map(i => i.type + ' (' + i.status + ')').join(', '))
          await reloadFromC4c()
          setTab('requests')
          setModalOpen(false)
        }}
`
s = between(s, '        onSubmit={(draft) => {', '      />\n    </div>\n  )\n}', submit, 'mock submit handler')
s = replaceOne(s,
  "  number: '1010006817',\n  nameAr: '\u0634\u0631\u0643\u0629 \u0627\u0644\u0639\u0648\u064a\u0636\u0629 \u0644\u0644\u0635\u0646\u0627\u0639\u0627\u062a',\n  investor: 'Saudi',\n  licenseType: 'Marine Agents',\n  amount: '30,000',",
  "  number: '',\n  nameAr: '',\n  investor: '',\n  licenseType: '',\n  licenseTypes: [],\n  comprehensive: false,\n  serviceType: '', portCode: '', activityType: '', shipName: '',\n  ministryEnergyLicenseDate: '', documentType: '',\n  applicantName: '', applicantId: '', applicantMobile: '', applicantEmail: '',\n  amount: '',", 'demo initial form values')
s = replaceOne(s, "  fileName: '',", "  fileName: '',\n  file: null,", 'file state')
s = replaceOne(s, 'function NewLicenseModal({ open, onClose, onSubmit }) {',
  'function NewLicenseModal({ open, onClose, onSubmit, registrations = [] }) {', 'modal signature')
s = replaceOne(s, "  const [errors, setErrors] = useState({})",
  "  const [errors, setErrors] = useState({})\n  const [submitting, setSubmitting] = useState(false)\n  const requestTokenRef = useRef(null)", 'modal errors state')
s = replaceOne(s,
  'const record = COMMERCIAL_REGISTRATIONS.find((item) => item.national === national)',
  'const record = registrations.find((item) => item.national === national)', 'CR source')
s = replaceOne(s, "  function submit(event) {\n    event.preventDefault()", "  async function submit(event) {\n    event.preventDefault()", 'submit async')
s = replaceOne(s, "    if (!form.amount.trim()) next.amount = t('fieldRequired')", "    if (!form.investor || !form.serviceType) next.lists = t('fieldRequired')\n    if (!(form.comprehensive ? form.licenseTypes.length : form.licenseType)) next.licenseType = t('fieldRequired')\n    if (form.serviceType === '111' && !form.portCode) next.portCode = t('fieldRequired')\n    if (!form.applicantName || !form.applicantId || !form.documentType || !form.applicantMobile || !form.applicantEmail) next.applicant = t('fieldRequired')", 'old amount validation')
s = replaceOne(s,
  '    onSubmit(form)\n    setForm(blankForm)',
  "    if (!requestTokenRef.current) requestTokenRef.current = crypto.randomUUID()\n    setSubmitting(true)\n    try {\n      await onSubmit({ ...form, clientRequestId: requestTokenRef.current })\n      requestTokenRef.current = null\n      setForm(blankForm)\n    } catch (error) { setErrors({ submit: error.message || 'License request failed' }) }\n    finally { setSubmitting(false) }", 'mock form save')
s = replaceOne(s,
  '  const ready = form.national && form.companyEn.trim() && form.amount.trim() && form.accepted',
  "  const ready = form.national && form.companyEn.trim() && form.investor && form.serviceType &&\n    (form.comprehensive ? form.licenseTypes.length > 0 : Boolean(form.licenseType)) &&\n    (form.serviceType !== '111' || form.portCode) &&\n    form.applicantName && form.applicantId && form.applicantMobile && form.applicantEmail && form.documentType && form.accepted && !submitting", 'ready state')
s = replaceOne(s,
  '{COMMERCIAL_REGISTRATIONS.map((item) => <option key={item.national} value={item.national}>{item.national}</option>)}',
  '{registrations.map((item) => <option key={item.national} value={item.national}>{item.national}</option>)}', 'CR options')
const dynamicInputs = `            <LicenseDynamicFields form={form} onChange={setForm} enabled={open} />\n`
s = between(s, "            <Field label={t('reqInvestorType')} required>",
  '          </div>\n          <Field label={t(\'reqAmountSar\')}', dynamicInputs, 'static investor/license options')
s = between(s, "          <Field label={t('reqAmountSar')}",
  '          <div>\n            <p className="text-sm font-medium text-text-secondary">{t(\'reqAttachments\')}</p>',
  `          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Applicant name<input required className={inputClass()} value={form.applicantName} onChange={e => setForm({ ...form, applicantName: e.target.value })} /></label>
            <label className="text-sm">Applicant ID<input required className={inputClass()} value={form.applicantId} onChange={e => setForm({ ...form, applicantId: e.target.value })} /></label>
            <label className="text-sm">Applicant mobile<input required className={inputClass()} value={form.applicantMobile} onChange={e => setForm({ ...form, applicantMobile: e.target.value })} /></label>
            <label className="text-sm">Applicant email<input required type="email" className={inputClass()} value={form.applicantEmail} onChange={e => setForm({ ...form, applicantEmail: e.target.value })} /></label>
          </div>
`, 'old editable fee input')
s = replaceOne(s, "if (file) setForm({ ...form, fileName: file.name })", "if (file) setForm({ ...form, file, fileName: file.name })", 'file drag-drop')
s = replaceOne(s,
  "onChange={(event) => setForm({ ...form, fileName: event.target.files?.[0]?.name || '' })}",
  "onChange={(event) => { const file = event.target.files?.[0] || null; setForm({ ...form, file, fileName: file?.name || '' }) }}", 'file selection')
s = replaceOne(s,
  "        {errors.accepted ? <p className=\"px-6 pb-3 text-sm text-[#d92d20]\">{errors.accepted}</p> : null}",
  "        {(errors.accepted || errors.lists || errors.licenseType || errors.portCode || errors.applicant || errors.submit) ? <p role=\"alert\" className=\"px-6 pb-3 text-sm text-[#d92d20]\">{Object.values(errors).filter(Boolean).join(' | ')}</p> : null}", 'error feedback')

if (dryRun) { process.stdout.write('Anchors PASS: License UI can be patched. No files changed.\n') }
else {
  writeFileSync(file, s)
  process.stdout.write('UI integration applied; now run npm run lint and npm run build.\n')
}
