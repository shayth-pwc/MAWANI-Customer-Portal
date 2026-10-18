import { useNavigate } from 'react-router-dom'
import { icons } from '../assets'
import Button from '../components/ui/Button'
import { useApp } from '../hooks/useApp'

export default function SuccessPage() {
  const { t, setContactOpen } = useApp()
  const navigate = useNavigate()

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-24 text-center">
      <div
        className="pointer-events-none absolute left-1/2 top-0 size-[768px] -translate-x-1/2"
        style={{ maskImage: 'radial-gradient(circle at center, black 0%, transparent 68%)' }}
      >
        <img src={icons.gridVertical} alt="" width={768} height={768} className="absolute inset-0" />
        <img src={icons.gridHorizontal} alt="" width={768} height={768} className="absolute inset-0" />
      </div>
      <div className="relative flex max-w-3xl flex-col items-center">
        <span className="mb-6 flex size-[82px] items-center justify-center rounded-full bg-teal-100">
          <img src={icons.faceHappy} alt="" width={41} height={41} />
        </span>
        <h1 className="text-display-lg font-semibold tracking-[-0.02em] text-text-primary">{t('thanksTitle')}</h1>
        <p className="mt-4 max-w-xl text-xl text-text-tertiary">{t('thanksBody')}</p>
        <div className="my-8 flex w-full max-w-md items-center gap-6">
          <span className="h-px flex-1 bg-border" />
          <img src={icons.heart} alt="" width={24} height={24} />
          <span className="h-px flex-1 bg-border" />
        </div>
        <p className="max-w-md text-xl text-text-tertiary">{t('thanksHelp')}</p>
        <div className="mt-8 flex flex-col items-center gap-4">
          <Button variant="tertiary-color" onClick={() => navigate('/')}>
              <img src={icons.arrowLeft} alt="" width={20} height={20} className="rtl:rotate-180" />
              {t('goHome')}
            </Button>
          <Button variant="tertiary" onClick={() => setContactOpen(true)}>
            <img src={icons.messageCircle} alt="" width={20} height={20} />
            {t('contactSupport')}
          </Button>
        </div>
      </div>
    </div>
  )
}
