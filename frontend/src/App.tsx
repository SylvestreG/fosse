import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './lib/auth'
import LoginAdmin from './pages/LoginAdmin'
import ChangePassword from './pages/ChangePassword'
import Dashboard from './pages/Dashboard'
import PublicQuestionnaire from './pages/PublicQuestionnaire'
import PublicSummary from './pages/PublicSummary'

function App() {
  const { isAuthenticated, mustChangePassword } = useAuthStore()
  const basename = import.meta.env.MODE === 'production' ? '/fosse' : ''

  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route path="/login" element={<LoginAdmin />} />
        <Route 
          path="/change-password" 
          element={isAuthenticated ? <ChangePassword /> : <Navigate to="/login" />} 
        />
        <Route path="/q/:token" element={<PublicQuestionnaire />} />
        <Route path="/s/:token" element={<PublicSummary />} />
        <Route
          path="/dashboard/*"
          element={
            isAuthenticated 
              ? (mustChangePassword ? <Navigate to="/change-password" /> : <Dashboard />)
              : <Navigate to="/login" />
          }
        />
        <Route path="/" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

