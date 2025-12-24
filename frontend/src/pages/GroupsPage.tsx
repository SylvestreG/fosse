import { useEffect, useState } from 'react'
import { groupsApi, Group, PermissionInfo } from '@/lib/api'
import Button from '@/components/Button'
import Toast from '@/components/Toast'

// Permissions enum (mirroring backend)
const PERMISSION_CATEGORIES = [
  { key: 'Sessions', icon: '📅' },
  { key: 'Questionnaires', icon: '📝' },
  { key: 'Utilisateurs', icon: '👥' },
  { key: 'Compétences', icon: '🎯' },
  { key: 'Emails', icon: '📧' },
  { key: 'Import', icon: '📥' },
  { key: 'Résumés', icon: '📊' },
  { key: 'Administration', icon: '⚙️' },
]

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [permissions, setPermissions] = useState<PermissionInfo[]>([])
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [editedPermissions, setEditedPermissions] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [groupsRes, permsRes] = await Promise.all([
        groupsApi.list(),
        groupsApi.listPermissions()
      ])
      setGroups(groupsRes.data)
      setPermissions(permsRes.data)
      
      // Sélectionner le premier groupe par défaut
      if (groupsRes.data.length > 0 && !selectedGroup) {
        const first = groupsRes.data[0]
        setSelectedGroup(first)
        setEditedPermissions(new Set(first.permissions))
      }
    } catch (error) {
      console.error('Error loading data:', error)
      setToast({ message: 'Erreur lors du chargement des données', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleSelectGroup = (group: Group) => {
    setSelectedGroup(group)
    setEditedPermissions(new Set(group.permissions))
  }

  const handleTogglePermission = (permKey: string) => {
    setEditedPermissions(prev => {
      const newSet = new Set(prev)
      if (newSet.has(permKey)) {
        newSet.delete(permKey)
      } else {
        newSet.add(permKey)
      }
      return newSet
    })
  }

  const handleSelectAll = (category: string) => {
    const categoryPerms = permissions.filter(p => p.category === category)
    setEditedPermissions(prev => {
      const newSet = new Set(prev)
      categoryPerms.forEach(p => newSet.add(p.key))
      return newSet
    })
  }

  const handleDeselectAll = (category: string) => {
    const categoryPerms = permissions.filter(p => p.category === category)
    setEditedPermissions(prev => {
      const newSet = new Set(prev)
      categoryPerms.forEach(p => newSet.delete(p.key))
      return newSet
    })
  }

  const handleSave = async () => {
    if (!selectedGroup) return
    
    setSaving(true)
    try {
      await groupsApi.updatePermissions(selectedGroup.id, Array.from(editedPermissions))
      setToast({ message: 'Permissions mises à jour', type: 'success' })
      loadData()
    } catch (error) {
      setToast({ message: 'Erreur lors de la sauvegarde', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const hasChanges = () => {
    if (!selectedGroup) return false
    const original = new Set(selectedGroup.permissions)
    if (original.size !== editedPermissions.size) return true
    for (const perm of editedPermissions) {
      if (!original.has(perm)) return true
    }
    return false
  }

  // Grouper les permissions par catégorie
  const permissionsByCategory = PERMISSION_CATEGORIES.map(cat => ({
    ...cat,
    permissions: permissions.filter(p => p.category === cat.key)
  })).filter(cat => cat.permissions.length > 0)

  if (loading) {
    return <div className="text-center py-12">Chargement...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">⚙️ Gestion des groupes</h1>
        <p className="text-slate-300 mt-1">Configurez les permissions pour chaque groupe d'utilisateurs</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Liste des groupes */}
        <div className="lg:col-span-1">
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow p-4">
            <h2 className="font-semibold text-white mb-4">Groupes</h2>
            <div className="space-y-2">
              {groups.map(group => (
                <button
                  key={group.id}
                  onClick={() => handleSelectGroup(group)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedGroup?.id === group.id
                      ? 'bg-blue-100 border-2 border-blue-500'
                      : 'bg-slate-700/30 border-2 border-transparent hover:bg-slate-700/50'
                  }`}
                >
                  <div className="font-medium text-white">{group.name}</div>
                  <div className="text-xs text-slate-400 mt-1">
                    {group.permissions.length} permission{group.permissions.length > 1 ? 's' : ''}
                  </div>
                  {group.description && (
                    <div className="text-xs text-gray-400 mt-1">{group.description}</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Permissions du groupe sélectionné */}
        <div className="lg:col-span-3">
          {selectedGroup ? (
            <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow">
              <div className="p-4 border-b flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-white">
                    Permissions: {selectedGroup.name}
                  </h2>
                  <p className="text-sm text-slate-400">
                    Type: <span className="font-medium">{selectedGroup.group_type}</span>
                  </p>
                </div>
                <Button 
                  onClick={handleSave} 
                  disabled={saving || !hasChanges()}
                >
                  {saving ? 'Sauvegarde...' : hasChanges() ? '💾 Sauvegarder' : 'Aucun changement'}
                </Button>
              </div>

              <div className="p-4 space-y-6">
                {permissionsByCategory.map(category => {
                  const allSelected = category.permissions.every(p => editedPermissions.has(p.key))
                  const someSelected = category.permissions.some(p => editedPermissions.has(p.key))
                  
                  return (
                    <div key={category.key} className="border rounded-lg overflow-hidden">
                      <div className="bg-slate-700/30 px-4 py-3 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{category.icon}</span>
                          <span className="font-semibold text-white">{category.key}</span>
                          <span className="text-xs text-slate-400">
                            ({category.permissions.filter(p => editedPermissions.has(p.key)).length}/{category.permissions.length})
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSelectAll(category.key)}
                            disabled={allSelected}
                            className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
                          >
                            Tout
                          </button>
                          <button
                            onClick={() => handleDeselectAll(category.key)}
                            disabled={!someSelected}
                            className="text-xs px-2 py-1 bg-slate-700/50 text-slate-200 rounded hover:bg-gray-200 disabled:opacity-50"
                          >
                            Aucun
                          </button>
                        </div>
                      </div>
                      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-2">
                        {category.permissions.map(perm => (
                          <label
                            key={perm.key}
                            className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                              editedPermissions.has(perm.key)
                                ? 'bg-green-50 hover:bg-green-100'
                                : 'bg-slate-700/30 hover:bg-slate-700/50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={editedPermissions.has(perm.key)}
                              onChange={() => handleTogglePermission(perm.key)}
                              className="w-4 h-4 rounded"
                            />
                            <div>
                              <div className="text-sm font-medium text-white">
                                {perm.description}
                              </div>
                              <div className="text-xs text-gray-400 font-mono">
                                {perm.key}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow p-12 text-center text-slate-400">
              Sélectionnez un groupe pour voir et modifier ses permissions
            </div>
          )}
        </div>
      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  )
}

