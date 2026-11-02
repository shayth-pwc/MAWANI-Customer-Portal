import { icons } from '../assets'
import Button from '../components/ui/Button'
import { useApp } from '../hooks/useApp'

export default function SignedOutPage() {
  const { t } = useApp()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <span className="mb-6 flex size-[82px] items-center justify-center rounded-full bg-teal-100">
        <img src={icons.logout} alt="" width={32} height={32} />
      </span>
      <h1 className="text-display-xs font-semibold text-text-primary">{t('signedOutTitle')}</h1>
      <p className="mt-3 max-w-md text-md text-text-tertiary">{t('signedOutBody')}</p>
      <Button
        className="mt-8"
        onClick={() => window.location.assign('/')}
      >
        {t('signIn')}
      </Button>
    </div>
  )
}
