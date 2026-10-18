import { icons, images } from '../../assets'
import { useApp } from '../../hooks/useApp'
import UiDateField from '../ui/DateField'

const control =
  'h-10 w-full rounded-lg border border-border bg-white text-sm text-text-primary shadow-xs outline-none focus-within:border-[#717bbc]'

export function Section({ title, hint, children }) {
  return (
    <div className="flex flex-col gap-4 border-t border-border pt-5 lg:flex-row lg:gap-6">
      <div className="min-w-[164px] max-w-[172px] flex-1">
        <h3 className="text-sm font-semibold text-text-secondary">{title}</h3>
        {hint ? <p className="text-sm text-text-tertiary">{hint}</p> : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-4">{children}</div>
    </div>
  )
}

export function PrefixField({ prefix, value, onChange, name, wide = false, numeric = false }) {
  const { language } = useApp()
  const besideLabel = numeric && language === 'ar'

  return (
    <div className={`${control} flex max-w-[564px] items-stretch overflow-hidden`}>
      <span
        className={`flex items-center whitespace-nowrap px-3 text-sm text-text-tertiary ${wide || besideLabel ? 'shrink-0' : 'min-w-[103px] shrink-0'}`}
      >
        {prefix}
      </span>
      <input
        dir="ltr"
        name={name}
        value={value}
        onChange={onChange}
        className={`min-w-0 flex-1 bg-transparent px-3 text-sm text-text-primary outline-none ${besideLabel ? 'text-right' : 'text-left'}`}
      />
    </div>
  )
}

export function SelectField({ value, onChange, placeholder, options, name }) {
  const { t } = useApp()
  const items = options.map((option) =>
    typeof option === 'string' ? { value: option, label: t(option) } : option,
  )

  return (
    <label className="relative block max-w-[564px]">
      <select
        name={name}
        value={value}
        onChange={onChange}
        className={`${control} appearance-none px-3 pe-10 ${value ? 'text-text-primary' : 'text-text-placeholder'}`}
      >
        <option value="">{placeholder}</option>
        {items.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <img src={icons.chevronDown} alt="" width={20} height={20} className="pointer-events-none absolute end-3 top-2.5" />
    </label>
  )
}

export function IconField({ icon, value, onChange, name, type = 'text', muted = false }) {
  return (
    <label className={`${control} flex max-w-[564px] items-center gap-2 px-3`}>
      <img src={icon} alt="" width={20} height={20} />
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        className={`min-w-0 flex-1 bg-transparent outline-none ${muted ? 'text-text-placeholder' : 'text-text-primary'}`}
      />
    </label>
  )
}

export function PhoneField({ value, onChange }) {
  return (
    <div className="flex h-11 max-w-[564px] items-center overflow-hidden rounded-lg border border-border bg-white shadow-xs focus-within:border-[#717bbc] rtl:flex-row-reverse">
      <span dir="ltr" className="flex shrink-0 items-center gap-1.5 px-3 text-sm font-medium text-text-primary">
        <img src={icons.chevronDown} alt="" width={16} height={16} />
        +966
        <img src={images.flagSa} alt="" width={20} height={14} className="h-3.5 w-5 rounded-sm object-cover" />
      </span>
      <span className="h-5 w-px shrink-0 bg-border" aria-hidden="true" />
      <input
        dir="ltr"
        name="phone"
        inputMode="tel"
        value={value}
        onChange={onChange}
        className="h-11 min-w-0 flex-1 bg-transparent px-3 text-start text-sm text-text-primary outline-none rtl:text-end"
      />
    </div>
  )
}

export function DateField({ value, onChange, placeholder }) {
  return (
    <UiDateField
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      format="long"
      className="min-w-0 flex-1"
      buttonClassName="flex h-10 w-full items-center gap-1 rounded-lg border border-border bg-white px-3.5 text-start shadow-xs"
    />
  )
}
