import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../../hooks/useApp'
import { useAdminAccess } from '../../hooks/useAdminAccess'
import {
  createIasUser, getIasUser, listIasGroups, listIasUsers,
  reconcileIasUserToPortal, setIasUserActive, syncIasUserToPortal, updateIasUser,
} from '../../services/adminIasApi'

const PAGE_SIZE = 25
const TEXT = {
  en: {
    title: 'IAS User Management', subtitle: 'Manage SAP Identity Authentication users securely from the Mawani portal.',
    users: 'Users', groups: 'Groups (read-only)', add: 'Create IAS User', refresh: 'Refresh',
    search: 'Filter users on this page', exact: 'Open by IAS user ID', find: 'Find user',
    searchHelp: 'The filter only searches this page. Use an exact IAS user ID to find an account elsewhere in the tenant.',
    user: 'User', email: 'Email', status: 'IAS status', action: 'Actions', active: 'Active', inactive: 'Inactive',
    unknown: 'Unknown', manage: 'Manage', enable: 'Activate', disable: 'Deactivate',
    none: 'No users match your filter.', showing: 'Showing', of: 'of', prev: 'Previous', next: 'Next',
    firstName: 'First name', lastName: 'Last name', userName: 'Username', create: 'Create user',
    edit: 'Edit IAS user', save: 'Save changes', cancel: 'Cancel', close: 'Close',
    enterNames: 'Enter a new first or last name only if that field should change. IAS does not currently expose the separate existing names through this portal API.',
    loading: 'Loading IAS users…', checking: 'Checking administrator permission…',
    denied: 'Access denied. IAS user administration is restricted to authorized Mawani system administrators.',
    accessError: 'Administrator access could not be verified.', retry: 'Retry',
    pending: 'The remote IAS operation may have succeeded. Inspect the account before attempting another change. If IAS and PostgreSQL differ, use the synchronization actions for the existing IAS ID. Do not recreate the user.',
    created: 'IAS user and PostgreSQL profile were created successfully.',
    updated: 'IAS user updated and synchronized with PostgreSQL.',
    changedStatus: 'IAS status updated and synchronized with PostgreSQL.',
    synced: 'Portal profile synchronized with IAS.', reconciled: 'Portal profile reconciled from IAS.',
    sync: 'Register portal profile', reconcile: 'Reconcile IAS fields',
    syncExplanation: 'Register an existing IAS account in PostgreSQL without modifying IAS.',
    reconcileExplanation: 'Overwrite the PostgreSQL IAS-sourced name, email and status using verified IAS data.',
    noChange: 'Provide at least one changed field.',
    self: 'You cannot deactivate your own signed-in IAS account from this page.',
    groupInfo: 'IAS groups can be viewed here. Membership assignment and removal require additional backend APIs; no changes are made from this tab.',
    groupName: 'Group name', groupId: 'IAS group ID',
    noGroups: 'No IAS groups found.',
    createConfirm: 'Create this IAS user? This writes to IAS and PostgreSQL. Any activation notification is governed by your IAS tenant settings.',
    activateConfirm: 'Activate this IAS account and synchronize the status with PostgreSQL?',
    deactivateConfirm: 'Deactivate this IAS account? The user will no longer be able to authenticate.',
    saveConfirm: 'Save these IAS changes and synchronize the approved fields into PostgreSQL?',
    syncConfirm: 'Register this existing IAS user in PostgreSQL? This will not create another IAS account.',
    reconcileConfirm: 'Reconcile this account? IAS-derived fields in PostgreSQL will be replaced by verified IAS values.',
    busy: 'Saving…', summary: 'All IAS users in tenant', accountId: 'IAS user ID',
    originalName: 'Current IAS display name',
  },
  ar: {
    title: 'إدارة مستخدمي IAS', subtitle: 'إدارة مستخدمي خدمة مصادقة الهوية من بوابة موانئ بشكل آمن.',
    users: 'المستخدمون', groups: 'المجموعات (للعرض فقط)', add: 'إنشاء مستخدم IAS', refresh: 'تحديث',
    search: 'تصفية المستخدمين في هذه الصفحة', exact: 'فتح باستخدام معرّف IAS', find: 'بحث عن مستخدم',
    searchHelp: 'تقتصر التصفية على الصفحة الحالية. استخدم معرّف IAS للعثور على مستخدم في صفحات أخرى.',
    user: 'المستخدم', email: 'البريد الإلكتروني', status: 'حالة IAS', action: 'الإجراءات', active: 'نشط', inactive: 'غير نشط',
    unknown: 'غير معروف', manage: 'إدارة', enable: 'تفعيل', disable: 'تعطيل',
    none: 'لا يوجد مستخدمون مطابقون.', showing: 'عرض', of: 'من', prev: 'السابق', next: 'التالي',
    firstName: 'الاسم الأول', lastName: 'اسم العائلة', userName: 'اسم المستخدم', create: 'إنشاء المستخدم',
    edit: 'تعديل مستخدم IAS', save: 'حفظ التغييرات', cancel: 'إلغاء', close: 'إغلاق',
    enterNames: 'أدخل الاسم الأول أو الأخير فقط إذا رغبت في تغييره. لا تعرض واجهة IAS الحالية الأسماء القديمة كحقول منفصلة.',
    loading: 'جارٍ تحميل مستخدمي IAS…', checking: 'جارٍ التحقق من صلاحيات المسؤول…',
    denied: 'الوصول مرفوض. إدارة مستخدمي IAS مخصصة لمسؤولي النظام المخولين.',
    accessError: 'تعذر التحقق من صلاحيات المسؤول.', retry: 'إعادة المحاولة',
    pending: 'قد تكون العملية قد نجحت في IAS. تحقق من الحساب قبل إعادة المحاولة. إذا اختلفت بيانات IAS وPostgreSQL، استخدم إجراءات المزامنة للمعرّف الحالي. لا تنشئ المستخدم مرة أخرى.',
    created: 'تم إنشاء المستخدم في IAS وPostgreSQL بنجاح.',
    updated: 'تم تحديث المستخدم في IAS ومزامنته مع PostgreSQL.',
    changedStatus: 'تم تحديث حالة المستخدم ومزامنتها مع PostgreSQL.',
    synced: 'تم تسجيل ملف المستخدم في البوابة.', reconciled: 'تمت مطابقة ملف المستخدم مع بيانات IAS.',
    sync: 'تسجيل ملف البوابة', reconcile: 'مطابقة بيانات IAS',
    syncExplanation: 'تسجيل مستخدم IAS موجود في PostgreSQL دون تغيير حساب IAS.',
    reconcileExplanation: 'تحديث الاسم والبريد والحالة في PostgreSQL من بيانات IAS المعتمدة.',
    noChange: 'أدخل حقلاً واحداً متغيراً على الأقل.',
    self: 'لا يمكنك تعطيل حساب IAS الحالي من هذه الصفحة.',
    groupInfo: 'يمكن استعراض مجموعات IAS فقط. إضافة الأعضاء أو إزالتهم تتطلب واجهة خلفية إضافية.',
    groupName: 'اسم المجموعة', groupId: 'معرّف المجموعة',
    noGroups: 'لا توجد مجموعات.',
    createConfirm: 'هل تريد إنشاء المستخدم في IAS وPostgreSQL؟ تعتمد إشعارات التفعيل على إعدادات مستأجر IAS.',
    activateConfirm: 'هل تريد تفعيل الحساب ومزامنة حالته مع PostgreSQL؟',
    deactivateConfirm: 'هل تريد تعطيل حساب IAS؟ لن يتمكن المستخدم من تسجيل الدخول.',
    saveConfirm: 'هل تريد حفظ التغييرات في IAS ومزامنتها مع PostgreSQL؟',
    syncConfirm: 'هل تريد تسجيل مستخدم IAS الحالي في PostgreSQL دون إنشاء مستخدم IAS جديد؟',
    reconcileConfirm: 'هل تريد تحديث حقول IAS في PostgreSQL من البيانات المعتمدة في IAS؟',
    busy: 'جارٍ الحفظ…', summary: 'مستخدمو مستأجر IAS', accountId: 'معرّف مستخدم IAS',
    originalName: 'الاسم المعروض الحالي في IAS',
  },
}

const secondaryButton = 'inline-flex min-h-10 items-center justify-center rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold text-text-secondary hover:bg-bg-active disabled:cursor-not-allowed disabled:opacity-50'
const primaryButton = 'inline-flex min-h-10 items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'
const inputStyle = 'w-full min-h-10 rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary outline-none focus:border-brand focus:ring-2 focus:ring-brand/20'

function errorMessage(error, t) {
  return error?.pending ? `${error.message} ${t.pending}` : error?.message || t.accessError
}

function StatusPill({ active, t }) {
  const valid = active === true || active === false
  const cls = !valid ? 'bg-gray-100 text-gray-600' : active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>
    {valid ? (active ? t.active : t.inactive) : t.unknown}
  </span>
}

function ModalShell({ title, close, busy, children }) {
  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape' && !busy) close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, close])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6">
      <div role="dialog" aria-modal="true" aria-label={title} className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl border border-border bg-white p-5 shadow-xl sm:p-7">
        <div className="mb-5 flex items-start justify-between gap-3">
          <h2 className="text-xl font-semibold text-text-primary">{title}</h2>
          <button type="button" onClick={close} disabled={busy} aria-label="Close" className="rounded-md px-2 py-1 text-lg text-text-secondary hover:bg-bg-active disabled:opacity-50">×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function FormField({ label, value, onChange, required, type = 'text', hint, autoComplete, maxLength = 150 }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold text-text-primary">{label}{required ? ' *' : ''}</span>
      <input className={inputStyle} type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} maxLength={type === 'email' ? 254 : maxLength} autoComplete={autoComplete || 'off'} />
      {hint ? <span className="block text-xs text-text-tertiary">{hint}</span> : null}
    </label>
  )
}

function CreateUserModal({ t, busy, onClose, onSubmit, error }) {
  const [form, setForm] = useState({ userName: '', email: '', givenName: '', familyName: '' })
  const change = (key) => (value) => setForm((f) => ({ ...f, [key]: value }))
  return (
    <ModalShell title={t.add} busy={busy} close={onClose}>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); onSubmit(form) }}>
        {error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        <FormField label={t.userName} value={form.userName} onChange={change('userName')} required />
        <FormField label={t.email} value={form.email} onChange={change('email')} type="email" required />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t.firstName} value={form.givenName} onChange={change('givenName')} maxLength={100} required />
          <FormField label={t.lastName} value={form.familyName} onChange={change('familyName')} maxLength={100} required />
        </div>
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} disabled={busy} className={secondaryButton}>{t.cancel}</button>
          <button type="submit" disabled={busy} className={primaryButton}>{busy ? t.busy : t.create}</button>
        </div>
      </form>
    </ModalShell>
  )
}

function EditUserModal({ user, t, busy, onClose, onSubmit, onStatus, onSync, onReconcile, self, error }) {
  const [email, setEmail] = useState(user.email || '')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const changes = () => ({
    ...(email.trim() !== (user.email || '') ? { email: email.trim() } : {}),
    ...(firstName.trim() ? { givenName: firstName.trim() } : {}),
    ...(lastName.trim() ? { familyName: lastName.trim() } : {}),
  })
  return (
    <ModalShell title={t.edit} busy={busy} close={onClose}>
      {error ? <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      <div className="mb-5 space-y-1 rounded-xl bg-bg-neutral p-3 text-sm text-text-secondary">
        <p className="font-semibold text-text-primary">{user.userName}</p>
        <p>{t.originalName}: {user.displayName || '—'}</p>
        <p className="break-all text-xs">{t.accountId}: {user.id}</p>
        <div className="pt-1"><StatusPill active={user.active} t={t} /></div>
      </div>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); onSubmit(user.id, changes()) }}>
        <FormField label={t.email} value={email} onChange={setEmail} type="email" />
        <p className="rounded-lg bg-blue-50 p-3 text-xs text-blue-800">{t.enterNames}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t.firstName} value={firstName} onChange={setFirstName} maxLength={100} />
          <FormField label={t.lastName} value={lastName} onChange={setLastName} maxLength={100} />
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className={secondaryButton}>{t.cancel}</button>
          <button type="submit" disabled={busy} className={primaryButton}>{busy ? t.busy : t.save}</button>
        </div>
      </form>
      <div className="mt-6 space-y-3 border-t border-border pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm font-semibold text-text-primary">{t.status}</span>
          {typeof user.active === 'boolean' ? (
            <button type="button" className={secondaryButton} disabled={busy || (self && user.active)} onClick={() => onStatus(user, !user.active)}>
              {user.active ? t.disable : t.enable}
            </button>
          ) : null}
        </div>
        {self && user.active ? <p className="text-xs text-text-tertiary">{t.self}</p> : null}
        <div className="rounded-xl border border-border p-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => onSync(user)} className={secondaryButton}>{t.sync}</button>
            <button type="button" disabled={busy} onClick={() => onReconcile(user)} className={secondaryButton}>{t.reconcile}</button>
          </div>
          <p className="mt-2 text-xs text-text-tertiary">{t.syncExplanation}</p>
          <p className="mt-1 text-xs text-text-tertiary">{t.reconcileExplanation}</p>
        </div>
      </div>
    </ModalShell>
  )
}

function AccessScreen({ access, t }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <div role={access.status === 'denied' ? 'alert' : 'status'} className="rounded-2xl border border-border bg-white p-8">
        <h2 className="text-lg font-semibold text-text-primary">
          {access.status === 'checking' ? t.checking : access.status === 'denied' ? t.denied : t.accessError}
        </h2>
        {access.status === 'error' ? (
          <>
            <p className="mt-3 text-sm text-text-secondary">{access.error}</p>
            <button type="button" onClick={access.retry} className={`${primaryButton} mt-4`}>{t.retry}</button>
          </>
        ) : null}
      </div>
    </div>
  )
}

function AdminUsersContent({ t, profile }) {
  const [tab, setTab] = useState('users')
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [data, setData] = useState({ users: [], totalResults: 0 })
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [query, setQuery] = useState('')
  const [exactId, setExactId] = useState('')
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')
  const [modal, setModal] = useState(null)
  const [busy, setBusy] = useState(false)
  const [lookupBusy, setLookupBusy] = useState(false)
  const [groups, setGroups] = useState(null)
  const [groupsBusy, setGroupsBusy] = useState(false)
  const [groupsError, setGroupsError] = useState('')

  useEffect(() => {
    let alive = true
    listIasUsers((page - 1) * PAGE_SIZE + 1, PAGE_SIZE)
      .then((result) => {
        if (!alive) return
        setData(result)
        setListError('')
      })
      .catch((error) => { if (alive) setListError(errorMessage(error, t)) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [page, revision, t])

  const visible = useMemo(() => {
    const needle = query.toLocaleLowerCase().trim()
    if (!needle) return data.users
    return data.users.filter((user) => [user.userName, user.displayName, user.email, user.id]
      .some((value) => String(value || '').toLocaleLowerCase().includes(needle)))
  }, [data.users, query])

  const maxPage = Math.max(1, Math.ceil(data.totalResults / PAGE_SIZE))
  const refresh = () => {
    setLoading(true)
    setRevision((r) => r + 1)
  }
  const goto = (next) => {
    if (next < 1 || next > maxPage || loading) return
    setPage(next)
    setLoading(true)
    setListError('')
  }
  const showGroups = async () => {
    setTab('groups')
    if (groups !== null) return
    setGroupsBusy(true)
    setGroupsError('')
    try { setGroups(await listIasGroups(1, 100)) }
    catch (error) { setGroupsError(errorMessage(error, t)) }
    finally { setGroupsBusy(false) }
  }
  const openUser = async (id) => {
    setLookupBusy(true)
    setActionError('')
    setNotice('')
    try {
      const user = await getIasUser(id)
      setModal({ mode: 'edit', user })
    } catch (error) { setActionError(errorMessage(error, t)) }
    finally { setLookupBusy(false) }
  }
  const mutate = async (run, message) => {
    setBusy(true)
    setActionError('')
    setNotice('')
    try {
      await run()
      setModal(null)
      setNotice(message)
      refresh()
    } catch (error) {
      // Do not leave the same mutation form ready for a blind retry after a
      // partial IAS commit or uncertain network/verification response.
      if (error?.pending) setModal(null)
      setActionError(errorMessage(error, t))
    } finally { setBusy(false) }
  }
  const create = (form) => {
    if (!window.confirm(`${t.createConfirm}\n${form.userName} · ${form.email}`)) return
    mutate(() => createIasUser(form), t.created)
  }
  const save = (id, changes) => {
    if (!Object.keys(changes).length) { setActionError(t.noChange); return }
    if (!window.confirm(t.saveConfirm)) return
    mutate(() => updateIasUser(id, changes), t.updated)
  }
  const statusChange = (user, active) => {
    if (!active && user.id === profile?.IAS_ID) { setActionError(t.self); return }
    if (!window.confirm(`${active ? t.activateConfirm : t.deactivateConfirm}\n${user.userName}`)) return
    mutate(() => setIasUserActive(user.id, active), t.changedStatus)
  }
  const sync = (user) => {
    if (!window.confirm(`${t.syncConfirm}\n${user.userName}`)) return
    mutate(() => syncIasUserToPortal(user.id), t.synced)
  }
  const reconcile = (user) => {
    if (!window.confirm(`${t.reconcileConfirm}\n${user.userName}`)) return
    mutate(() => reconcileIasUserToPortal(user.id), t.reconciled)
  }

  return (
    <div className="mx-auto w-full max-w-[1520px] space-y-6 px-4 py-6 md:px-8 md:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-text-tertiary">{t.summary}</p>
          <p className="text-2xl font-semibold text-text-primary" aria-live="polite">{data.totalResults.toLocaleString()}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={refresh} disabled={loading} className={secondaryButton}>{t.refresh}</button>
          <button type="button" onClick={() => { setActionError(''); setNotice(''); setModal({ mode: 'create' }) }} className={primaryButton}>{t.add}</button>
        </div>
      </div>
      {notice ? <p role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{notice}</p> : null}
      {actionError ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{actionError}</p> : null}
      <div className="rounded-2xl border border-border bg-white shadow-sm">
        <div className="flex gap-5 border-b border-border px-5 pt-4 text-sm font-semibold">
          <button type="button" onClick={() => setTab('users')} aria-current={tab === 'users' ? 'page' : undefined}
            className={`border-b-2 pb-3 ${tab === 'users' ? 'border-brand text-brand' : 'border-transparent text-text-secondary'}`}>{t.users}</button>
          <button type="button" onClick={showGroups} aria-current={tab === 'groups' ? 'page' : undefined}
            className={`border-b-2 pb-3 ${tab === 'groups' ? 'border-brand text-brand' : 'border-transparent text-text-secondary'}`}>{t.groups}</button>
        </div>
        {tab === 'users' ? (
          <>
            <div className="grid gap-3 px-5 py-5 lg:grid-cols-2">
              <label className="space-y-1">
                <span className="block text-xs font-semibold text-text-secondary">{t.search}</span>
                <input className={inputStyle} value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder={t.search} />
              </label>
              <form className="flex items-end gap-2" onSubmit={(event) => { event.preventDefault(); if (exactId.trim()) openUser(exactId.trim()) }}>
                <label className="min-w-0 flex-1 space-y-1">
                  <span className="block text-xs font-semibold text-text-secondary">{t.exact}</span>
                  <input className={inputStyle} value={exactId} onChange={(event) => setExactId(event.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" maxLength={150} />
                </label>
                <button type="submit" disabled={lookupBusy || !exactId.trim()} className={secondaryButton}>{t.find}</button>
              </form>
              <p className="text-xs text-text-tertiary lg:col-span-2">{t.searchHelp}</p>
            </div>
            {listError ? <p role="alert" className="mx-5 mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{listError}</p> : null}
            {loading ? <p role="status" className="px-5 py-10 text-center text-sm text-text-secondary">{t.loading}</p> : (
              <div className="overflow-x-auto">
                <table className="min-w-[720px] w-full table-auto border-collapse text-start text-sm">
                  <thead className="bg-bg-neutral text-xs font-semibold text-text-secondary">
                    <tr><th scope="col" className="px-5 py-3 text-start">{t.user}</th><th scope="col" className="px-5 py-3 text-start">{t.email}</th><th scope="col" className="px-5 py-3 text-start">{t.status}</th><th scope="col" className="px-5 py-3 text-start">{t.action}</th></tr>
                  </thead>
                  <tbody>
                    {visible.map((user) => (
                      <tr key={user.id} className="border-t border-border hover:bg-bg-neutral/60">
                        <td className="px-5 py-4"><span className="block font-semibold text-text-primary">{user.displayName || user.userName}</span><span className="block text-xs text-text-tertiary">{user.userName}</span></td>
                        <td className="break-all px-5 py-4 text-text-secondary">{user.email || '—'}</td>
                        <td className="px-5 py-4"><StatusPill active={user.active} t={t} /></td>
                        <td className="px-5 py-4"><button type="button" className="font-semibold text-brand hover:underline" disabled={lookupBusy} onClick={() => openUser(user.id)}>{t.manage}</button></td>
                      </tr>
                    ))}
                    {!visible.length ? <tr><td colSpan={4} className="px-5 py-10 text-center text-sm text-text-secondary">{t.none}</td></tr> : null}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4 text-sm text-text-secondary">
              <span>{t.showing} {data.users.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{(page - 1) * PAGE_SIZE + data.users.length} {t.of} {data.totalResults}</span>
              <div className="flex items-center gap-2">
                <button type="button" disabled={page === 1 || loading} onClick={() => goto(page - 1)} className={secondaryButton}>{t.prev}</button>
                <span className="min-w-10 text-center">{page}/{maxPage}</span>
                <button type="button" disabled={page >= maxPage || loading} onClick={() => goto(page + 1)} className={secondaryButton}>{t.next}</button>
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-4 px-5 py-5">
            <p className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">{t.groupInfo}</p>
            {groupsBusy ? <p role="status" className="text-sm text-text-secondary">{t.loading}</p> : null}
            {groupsError ? <p role="alert" className="text-sm text-red-700">{groupsError}</p> : null}
            {groups && !groupsBusy ? (
              <>
                <div className="overflow-x-auto"><table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-start text-xs text-text-secondary"><th className="py-3 text-start">{t.groupName}</th><th className="py-3 text-start">{t.groupId}</th></tr></thead>
                  <tbody>{groups.groups.map((group) => <tr key={group.id} className="border-b border-border"><td className="py-3 font-semibold text-text-primary">{group.displayName || '—'}</td><td className="break-all py-3 text-xs text-text-secondary">{group.id}</td></tr>)}</tbody>
                </table></div>
                {!groups.groups.length ? <p className="text-sm text-text-secondary">{t.noGroups}</p> : null}
                <p className="text-xs text-text-tertiary">{t.showing} {groups.groups.length} {t.of} {groups.totalResults}</p>
              </>
            ) : null}
          </div>
        )}
      </div>
      {modal?.mode === 'create' ? <CreateUserModal t={t} busy={busy} error={actionError} onClose={() => setModal(null)} onSubmit={create} /> : null}
      {modal?.mode === 'edit' ? (
        <EditUserModal key={modal.user.id} user={modal.user} t={t} busy={busy} onClose={() => setModal(null)}
          onSubmit={save} onStatus={statusChange} onSync={sync} onReconcile={reconcile} error={actionError} self={modal.user.id === profile?.IAS_ID} />
      ) : null}
    </div>
  )
}

export default function AdminUsersPage() {
  const { language, profile } = useApp()
  const t = TEXT[language] || TEXT.en
  const access = useAdminAccess()
  if (access.status !== 'allowed') return <AccessScreen access={access} t={t} />
  return <AdminUsersContent t={t} profile={profile} />
}
