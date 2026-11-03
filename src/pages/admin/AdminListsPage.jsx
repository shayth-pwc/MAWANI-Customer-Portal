import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../../hooks/useApp'
import { useAdminAccess } from '../../hooks/useAdminAccess'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import { getDefinitions, getDefinition, getPublicList, listAction } from '../../services/adminListsApi'

const T = {
  en: {
    title: 'Dynamic Lists', subtitle: 'Configure reusable dropdowns and dependent options for Mawani applications.',
    app: 'Application code', code: 'List key', name: 'List title', nameAr: 'Arabic title', description: 'Description',
    list: 'Lists', items: 'Items and sub-items', add: 'New list', addOption: 'Add option', addChild: 'Add sub-item',
    save: 'Save', edit: 'Edit', cancel: 'Cancel', refresh: 'Refresh', preview: 'Preview consumer API',
    active: 'Active', multiple: 'Allow multiple', required: 'Required', dependent: 'Dependent list',
    defaultValue: 'Default option key', empty: 'No lists have been configured.',
    sub: 'Parent option', root: 'Top-level option', key: 'Option key', order: 'Display order',
    icon: 'Icon token', color: 'Color token', status: 'Status', actions: 'Actions',
    disable: 'Deactivate', enable: 'Activate', loading: 'Loading...',
    denied: 'Only authorized IAS administrators can manage lists.',
    confirmTitle: 'Confirm this change', success: 'Configuration saved successfully.',
    warning: 'Deactivated entries are hidden from the consumer API; existing database rows are retained.',
    local: 'Local configuration', noApi: 'No preview is available yet.',
    search: 'Filter lists', choose: 'Select a list to manage items.',
  },
  ar: {
    title: '\u0627\u0644\u0642\u0648\u0627\u0626\u0645 \u0627\u0644\u062f\u064a\u0646\u0627\u0645\u064a\u0643\u064a\u0629',
    subtitle: '\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0642\u0648\u0627\u0626\u0645 \u0627\u0644\u0645\u0646\u0633\u062f\u0644\u0629 \u0648\u0627\u0644\u0639\u0646\u0627\u0635\u0631 \u0627\u0644\u0641\u0631\u0639\u064a\u0629.',
    app: '\u0631\u0645\u0632 \u0627\u0644\u062a\u0637\u0628\u064a\u0642', code: '\u0645\u0641\u062a\u0627\u062d \u0627\u0644\u0642\u0627\u0626\u0645\u0629',
    name: '\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0642\u0627\u0626\u0645\u0629', nameAr: '\u0627\u0644\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0639\u0631\u0628\u064a',
    description: '\u0627\u0644\u0648\u0635\u0641', list: '\u0627\u0644\u0642\u0648\u0627\u0626\u0645', items: '\u0627\u0644\u0639\u0646\u0627\u0635\u0631 \u0648\u0627\u0644\u0641\u0631\u0639\u064a\u0629',
    add: '\u0642\u0627\u0626\u0645\u0629 \u062c\u062f\u064a\u062f\u0629', addOption: '\u0625\u0636\u0627\u0641\u0629 \u0639\u0646\u0635\u0631', addChild: '\u0625\u0636\u0627\u0641\u0629 \u0639\u0646\u0635\u0631 \u0641\u0631\u0639\u064a',
    save: '\u062d\u0641\u0638', edit: '\u062a\u0639\u062f\u064a\u0644', cancel: '\u0625\u0644\u063a\u0627\u0621', refresh: '\u062a\u062d\u062f\u064a\u062b',
    preview: '\u0645\u0639\u0627\u064a\u0646\u0629 \u0627\u0644\u0648\u0627\u062c\u0647\u0629', active: '\u0646\u0634\u0637', multiple: '\u062a\u0639\u062f\u062f \u0627\u0644\u0627\u062e\u062a\u064a\u0627\u0631', required: '\u0625\u0644\u0632\u0627\u0645\u064a',
    dependent: '\u0642\u0627\u0626\u0645\u0629 \u0645\u0631\u062a\u0628\u0637\u0629', defaultValue: '\u0627\u0644\u0642\u064a\u0645\u0629 \u0627\u0644\u0627\u0641\u062a\u0631\u0627\u0636\u064a\u0629',
    empty: '\u0644\u0627 \u062a\u0648\u062c\u062f \u0642\u0648\u0627\u0626\u0645', sub: '\u0627\u0644\u0639\u0646\u0635\u0631 \u0627\u0644\u0623\u0628', root: '\u0639\u0646\u0635\u0631 \u0631\u0626\u064a\u0633\u064a',
    key: '\u0645\u0641\u062a\u0627\u062d \u0627\u0644\u0639\u0646\u0635\u0631', order: '\u0627\u0644\u062a\u0631\u062a\u064a\u0628', icon: '\u0627\u0644\u0623\u064a\u0642\u0648\u0646\u0629', color: '\u0627\u0644\u0644\u0648\u0646',
    status: '\u0627\u0644\u062d\u0627\u0644\u0629', actions: '\u0627\u0644\u0625\u062c\u0631\u0627\u0621\u0627\u062a', disable: '\u062a\u0639\u0637\u064a\u0644', enable: '\u062a\u0641\u0639\u064a\u0644',
    loading: '\u062c\u0627\u0631\u064d \u0627\u0644\u062a\u062d\u0645\u064a\u0644...', denied: '\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0642\u0648\u0627\u0626\u0645 \u0644\u0644\u0645\u0633\u0624\u0648\u0644\u064a\u0646 \u0641\u0642\u0637.',
    confirmTitle: '\u062a\u0623\u0643\u064a\u062f \u0627\u0644\u0639\u0645\u0644\u064a\u0629', success: '\u062a\u0645 \u062d\u0641\u0638 \u0627\u0644\u062a\u0639\u062f\u064a\u0644\u0627\u062a.',
    warning: '\u0627\u0644\u0639\u0646\u0627\u0635\u0631 \u063a\u064a\u0631 \u0627\u0644\u0646\u0634\u0637\u0629 \u0644\u0627 \u062a\u0638\u0647\u0631 \u0641\u064a \u0627\u0644\u0648\u0627\u062c\u0647\u0629.',
    local: '\u0645\u062d\u0644\u064a', noApi: '\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u0639\u0627\u064a\u0646\u0629', search: '\u062a\u0635\u0641\u064a\u0629 \u0627\u0644\u0642\u0648\u0627\u0626\u0645',
    choose: '\u0627\u062e\u062a\u0631 \u0642\u0627\u0626\u0645\u0629 \u0644\u0625\u062f\u0627\u0631\u0629 \u0639\u0646\u0627\u0635\u0631\u0647\u0627.'
  },
}
const BTN = 'rounded-lg border border-border px-3 py-2 text-sm font-semibold text-text-secondary hover:bg-bg-neutral disabled:opacity-50'
const MAIN = 'rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50'
const INP = 'w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-text-primary focus:border-brand focus:outline-none'
function Field({ name, value, onChange, type = 'text', disabled, required = false, maxLength = 255, children }) {
  return <label className="block space-y-1.5"><span className="text-sm font-semibold text-text-secondary">{name}</span>
    {children || <input className={INP} value={value ?? ''} onChange={e => onChange(e.target.value)} type={type} maxLength={maxLength} disabled={disabled} required={required} />}
  </label>
}
function Popup({ title, close, children }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div role="dialog" aria-modal="true" aria-label={title} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
      <div className="mb-5 flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">{title}</h2><button type="button" className={BTN} onClick={close}>X</button></div>
      {children}
    </div>
  </div>
}
function DefinitionForm({ item, t, onSave, onCancel, busy }) {
  const [form, setForm] = useState(item || { app: '', code: '', title: '', titleAr: '', description: '', listType: 'LOCAL', isSublist: false, allowMultiple: false, isRequired: false, defaultValue: '', active: true })
  const change = (k, v) => setForm(prev => ({ ...prev, [k]: v }))
  return <Popup title={item ? t.edit : t.add} close={onCancel}>
    <form className="space-y-4" onSubmit={e => { e.preventDefault(); onSave({ ...form, app: form.app.trim().toUpperCase(), code: form.code.trim().toUpperCase(), listType: 'LOCAL' }) }}>
      <div className="grid gap-4 sm:grid-cols-2"><Field name={t.app} value={form.app} onChange={v => change('app', v)} disabled={Boolean(item)} required maxLength={100} /><Field name={t.code} value={form.code} onChange={v => change('code', v)} disabled={Boolean(item)} required maxLength={100} /></div>
      <div className="grid gap-4 sm:grid-cols-2"><Field name={t.name} value={form.title} onChange={v => change('title', v)} required maxLength={250}/><Field name={t.nameAr} value={form.titleAr} onChange={v => change('titleAr', v)} maxLength={250}/></div>
      <Field name={t.description} value={form.description} onChange={v => change('description', v)} maxLength={2000}/>
      <Field name={t.defaultValue} value={form.defaultValue} onChange={v => change('defaultValue', v)} maxLength={255}/>
      <div className="flex flex-wrap gap-5">{[['isSublist', t.dependent], ['allowMultiple', t.multiple], ['isRequired', t.required], ['active', t.active]].map(([key, label]) =>
        <label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(form[key])} onChange={e => change(key, e.target.checked)}/>{label}</label>)}</div>
      <div className="flex justify-end gap-2"><button className={BTN} type="button" onClick={onCancel}>{t.cancel}</button><button className={MAIN} type="submit" disabled={busy}>{t.save}</button></div>
    </form>
  </Popup>
}
function ItemForm({ item, parentKey, roots, t, onSave, onCancel, busy }) {
  const [form, setForm] = useState(item || { key: '', title: '', titleAr: '', itemOrder: 0, icon: '', uiColor: '', parentKey: parentKey || '', active: true })
  const change = (k, v) => setForm(prev => ({ ...prev, [k]: v }))
  return <Popup title={item ? t.edit : t.addOption} close={onCancel}>
    <form className="space-y-4" onSubmit={e => { e.preventDefault(); onSave({ ...form, itemOrder: Number(form.itemOrder) || 0 }) }}>
      <Field name={t.key} value={form.key} onChange={v => change('key', v)} disabled={Boolean(item)} required />
      <div className="grid gap-4 sm:grid-cols-2"><Field name={t.name} value={form.title} onChange={v => change('title', v)} required maxLength={500}/><Field name={t.nameAr} value={form.titleAr} onChange={v => change('titleAr', v)} maxLength={500}/></div>
      <Field name={t.sub} value={form.parentKey} onChange={() => {}}>
        <select className={INP} value={form.parentKey || ''} onChange={e => change('parentKey', e.target.value)}><option value="">{t.root}</option>
          {roots.filter(root => root.key !== form.key && !root.parentKey).map(root => <option key={root.key} value={root.key}>{root.title} ({root.key})</option>)}
        </select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-3"><Field name={t.order} value={String(form.itemOrder ?? 0)} onChange={v => change('itemOrder', v)} type="number"/><Field name={t.icon} value={form.icon} onChange={v => change('icon', v)} maxLength={150}/><Field name={t.color} value={form.uiColor} onChange={v => change('uiColor', v)} maxLength={50}/></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(form.active)} onChange={e => change('active', e.target.checked)}/>{t.active}</label>
      <div className="flex justify-end gap-2"><button type="button" className={BTN} onClick={onCancel}>{t.cancel}</button><button className={MAIN} type="submit" disabled={busy}>{t.save}</button></div>
    </form>
  </Popup>
}

export default function AdminListsPage() {
  const { language } = useApp()
  const t = T[language] || T.en
  const access = useAdminAccess()
  const [defs, setDefs] = useState([])
  const [selected, setSelected] = useState(null)
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [dialog, setDialog] = useState(null)
  const [confirmation, setConfirmation] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [preview, setPreview] = useState(null)
  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const page = await getDefinitions(100, 0)
      setDefs(page.lists || [])
      setError('')
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => {
    if (access.status !== 'allowed') return
    let cancelled = false
    getDefinitions(100, 0).then(page => {
      if (cancelled) return
      setDefs(page.lists || [])
      setError('')
    }).catch(e => {
      if (!cancelled) setError(e.message)
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [access.status])
  const show = async (app, code) => {
    setPreview(null)
    try { setSelected(await getDefinition(app, code)); setError('') }
    catch (e) { setError(e.message) }
  }
  const queue = (message, run) => { setConfirmation({ title: t.confirmTitle, message, run }) }
  const perform = async () => {
    const next = confirmation
    if (!next || busy) return
    setBusy(true)
    setNotice('')
    try {
      const result = await next.run()
      setConfirmation(null); setDialog(null)
      setNotice(t.success)
      await refresh()
      if (result?.app && result?.code) await show(result.app, result.code)
      else if (selected) await show(selected.app, selected.code)
    } catch (e) { setConfirmation(null); setError(e.message) }
    finally { setBusy(false) }
  }
  const saveDefinition = form => queue(`${t.save}: ${form.app}/${form.code}`, () => listAction('saveDefinition', form))
  const saveItem = form => queue(`${t.save}: ${selected.app}/${selected.code}/${form.key}`, () =>
    listAction('saveItem', { app: selected.app, code: selected.code, ...form }).then(async r => { await show(selected.app, selected.code); return r }))
  const activeDefinition = (list, active) => queue(`${active ? t.enable : t.disable}: ${list.app}/${list.code}`, () => listAction('setDefinitionActive', { app: list.app, code: list.code, active }))
  const activeItem = (item, active) => queue(`${active ? t.enable : t.disable}: ${item.key}`, () => listAction('setItemActive', { app: selected.app, code: selected.code, key: item.key, active }))
  const filtered = useMemo(() => defs.filter(x => `${x.app} ${x.code} ${x.title} ${x.titleAr}`.toLowerCase().includes(filter.toLowerCase())), [defs, filter])
  const row = (item, child = false) => <div key={item.key} className={`flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 text-sm ${child ? 'ms-6 bg-bg-neutral/60' : ''}`}>
    <div><span className="font-semibold text-text-primary">{child ? ' - ' : ''}{language === 'ar' && item.titleAr ? item.titleAr : item.title}</span>
      <span className="ms-2 text-xs text-text-tertiary">{item.key} | {item.itemOrder} | {item.active ? t.active : t.disable}</span></div>
    <div className="flex flex-wrap gap-2"><button className={BTN} onClick={() => setDialog({ kind: 'item', item })}>{t.edit}</button>
      {!child ? <button className={BTN} onClick={() => setDialog({ kind: 'item', parentKey: item.key })}>{t.addChild}</button> : null}
      <button className={BTN} onClick={() => activeItem(item, !item.active)}>{item.active ? t.disable : t.enable}</button></div>
  </div>
  if (access.status !== 'allowed') return <div className="p-8 text-text-secondary" role="status">{access.status === 'denied' ? t.denied : t.loading}</div>
  return <div className="mx-auto w-full max-w-[1520px] space-y-6 px-4 py-6 md:px-8" dir={language === 'ar' ? 'rtl' : 'ltr'}>
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-semibold text-text-primary">{t.title}</h2><p className="text-sm text-text-secondary">{t.subtitle}</p></div>
      <div className="flex gap-2"><button className={BTN} onClick={refresh} disabled={loading}>{t.refresh}</button><button className={MAIN} onClick={() => setDialog({ kind: 'definition' })}>{t.add}</button></div></header>
    {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
    {notice ? <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-700">{notice}</p> : null}
    <div className="grid gap-5 lg:grid-cols-[minmax(290px,1fr)_minmax(350px,2fr)]">
      <section className="rounded-2xl border border-border bg-white p-4 shadow-sm"><h3 className="mb-3 text-lg font-semibold">{t.list}</h3>
        <Field name={t.search} value={filter} onChange={setFilter}/>
        <div className="mt-3 divide-y divide-border">{filtered.map(x => <button type="button" key={`${x.app}/${x.code}`} onClick={() => show(x.app, x.code)} className="flex w-full items-center justify-between gap-3 px-2 py-3 text-start hover:bg-bg-neutral">
          <span className="min-w-0"><strong className="block text-text-primary">{language === 'ar' && x.titleAr ? x.titleAr : x.title}</strong><small className="break-all text-text-secondary">{x.app} / {x.code}</small></span><span className="text-xs">{x.active ? t.active : t.disable}</span>
        </button>)}</div>
        {!filtered.length ? <p className="py-6 text-center text-sm text-text-tertiary">{t.empty}</p> : null}
      </section>
      <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
        {!selected ? <p className="py-12 text-center text-sm text-text-secondary">{t.choose}</p> : <>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-lg font-semibold">{selected.title}</h3><p className="text-xs text-text-tertiary">{selected.app} / {selected.code}</p></div>
            <div className="flex flex-wrap gap-2"><button className={BTN} onClick={() => setDialog({ kind: 'definition', item: selected })}>{t.edit}</button>
              <button className={BTN} onClick={() => activeDefinition(selected, !selected.active)}>{selected.active ? t.disable : t.enable}</button>
              <button className={BTN} onClick={async () => { try { setPreview(await getPublicList(selected.app, selected.code)); setError('') } catch(e) { setPreview(null); setError(e.message) } }}>{t.preview}</button></div></div>
          <p className="mb-3 text-xs text-text-tertiary">{t.warning}</p>
          <div className="mb-3 flex items-center justify-between"><h4 className="font-semibold">{t.items}</h4><button className={MAIN} onClick={() => setDialog({ kind: 'item', parentKey: '' })}>{t.addOption}</button></div>
          <div className="rounded-xl border border-border">{selected.items?.map(item => <div key={item.key}>{row(item)}{item.subItems?.map(child => row(child, true))}</div>)}
            {!selected.items?.length ? <p className="p-5 text-sm text-text-tertiary">{t.empty}</p> : null}</div>
          {preview ? <div className="mt-4 rounded-xl bg-bg-neutral p-3"><strong className="text-sm">{t.preview}</strong><pre className="mt-2 max-h-72 overflow-auto text-xs">{JSON.stringify(preview, null, 2)}</pre></div> : null}
        </>}
      </section>
    </div>
    {dialog?.kind === 'definition' ? <DefinitionForm key={dialog.item ? `${dialog.item.app}/${dialog.item.code}` : 'new'} item={dialog.item} t={t} busy={busy} onCancel={() => setDialog(null)} onSave={saveDefinition}/> : null}
    {dialog?.kind === 'item' && selected ? <ItemForm key={`${dialog.item?.key || 'new'}-${dialog.parentKey || ''}`} item={dialog.item} parentKey={dialog.parentKey} roots={selected.items || []} t={t} busy={busy} onCancel={() => setDialog(null)} onSave={saveItem}/> : null}
    {confirmation ? <ConfirmDialog title={confirmation.title} message={confirmation.message} language={language} busy={busy} onCancel={() => setConfirmation(null)} onConfirm={perform}/> : null}
  </div>
}
