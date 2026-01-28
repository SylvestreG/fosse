import { Routes, Route, Navigate } from 'react-router-dom'
import Header from '@/components/Header'
import ImpersonationBanner from '@/components/ImpersonationBanner'
import DashboardHome from './DashboardHome'
import SessionsPage from './SessionsPage'
import MySessionsPage from './MySessionsPage'
import SortiesPage from './SortiesPage'
import SortiePage from './SortiePage'
import ImportPage from './ImportPage'
import EmailsPage from './EmailsPage'
import SessionEmailsPage from './SessionEmailsPage'
import SummaryPage from './SummaryPage'
import PalanqueesPage from './PalanqueesPage'
import UsersPage from './UsersPage'
import MyProfilePage from './MyProfilePage'
import CompetencesPage from './CompetencesPage'
import CompetencesAdminPage from './CompetencesAdminPage'
import CompetencesInstructorPage from './CompetencesInstructorPage'
import StudentCompetencesPage from './StudentCompetencesPage'
import MyCompetencesPage from './MyCompetencesPage'
import GroupsPage from './GroupsPage'
import LevelDocumentsPage from './LevelDocumentsPage'
import ValidationLogsPage from './ValidationLogsPage'
import { useAuthStore } from '@/lib/auth'
import { useThemeStore } from '@/lib/theme'

export default function Dashboard() {
  const { impersonating, isAdmin: storeIsAdmin, canValidateCompetencies } = useAuthStore()
  const { theme } = useThemeStore()
  // Admin view = admin ET pas en train d'impersonnifier
  const isAdmin = storeIsAdmin && !impersonating
  
  console.log('Dashboard render:', { storeIsAdmin, impersonating: !!impersonating, canValidateCompetencies, isAdmin })

  return (
    <div className={`min-h-screen theme-bg-gradient ${impersonating ? 'ring-4 ring-red-500 ring-inset' : ''} ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
      <ImpersonationBanner />
      <div className={impersonating ? 'pt-12' : ''}>
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Routes>
            <Route path="/" element={<DashboardHome />} />
            
            {/* Sessions - différent selon admin ou non */}
            <Route path="/sessions" element={isAdmin ? <SessionsPage /> : <MySessionsPage />} />
            
            {/* Sorties - admin seulement */}
            {isAdmin && <Route path="/sorties" element={<SortiesPage />} />}
            {isAdmin && <Route path="/sorties/:id" element={<SortiePage />} />}
            
            {/* Summary - admin seulement */}
            {isAdmin && <Route path="/summary/:id" element={<SummaryPage />} />}
            
            {/* Palanquées - accessible à tous (le backend vérifie l'inscription à la session) */}
            <Route path="/palanquees/:sessionId" element={<PalanqueesPage />} />
            
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
            
            {/* Documents de compétences - admin seulement */}
            {isAdmin && <Route path="/level-documents" element={<LevelDocumentsPage />} />}
            
            {/* Logs des validations - admin seulement */}
            {isAdmin && <Route path="/validation-logs" element={<ValidationLogsPage />} />}
            
            {/* Fallback */}
            <Route path="*" element={<Navigate to="/dashboard" />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
