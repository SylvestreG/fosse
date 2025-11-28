import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './lib/auth'
import LoginAdmin from './pages/LoginAdmin'
import Dashboard from './pages/Dashboard'
import PublicQuestionnaire from './pages/PublicQuestionnaire'

function App() {
  const { isAuthenticated } = useAuthStore()
  const basename = import.meta.env.MODE === 'production' ? '/fosse' : ''

  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route path="/login" element={<LoginAdmin />} />
        <Route path="/q/:token" element={<PublicQuestionnaire />} />
        <Route
          path="/dashboard/*"
          element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />}
        />
        <Route path="/" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

