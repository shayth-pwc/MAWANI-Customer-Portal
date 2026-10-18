import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from '../layouts/AppLayout'
import FocusLayout from '../layouts/FocusLayout'
import ProfileLayout from '../layouts/ProfileLayout'
import ActivitiesPage from '../pages/ActivitiesPage'
import FeedbackPage from '../pages/FeedbackPage'
import HomePage from '../pages/HomePage'
import InvoicesPage from '../pages/InvoicesPage'
import ViolationsPage from '../pages/ViolationsPage'
import VisitsPage from '../pages/VisitsPage'
import LicensesPage from '../pages/LicensesPage'
import NotFoundPage from '../pages/NotFoundPage'
import CommercialRegistrationPage from '../pages/profile/CommercialRegistrationPage'
import MyDetailsPage from '../pages/profile/MyDetailsPage'
import SetPasswordPage from '../pages/profile/SetPasswordPage'
import PermitsPage from '../pages/PermitsPage'
import SurveysPage from '../pages/SurveysPage'
import RequestsPage from '../pages/RequestsPage'
import ServicePage from '../pages/ServicePage'
import SettingsPage from '../pages/SettingsPage'
import AuthPage from '../pages/AuthPage'
import RegisterPage from '../pages/RegisterPage'
import SignedOutPage from '../pages/SignedOutPage'
import SuccessPage from '../pages/SuccessPage'
import SupportPage from '../pages/SupportPage'

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<FocusLayout />}>
        <Route path="feedback" element={<FeedbackPage />} />
        <Route path="feedback/success" element={<SuccessPage />} />
        <Route path="login" element={<AuthPage mode="login" />} />
        <Route path="signup" element={<RegisterPage />} />
        <Route path="forgot-password" element={<AuthPage mode="forgot" />} />
        <Route path="signed-out" element={<SignedOutPage />} />
        <Route path="profile" element={<ProfileLayout />}>
          <Route index element={<MyDetailsPage />} />
          <Route path="registration" element={<CommercialRegistrationPage />} />
        </Route>
        <Route path="profile/password" element={<SetPasswordPage />} />
      </Route>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="empty" element={<HomePage empty />} />
        <Route path="activities" element={<ActivitiesPage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="licenses" element={<LicensesPage />} />
        <Route path="violations" element={<ViolationsPage />} />
        <Route path="visits" element={<VisitsPage />} />
        <Route path="requests" element={<RequestsPage />} />
        <Route path="permits" element={<PermitsPage />} />
        <Route path="surveys" element={<SurveysPage />} />
        <Route path="support" element={<SupportPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="home" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
