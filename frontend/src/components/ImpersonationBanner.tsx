import { useAuthStore } from '@/lib/auth'
import { authApi } from '@/lib/api'
import { useState } from 'react'

export default function ImpersonationBanner() {
  const { impersonating, stopImpersonation } = useAuthStore()
  const [loading, setLoading] = useState(false)

  if (!impersonating) return null

  const handleStopImpersonation = async () => {
    setLoading(true)
    try {
      const response = await authApi.stopImpersonation()
      stopImpersonation(response.data.token, response.data.can_validate_competencies)
    } catch (error) {
      console.error('Failed to stop impersonation:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-red-600 text-white py-2 px-4 flex items-center justify-center gap-4 shadow-lg">
      <span className="text-lg font-semibold">
        ⚠️ Vous impersonnifiez : <strong>{impersonating.user_name}</strong> ({impersonating.user_email})
      </span>
      <button
        onClick={handleStopImpersonation}
        disabled={loading}
        className="bg-white text-red-600 px-4 py-1 rounded font-medium hover:bg-red-100 transition-colors disabled:opacity-50"
      >
        {loading ? 'Sortie...' : '✕ Sortir'}
      </button>
    </div>
  )
}

