import { BrowserRouter } from 'react-router-dom'
import { SessionTransition } from './components/common/LoadingScreen'
import { AppProvider } from './context/AppContext'
import AppRoutes from './routes/AppRoutes'

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <AppRoutes />
        <SessionTransition />
      </AppProvider>
    </BrowserRouter>
  )
}
