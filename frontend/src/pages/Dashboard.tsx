import { Routes, Route, Navigate } from 'react-router-dom'
import Header from '@/components/Header'
import ImpersonationBanner from '@/components/ImpersonationBanner'
import DashboardHome from './DashboardHome'
import SessionsPage from './SessionsPage'
import MySessionsPage from './MySessionsPage'
import ImportPage from './ImportPage'
import EmailsPage from './EmailsPage'
import SessionEmailsPage from './SessionEmailsPage'
import SummaryPage from './SummaryPage'
import UsersPage from './UsersPage'
import MyProfilePage from './MyProfilePage'
import CompetencesPage from './CompetencesPage'
import CompetencesAdminPage from './CompetencesAdminPage'
import CompetencesInstructorPage from './CompetencesInstructorPage'
import StudentCompetencesPage from './StudentCompetencesPage'
import MyCompetencesPage from './MyCompetencesPage'
import GroupsPage from './GroupsPage'
import { useAuthStore } from '@/lib/auth'

export default function Dashboard() {
  const { impersonating, isAdmin: storeIsAdmin, canValidateCompetencies } = useAuthStore()
  // Admin view = admin ET pas en train d'impersonnifier
  const isAdmin = storeIsAdmin && !impersonating

  return (
    <div className={`min-h-screen bg-gray-50 ${impersonating ? 'ring-4 ring-red-500 ring-inset' : ''}`}>
      <ImpersonationBanner />
      <div className={impersonating ? 'pt-12' : ''}>
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Routes>
            <Route path="/" element={<DashboardHome />} />
            
            {/* Sessions - différent selon admin ou non */}
            <Route path="/sessions" element={isAdmin ? <SessionsPage /> : <MySessionsPage />} />
            
            {/* Summary - admin seulement */}
            {isAdmin && <Route path="/summary/:id" element={<SummaryPage />} />}
            
            {/* Import - admin seulement */}
            {isAdmin && <Route path="/import" element={<ImportPage />} />}
            
            {/* Emails - admin seulement */}
            {isAdmin && <Route path="/emails" element={<EmailsPage />} />}
            {isAdmin && <Route path="/emails/session/:id" element={<SessionEmailsPage />} />}
            
            {/* Utilisateurs - admin seulement */}
            {isAdmin && <Route path="/users" element={<UsersPage />} />}
            
            {/* Mon profil - pour les non-admins */}
            <Route path="/profile" element={<MyProfilePage />} />
            
            {/* Compétences - différent selon admin, encadrant ou élève */}
            <Route path="/competences" element={
              isAdmin ? <CompetencesAdminPage /> : 
              canValidateCompetencies ? <CompetencesInstructorPage /> : 
              <MyCompetencesPage />
            } />
            
            {/* Page de validation des compétences d'un élève - admin et encadrants */}
            {(isAdmin || canValidateCompetencies) && (
              <Route path="/competences/student/:studentId" element={<StudentCompetencesPage />} />
            )}
            
            {/* Legacy competences page - redirect to new one */}
            {isAdmin && <Route path="/competences-legacy" element={<CompetencesPage />} />}
            
            {/* Groupes - admin seulement */}
            {isAdmin && <Route path="/groups" element={<GroupsPage />} />}
            
            {/* Fallback */}
            <Route path="*" element={<Navigate to="/dashboard" />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
