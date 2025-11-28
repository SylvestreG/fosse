import { Routes, Route, Navigate } from 'react-router-dom'
import Header from '@/components/Header'
import DashboardHome from './DashboardHome'
import SessionsPage from './SessionsPage'
import ImportPage from './ImportPage'
import EmailsPage from './EmailsPage'
import SessionEmailsPage from './SessionEmailsPage'
import SummaryPage from './SummaryPage'
import UsersPage from './UsersPage'

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Routes>
          <Route path="/" element={<DashboardHome />} />
          <Route path="/sessions" element={<SessionsPage />} />
          <Route path="/summary/:id" element={<SummaryPage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/emails" element={<EmailsPage />} />
          <Route path="/emails/session/:id" element={<SessionEmailsPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
      </main>
    </div>
  )
}

