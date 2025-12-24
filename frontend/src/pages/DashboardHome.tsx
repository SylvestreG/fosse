import { useEffect, useState } from 'react'
import { 
  sessionsApi, 
  questionnairesApi,
  peopleApi,
  skillValidationsApi,
  Session, 
  Person,
  CompetencyHierarchy 
} from '@/lib/api'
import Button from '@/components/Button'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '@/lib/auth'

export default function DashboardHome() {
  const navigate = useNavigate()
  const { email, impersonating } = useAuthStore()
  const targetEmail = impersonating?.user_email || email
  
  const [person, setPerson] = useState<Person | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [myFossesCount, setMyFossesCount] = useState(0)
  const [competencyProgress, setCompetencyProgress] = useState<CompetencyHierarchy | null>(null)
  const [validationsGiven, setValidationsGiven] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [targetEmail])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Load sessions
      const sessionsRes = await sessionsApi.list()
      setSessions(sessionsRes.data)
      
      // Load current user's profile
      if (targetEmail) {
        const peopleRes = await peopleApi.list(targetEmail)
        const me = peopleRes.data.find(p => p.email === targetEmail)
        if (me) {
          setPerson(me)
          
          // Count my fosses (questionnaires submitted)
          let fossesCount = 0
          for (const session of sessionsRes.data) {
            try {
              const qRes = await questionnairesApi.list(session.id)
              if (qRes.data.some(q => q.person_id === me.id && q.submitted_at)) {
                fossesCount++
              }
            } catch {
              // Ignore errors
            }
          }
          setMyFossesCount(fossesCount)
          
          // Load competency progress if preparing a level
          if (me.preparing_level) {
            try {
              const compRes = await skillValidationsApi.getPersonCompetencies(me.id, me.preparing_level)
              setCompetencyProgress(compRes.data)
            } catch {
              // Ignore errors
            }
          }
          
          // For instructors: count validations given
          if (me.is_instructor) {
            try {
              const validationsRes = await skillValidationsApi.list()
              const myValidations = validationsRes.data.filter(v => v.validated_by_id === me.id)
              setValidationsGiven(myValidations.length)
            } catch {
              // Ignore errors
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Check if profile needs updating
  const isProfileIncomplete = person && (
    !person.phone ||
    (!person.diving_level && !person.preparing_level)
  )

  // Get upcoming sessions (future dates)
  const upcomingSessions = sessions
    .filter(s => new Date(s.start_date) >= new Date())
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
    .slice(0, 3)

  // Calculate competency stats
  const competencyStats = competencyProgress?.domains.reduce(
    (acc, domain) => ({
      total: acc.total + domain.progress.total,
      validated: acc.validated + domain.progress.validated,
      inProgress: acc.inProgress + domain.progress.in_progress,
    }),
    { total: 0, validated: 0, inProgress: 0 }
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white">
          👋 Bonjour{person ? `, ${person.first_name}` : ''} !
        </h1>
        <p className="text-slate-400 mt-1">
          Bienvenue sur votre tableau de bord
        </p>
      </div>

      {/* Profile Warning */}
      {isProfileIncomplete && (
        <div className="bg-amber-500/20 border border-amber-500/50 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="text-amber-300 font-medium">Profil incomplet</p>
              <p className="text-amber-200/80 text-sm">
                {!person?.phone && 'Numéro de téléphone manquant. '}
                {!person?.diving_level && !person?.preparing_level && 'Niveau de plongée non renseigné.'}
              </p>
            </div>
          </div>
          <Button 
            onClick={() => navigate('/dashboard/mon-profil')}
            className="shrink-0"
          >
            Compléter mon profil
          </Button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Mes Fosses */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">🤿</span>
            <h3 className="text-sm font-medium text-slate-400">Mes Fosses</h3>
          </div>
          <p className="text-3xl sm:text-4xl font-bold text-cyan-400">{myFossesCount}</p>
          <p className="text-xs text-slate-500 mt-1">participations</p>
        </div>

        {/* Niveau actuel */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">🎖️</span>
            <h3 className="text-sm font-medium text-slate-400">Niveau</h3>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white">
            {person?.diving_level_display || '-'}
          </p>
          {person?.preparing_level && (
            <p className="text-xs text-amber-400 mt-1">🎯 Prépare {person.preparing_level}</p>
          )}
        </div>

        {/* Compétences (si en préparation) */}
        {competencyStats && competencyStats.total > 0 ? (
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">📊</span>
              <h3 className="text-sm font-medium text-slate-400">Compétences</h3>
            </div>
            <p className="text-3xl sm:text-4xl font-bold text-green-400">
              {competencyStats.validated}/{competencyStats.total}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {competencyStats.inProgress > 0 && `${competencyStats.inProgress} en cours`}
            </p>
          </div>
        ) : person?.is_instructor ? (
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">✅</span>
              <h3 className="text-sm font-medium text-slate-400">Validations données</h3>
            </div>
            <p className="text-3xl sm:text-4xl font-bold text-purple-400">{validationsGiven}</p>
            <p className="text-xs text-slate-500 mt-1">compétences validées</p>
          </div>
        ) : (
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">📚</span>
              <h3 className="text-sm font-medium text-slate-400">Formation</h3>
            </div>
            <p className="text-lg font-medium text-slate-300">-</p>
            <p className="text-xs text-slate-500 mt-1">Aucun niveau en préparation</p>
          </div>
        )}

        {/* Statut encadrant */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">{person?.is_instructor ? '👨‍🏫' : '👨‍🎓'}</span>
            <h3 className="text-sm font-medium text-slate-400">Statut</h3>
          </div>
          <p className="text-lg sm:text-xl font-bold text-white">
            {person?.is_instructor ? 'Encadrant' : 'Élève'}
          </p>
          {person?.is_instructor && (
            <p className="text-xs text-purple-400 mt-1">Peut valider des compétences</p>
          )}
        </div>
      </div>

      {/* Prochains événements */}
      <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-700/50 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">📅 Prochains événements</h2>
          <Link to="/dashboard/mes-sessions" className="text-sm text-cyan-400 hover:text-cyan-300">
            Voir tout →
          </Link>
        </div>
        
        {upcomingSessions.length === 0 ? (
          <div className="p-6 sm:p-8 text-center">
            <p className="text-slate-400 mb-4">Aucun événement à venir</p>
            <Button variant="secondary" onClick={() => navigate('/dashboard/mes-sessions')}>
              Voir les sessions
            </Button>
          </div>
        ) : (
          <div className="p-4 sm:p-6 space-y-3">
            {upcomingSessions.map((session) => {
              const startDate = new Date(session.start_date)
              const isToday = startDate.toDateString() === new Date().toDateString()
              const isTomorrow = startDate.toDateString() === new Date(Date.now() + 86400000).toDateString()
              const isThisWeek = startDate.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000
              
              let dateLabel = startDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
              if (isToday) dateLabel = "Aujourd'hui"
              else if (isTomorrow) dateLabel = "Demain"
              
              return (
                <div 
                  key={session.id} 
                  className={`p-4 rounded-lg border transition-all ${
                    isToday 
                      ? 'bg-cyan-500/10 border-cyan-500/50' 
                      : isThisWeek 
                        ? 'bg-slate-700/30 border-slate-600/50' 
                        : 'bg-slate-700/20 border-slate-700/30'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        {isToday && <span className="px-2 py-0.5 text-xs bg-cyan-500/20 text-cyan-300 rounded-full border border-cyan-500/30">Aujourd'hui</span>}
                        {isTomorrow && <span className="px-2 py-0.5 text-xs bg-amber-500/20 text-amber-300 rounded-full border border-amber-500/30">Demain</span>}
                        <h3 className="font-semibold text-white">{session.name}</h3>
                      </div>
                      <p className="text-sm text-slate-400 mt-1">
                        📅 {dateLabel}
                        {session.location && ` • 📍 ${session.location}`}
                      </p>
                    </div>
                    <Button 
                      size="sm" 
                      variant={isToday ? 'primary' : 'secondary'}
                      onClick={() => navigate('/dashboard/mes-sessions')}
                    >
                      {isToday ? "Je m'inscris" : 'Voir'}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link 
          to="/dashboard/mes-sessions" 
          className="bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 rounded-xl p-6 hover:from-cyan-500/30 hover:to-blue-500/30 transition-all group"
        >
          <div className="flex items-center gap-4">
            <span className="text-3xl">🤿</span>
            <div>
              <h3 className="font-semibold text-white group-hover:text-cyan-300 transition-colors">Mes Sessions</h3>
              <p className="text-sm text-slate-400">Inscriptions aux fosses</p>
            </div>
          </div>
        </Link>

        {person?.preparing_level && (
          <Link 
            to="/dashboard/mes-competences" 
            className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-xl p-6 hover:from-green-500/30 hover:to-emerald-500/30 transition-all group"
          >
            <div className="flex items-center gap-4">
              <span className="text-3xl">📊</span>
              <div>
                <h3 className="font-semibold text-white group-hover:text-green-300 transition-colors">Mes Compétences</h3>
                <p className="text-sm text-slate-400">Suivi de ma progression</p>
              </div>
            </div>
          </Link>
        )}

        {person?.is_instructor && (
          <Link 
            to="/dashboard/competences" 
            className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-xl p-6 hover:from-purple-500/30 hover:to-pink-500/30 transition-all group"
          >
            <div className="flex items-center gap-4">
              <span className="text-3xl">✅</span>
              <div>
                <h3 className="font-semibold text-white group-hover:text-purple-300 transition-colors">Valider Compétences</h3>
                <p className="text-sm text-slate-400">Validation des élèves</p>
              </div>
            </div>
          </Link>
        )}

        <Link 
          to="/dashboard/mon-profil" 
          className="bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-xl p-6 hover:from-amber-500/30 hover:to-orange-500/30 transition-all group"
        >
          <div className="flex items-center gap-4">
            <span className="text-3xl">👤</span>
            <div>
              <h3 className="font-semibold text-white group-hover:text-amber-300 transition-colors">Mon Profil</h3>
              <p className="text-sm text-slate-400">Mes préférences</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}
