import { Outlet } from 'react-router-dom'
import ContactModal from '../components/common/ContactModal'

export default function FocusLayout() {
  return (
    <div className="min-h-screen bg-white">
      <Outlet />
      <ContactModal />
    </div>
  )
}
