import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { sortiesApi, type Sortie } from '@/lib/api'

type SortiesAccessContextValue = {
  /** Afficher le lien Sorties dans la nav */
  showSortiesNav: boolean
  /** Pour les non-admins : sorties DP / prochaine. Toujours vide si admin. */
  directorSorties: Sortie[]
  loadingDirectorSorties: boolean
}

const SortiesAccessContext = createContext<SortiesAccessContextValue>({
  showSortiesNav: false,
  directorSorties: [],
  loadingDirectorSorties: false,
})

export function SortiesAccessProvider({
  isAdmin,
  children,
}: {
  isAdmin: boolean
  children: ReactNode
}) {
  const [directorSorties, setDirectorSorties] = useState<Sortie[]>([])
  const [loadingDirectorSorties, setLoadingDirectorSorties] = useState(!isAdmin)

  useEffect(() => {
    if (isAdmin) {
      setDirectorSorties([])
      setLoadingDirectorSorties(false)
      return
    }
    let cancelled = false
    setLoadingDirectorSorties(true)
    sortiesApi
      .listDirectorAccess()
      .then((res) => {
        if (!cancelled) {
          setDirectorSorties(res.data)
          setLoadingDirectorSorties(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDirectorSorties([])
          setLoadingDirectorSorties(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [isAdmin])

  const showSortiesNav =
    isAdmin || (!loadingDirectorSorties && directorSorties.length > 0)

  const value: SortiesAccessContextValue = {
    showSortiesNav,
    directorSorties: isAdmin ? [] : directorSorties,
    loadingDirectorSorties: isAdmin ? false : loadingDirectorSorties,
  }

  return <SortiesAccessContext.Provider value={value}>{children}</SortiesAccessContext.Provider>
}

export function useSortiesAccess() {
  return useContext(SortiesAccessContext)
}
