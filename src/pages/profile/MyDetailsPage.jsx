import { useNavigate, useOutletContext } from 'react-router-dom'
import { icons, images } from '../../assets'
import { DateField, IconField, PhoneField, PrefixField, Section, SelectField } from '../../components/profile/fields'
import { useApp } from '../../hooks/useApp'

const NATIONALITIES = ['regNatSaudi', 'regNatUae', 'regNatBahrain', 'regNatKuwait', 'regNatOman', 'regNatQatar']
const DOCUMENT_TYPES = ['regDocNationalId', 'regDocIqama', 'regDocPassport']
const GENDERS = ['detMale', 'detFemale']

export default function MyDetailsPage() {
  const { details, setDetails } = useOutletContext()
  const { setContactOpen, t } = useApp()
  const navigate = useNavigate()

  const update = (name) => (event) => {
    const value = event.target.type === 'file' ? event.target.files?.[0] : event.target.value
    if (event.target.type === 'file') {
      if (!value) return
      setDetails((current) => ({ ...current, photo: URL.createObjectURL(value) }))
      return
    }
    setDetails((current) => ({ ...current, [name]: value }))
  }

  const displayName = `${details.firstName} ${details.lastName}`.trim()

  return (
    <div className="flex flex-col gap-12">
      <section>
        <div className="relative h-[142px] overflow-hidden rounded-lg">
          <img src={images.profileBanner} alt="" className="size-full object-cover" />
        </div>
        <div className="-mt-10 flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="relative size-40 shrink-0">
            <img
              src={details.photo || images.avatar}
              alt=""
              className="size-40 rounded-full border border-black/8 bg-bg-neutral object-cover"
            />
            <label className="absolute start-[60px] top-[132px] flex size-10 cursor-pointer items-center justify-center rounded-full border-2 border-white/12 bg-brand">
              <img src={icons.upload} alt="" width={20} height={20} />
              <input type="file" accept="image/*" className="sr-only" aria-label={t('detUpload')} onChange={update('photo')} />
            </label>
          </div>
          <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-4 pt-8 sm:pt-16">
            <div className="min-w-[240px] flex-1">
              <h2 className="text-display-xs font-semibold text-text-primary">{displayName}</h2>
              <p className="text-md text-text-secondary">{t('detUpdatePhoto')}</p>
              <p className="flex items-center gap-1 text-sm text-text-secondary">
                {t('detIssue')}
                <button type="button" className="px-1 font-semibold text-brand" onClick={() => setContactOpen(true)}>
                  {t('detContact')}
                </button>
              </p>
            </div>
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-brand bg-white px-3.5 text-sm font-semibold text-brand hover:bg-brand-25"
              onClick={() => navigate('/profile/password')}
            >
              {t('detChangePassword')}
            </button>
          </div>
        </div>
        <div className="mt-6 h-px bg-border" />
      </section>

      <form className="flex flex-col gap-5" onSubmit={(event) => event.preventDefault()}>
        <Section title={t('detFullName')} hint={t('detFullNameHint')}>
          <PrefixField prefix={t('detFirst')} name="firstName" value={details.firstName} onChange={update('firstName')} />
          <PrefixField prefix={t('detFather')} name="fatherName" value={details.fatherName} onChange={update('fatherName')} />
          <PrefixField
            prefix={t('detGrandfather')}
            name="grandfatherName"
            value={details.grandfatherName}
            onChange={update('grandfatherName')}
            wide
          />
          <PrefixField prefix={t('detLast')} name="lastName" value={details.lastName} onChange={update('lastName')} />
        </Section>

        <Section title={t('detNationalityDocs')}>
          <SelectField
            name="nationality"
            value={details.nationality}
            onChange={update('nationality')}
            placeholder={t('detSelectNationality')}
            options={NATIONALITIES}
          />
          <div className="grid max-w-[564px] gap-4 sm:grid-cols-2">
            <SelectField
              name="documentType"
              value={details.documentType}
              onChange={update('documentType')}
              placeholder={t('detSelectDocument')}
              options={DOCUMENT_TYPES}
            />
            <PrefixField
              prefix={t('detDocumentNo')}
              name="documentNo"
              value={details.documentNo}
              onChange={update('documentNo')}
              wide
            />
          </div>
        </Section>

        <Section title={t('detContactInfo')}>
          <IconField icon={icons.mail} name="email" type="email" value={details.email} onChange={update('email')} />
          <PhoneField value={details.phone} onChange={update('phone')} />
        </Section>

        <Section title={t('detBirthGender')}>
          <div className="flex max-w-[564px] flex-col gap-4 sm:flex-row">
            <DateField value={details.dob} onChange={(dob) => setDetails((current) => ({ ...current, dob }))} placeholder={t('detSelectDob')} />
            <div className="min-w-0 flex-1">
              <SelectField
                name="gender"
                value={details.gender}
                onChange={update('gender')}
                placeholder={t('detSelectGender')}
                options={GENDERS}
              />
            </div>
          </div>
        </Section>

        <Section title={t('detAddress')}>
          <PrefixField prefix={t('detBuilding')} name="building" value={details.building} onChange={update('building')} numeric />
          <PrefixField prefix={t('detApartment')} name="apartment" value={details.apartment} onChange={update('apartment')} numeric />
          <PrefixField prefix={t('detStreet')} name="street" value={details.street} onChange={update('street')} />
          <PrefixField prefix={t('detCity')} name="city" value={details.city} onChange={update('city')} />
          <PrefixField prefix={t('detPostal')} name="postal" value={details.postal} onChange={update('postal')} numeric />
        </Section>
      </form>
    </div>
  )
}
