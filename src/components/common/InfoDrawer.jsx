import { icons } from '../../assets'
import { useApp } from '../../hooks/useApp'

const FEATURED = {
  license: icons.licenseFeatured,
  permit: icons.permitFeatured,
  objection: icons.objectionFeatured,
  violation: icons.objectionFeatured,
}

export function FeaturedIcon({ type, className = '' }) {
  return <img src={FEATURED[type]} alt="" className={`-ms-3 shrink-0 ${className}`} />
}

export function DrawerClose({ onClose, className = '' }) {
  const { t } = useApp()
  return (
    <button type="button" aria-label={t('close')} onClick={onClose} className={`flex size-9 items-center justify-center rounded-lg hover:bg-bg-active ${className}`}>
      <img src={icons.xClose} alt="" width={20} height={20} />
    </button>
  )
}

export function DetailLine({ label, value, labelClass = 'w-40' }) {
  return (
    <div className="flex gap-4">
      <p className={`${labelClass} shrink-0 text-text-placeholder`}>{label}</p>
      <p className="font-medium text-text-primary">{value}</p>
    </div>
  )
}

function fileKind(file) {
  return String(file.kind || '').toLowerCase()
}

function isImageFile(file) {
  const kind = fileKind(file)
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'image'].includes(kind)) return true
  return /\.(png|jpe?g|gif|webp)$/i.test(file.name || '')
}

function isSpreadsheetFile(file) {
  const kind = fileKind(file)
  if (['xls', 'xlsx', 'excel'].includes(kind)) return true
  return /\.xlsx?$/i.test(file.name || '')
}

function downloadFile(name) {
  const url = URL.createObjectURL(new Blob(['Attachment'], { type: 'application/octet-stream' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

function DownloadIcon({ color = '#1b8354' }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 3.333v9.167m0 0 3.333-3.333M10 12.5 6.667 9.167M4.167 16.667h11.666" stroke={color} strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Attachment({ file, downloadColor }) {
  const { t } = useApp()
  return (
    <div className="mt-4 flex items-center gap-3 rounded-xl border border-border px-3 py-3">
      {isImageFile(file) ? (
        <img src={icons.fileTypePng} alt="" />
      ) : isSpreadsheetFile(file) ? (
        <img src={icons.fileTypeXls} alt="" />
      ) : (
        <span className="rounded bg-success-50 px-1.5 py-1 text-[10px] font-bold text-success-700">{file.kind}</span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-text-primary">{file.name}</span>
        <span className="block text-xs text-text-tertiary">{t('reqFileSize')}</span>
      </span>
      <button type="button" aria-label={t('visDownloadNamed', { name: file.name })} onClick={() => downloadFile(file.name)}>
        <DownloadIcon color={downloadColor} />
      </button>
    </div>
  )
}

export function AttachmentSection({ files, downloadColor = '#1b8354' }) {
  const { t } = useApp()
  return (
    <section className="border-t border-border px-6 py-5">
      <h3 className="flex items-center gap-2 text-sm font-medium text-text-placeholder">
        <img src={icons.link} alt="" />
        {t('reqAttachments')}
      </h3>
      {files.map((file, index) => (
        <Attachment key={`${file.name}-${index}`} file={file} downloadColor={downloadColor} />
      ))}
    </section>
  )
}
