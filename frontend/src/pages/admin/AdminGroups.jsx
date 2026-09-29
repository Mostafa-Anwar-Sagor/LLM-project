import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { groupsApi } from '../../api/endpoints'
import AppLayout from '../../components/layout/AppLayout'
import { Plus, Edit3, Trash2, Check, X, Settings, Users, Shield, Loader, FileText } from 'lucide-react'
import toast from 'react-hot-toast'

function GroupModal({ group, onClose, onSuccess }) {
  const [name, setName] = useState(group?.name || '')
  const [description, setDescription] = useState(group?.description || '')
  const [defaultAccessLevel, setDefaultAccessLevel] = useState(group?.default_access_level || 'full')
  const [saving, setSaving] = useState(false)
  const isEdit = !!group

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Group name is required'); return }
    setSaving(true)
    try {
      const payload = { name, description, default_access_level: defaultAccessLevel }
      if (isEdit) {
        await groupsApi.update(group.id, payload)
        toast.success('Group updated!')
      } else {
        await groupsApi.create(payload)
        toast.success('Group created!')
      }
      onSuccess()
    } catch (err) {
      toast.error(err.response?.data?.name?.[0] || 'Failed to save group')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 border border-dark-700 rounded-2xl w-full max-w-md animate-slide-up">
        <div className="flex items-center justify-between p-5 border-b border-dark-700">
          <h2 className="font-semibold text-white">{isEdit ? 'Edit Group' : 'Create Group'}</h2>
          <button onClick={onClose} className="text-dark-400 hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="label">Group Name *</label>
            <input
              className="input-field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. IoT, Presales, Cybersecurity, Engineering"
              autoFocus
            />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              className="input-field resize-none"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description of this group"
            />
          </div>

          <div>
            <label className="label">Default Document Access Level</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDefaultAccessLevel('full')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  defaultAccessLevel === 'full'
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-white ring-1 ring-emerald-500/30'
                    : 'bg-dark-750 border-dark-700 text-dark-300 hover:border-dark-600'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Full Access
                </div>
                <p className="text-[11px] text-dark-400 mt-1 leading-tight">
                  Members can view, download, & query all documents.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setDefaultAccessLevel('limited')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  defaultAccessLevel === 'limited'
                    ? 'bg-amber-500/20 border-amber-500/50 text-white ring-1 ring-amber-500/30'
                    : 'bg-dark-750 border-dark-700 text-dark-300 hover:border-dark-600'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs text-amber-400">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  Limited Access
                </div>
                <p className="text-[11px] text-dark-400 mt-1 leading-tight">
                  Members can query AI RAG, but cannot download raw files.
                </p>
              </button>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 p-5 border-t border-dark-700">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving || !name.trim()} className="btn-primary">
            <Check size={14} />
            {saving ? 'Saving...' : isEdit ? 'Update Group' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  )
}


function GroupAccessModal({ group, onClose, onSuccess }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [docList, setDocList] = useState([])

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const res = await groupsApi.getDocuments(group.id)
        setDocList(res.data.documents || [])
      } catch {
        toast.error('Failed to load group document access settings')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [group.id])

  const setLevel = (docId, level) => {
    setDocList((prev) =>
      prev.map((d) => (d.document_id === docId ? { ...d, access_level: level } : d))
    )
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = docList.map((d) => ({
        document_id: d.document_id,
        access_level: d.access_level,
      }))
      await groupsApi.updateDocuments(group.id, payload)
      toast.success(`Document access settings updated for "${group.name}"!`)
      onSuccess()
    } catch {
      toast.error('Failed to save access settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 border border-dark-700 rounded-2xl w-full max-w-2xl animate-slide-up">
        <div className="flex items-center justify-between p-5 border-b border-dark-700">
          <div>
            <h2 className="font-semibold text-white text-lg flex items-center gap-2">
              <Shield size={18} className="text-orange-400" />
              Manage Document Access — {group.name}
            </h2>
            <p className="text-xs text-dark-400 mt-0.5">
              Control which documents members of <span className="text-white font-medium">{group.name}</span> can access.
            </p>
          </div>
          <button onClick={onClose} className="text-dark-400 hover:text-white"><X size={18} /></button>
        </div>

        <div className="p-5 max-h-[60vh] overflow-y-auto space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader size={24} className="animate-spin text-orange-500" />
            </div>
          ) : docList.length === 0 ? (
            <div className="text-center py-12 text-dark-500">
              No documents available in the system yet.
            </div>
          ) : (
            docList.map((doc) => {
              const currentLevel = doc.access_level || 'none'
              return (
                <div key={doc.document_id} className="p-3.5 bg-dark-750 border border-dark-700 rounded-xl flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate">{doc.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] font-mono uppercase px-1.5 py-0.5 rounded bg-dark-700 text-dark-300">
                        {doc.file_type || 'doc'}
                      </span>
                      <span className="text-xs text-dark-400">
                        {currentLevel === 'full' && '🟢 Full Access (View, Download & AI Query)'}
                        {currentLevel === 'limited' && '🟡 Limited Access (AI Query only)'}
                        {currentLevel === 'none' && '🔴 No Access'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setLevel(doc.document_id, 'full')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        currentLevel === 'full'
                          ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/50 shadow-sm'
                          : 'bg-dark-700 text-dark-400 hover:text-white'
                      }`}
                    >
                      Full Access
                    </button>
                    <button
                      type="button"
                      onClick={() => setLevel(doc.document_id, 'limited')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        currentLevel === 'limited'
                          ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50 shadow-sm'
                          : 'bg-dark-700 text-dark-400 hover:text-white'
                      }`}
                    >
                      Limited Access
                    </button>
                    <button
                      type="button"
                      onClick={() => setLevel(doc.document_id, 'none')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        currentLevel === 'none'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                          : 'bg-dark-700 text-dark-400 hover:text-white'
                      }`}
                    >
                      No Access
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="flex justify-end gap-3 p-5 border-t border-dark-700">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving || loading} className="btn-primary">
            {saving ? <Loader size={14} className="animate-spin" /> : <Check size={14} />}
            Save Access Settings
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminGroups() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(null) // null | 'create' | group object
  const [accessModalGroup, setAccessModalGroup] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: () => groupsApi.list(),
    select: (r) => r.data,
  })

  const groups = data?.results ?? (Array.isArray(data) ? data : [])

  const deleteMutation = useMutation({
    mutationFn: (id) => groupsApi.delete(id),
    onSuccess: () => {
      toast.success('Group deleted')
      qc.invalidateQueries(['groups'])
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Cannot delete — group may have members')
    },
  })

  const handleDelete = (group) => {
    if (window.confirm(`Delete group "${group.name}"? Users in this group will lose their assignment.`)) {
      deleteMutation.mutate(group.id)
    }
  }

  const refresh = () => {
    qc.invalidateQueries(['groups'])
    setModal(null)
    setAccessModalGroup(null)
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Group Management</h1>
            <p className="text-dark-400 text-sm mt-1">
              Create user groups and configure document access permissions (Full vs Limited).
            </p>
          </div>
          <button onClick={() => setModal('create')} className="btn-primary">
            <Plus size={16} /> New Group
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-20">
            <Settings size={48} className="text-dark-600 mx-auto mb-4" />
            <h3 className="text-dark-300 font-medium">No groups yet</h3>
            <p className="text-dark-500 text-sm mt-1 mb-4">
              Create your first group (e.g. IoT, Presales) to start controlling document access.
            </p>
            <button onClick={() => setModal('create')} className="btn-primary">
              <Plus size={16} /> Create First Group
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groups.map((group) => (
              <div key={group.id} className="card hover:border-dark-600 transition-all flex flex-col justify-between p-5">
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-500/15 border border-purple-500/20 rounded-xl flex items-center justify-center">
                        <Settings size={18} className="text-purple-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-white text-base">{group.name}</h3>
                          <span
                            className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                              group.default_access_level === 'limited'
                                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            }`}
                          >
                            {group.default_access_level === 'limited' ? 'Limited Access' : 'Full Access'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-dark-400 mt-1">
                          <span className="flex items-center gap-1">
                            <Users size={11} />
                            {group.member_count} member{group.member_count !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>

                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setModal(group)}
                        className="btn-ghost p-1.5 rounded-lg text-dark-300 hover:text-white"
                        title="Edit Group Info"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(group)}
                        className="btn-ghost p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        title="Delete Group"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {group.description && (
                    <p className="text-dark-400 text-sm mt-3">{group.description}</p>
                  )}

                  {/* Access statistics */}
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-dark-750 text-xs">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      {group.full_access_count || 0} Full Access
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/20 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      {group.limited_access_count || 0} Limited Access
                    </span>
                  </div>
                </div>

                <div className="mt-4">
                  <button
                    onClick={() => setAccessModalGroup(group)}
                    className="w-full btn-secondary text-xs py-2 flex items-center justify-center gap-1.5 bg-dark-750 hover:bg-dark-700 hover:text-orange-400 border-dark-700 transition-colors"
                  >
                    <Shield size={13} className="text-orange-400" />
                    Manage Document Access
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal && (
        <GroupModal
          group={modal === 'create' ? null : modal}
          onClose={() => setModal(null)}
          onSuccess={refresh}
        />
      )}

      {accessModalGroup && (
        <GroupAccessModal
          group={accessModalGroup}
          onClose={() => setAccessModalGroup(null)}
          onSuccess={refresh}
        />
      )}
    </AppLayout>
  )
}

