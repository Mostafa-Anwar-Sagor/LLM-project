import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { documentsApi, groupsApi } from '../../api/endpoints'
import AppLayout from '../../components/layout/AppLayout'
import DocumentViewerModal from '../../components/documents/DocumentViewerModal'
import { useDropzone } from 'react-dropzone'
import {
  Upload, FileText, Trash2, Edit3, Check, X, Loader,
  CheckCircle, XCircle, RefreshCw, Search, Eye, Plus
} from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

function StatusBadge({ status }) {
  if (status === 'ready') return <span className="badge-green flex items-center gap-1"><CheckCircle size={10} />Ready</span>
  if (status === 'processing') return <span className="badge-yellow flex items-center gap-1"><Loader size={10} className="animate-spin" />Processing</span>
  if (status === 'failed') return <span className="badge-red flex items-center gap-1"><XCircle size={10} />Failed</span>
  return <span className="badge-gray">{status}</span>
}

function UploadModal({ groups, onClose, onSuccess }) {
  const [file, setFile] = useState(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  // Map of group_id -> 'full' | 'limited' | 'none'
  const [groupAccessMap, setGroupAccessMap] = useState({})
  const [uploading, setUploading] = useState(false)

  const onDrop = useCallback((accepted) => {
    if (accepted[0]) {
      setFile(accepted[0])
      if (!title) setTitle(accepted[0].name.replace(/\.[^.]+$/, ''))
    }
  }, [title])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
  })

  const setGroupLevel = (groupId, level) => {
    setGroupAccessMap((prev) => ({
      ...prev,
      [groupId]: prev[groupId] === level ? 'none' : level,
    }))
  }

  const handleUpload = async () => {
    if (!file || !title.trim()) {
      toast.error('File and title are required')
      return
    }
    setUploading(true)
    const fd = new FormData()

    let fileToUpload = file
    if (file.name.length > 80) {
      const lastDot = file.name.lastIndexOf('.')
      const ext = lastDot !== -1 ? file.name.slice(lastDot) : ''
      const base = lastDot !== -1 ? file.name.slice(0, lastDot) : file.name
      const newName = `${base.slice(0, 75)}${ext}`
      fileToUpload = new File([file], newName, { type: file.type })
    }

    fd.append('file', fileToUpload)
    fd.append('title', title)
    fd.append('description', description)

    // Append group_ids for selected groups
    Object.entries(groupAccessMap).forEach(([gid, level]) => {
      if (level !== 'none') {
        fd.append('group_ids', gid)
      }
    })

    try {
      await documentsApi.upload(fd)
      toast.success('Document uploaded! Ingestion started automatically.')
      onSuccess()
    } catch (err) {
      const data = err.response?.data
      const msg = typeof data === 'object'
        ? Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' | ')
        : (err.response?.data?.detail || 'Upload failed')
      toast.error(msg || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 border border-dark-700 rounded-2xl w-full max-w-lg animate-slide-up">
        <div className="flex items-center justify-between p-5 border-b border-dark-700">
          <h2 className="font-semibold text-white">Upload Document</h2>
          <button onClick={onClose} className="text-dark-400 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {/* Drop zone */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-brand-500 bg-brand-500/10'
                : 'border-dark-600 hover:border-dark-500'
            }`}
          >
            <input {...getInputProps()} />
            <Upload size={24} className="mx-auto text-dark-400 mb-2" />
            {file ? (
              <p className="text-white text-sm font-medium">{file.name}</p>
            ) : (
              <>
                <p className="text-dark-300 text-sm">Drop a file here or click to browse</p>
                <p className="text-dark-500 text-xs mt-1">PDF, Word, Excel, CSV, PowerPoint, Text, MD supported</p>
              </>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="label">Title *</label>
            <input
              className="input-field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Document title"
            />
          </div>

          {/* Description */}
          <div>
            <label className="label">Description</label>
            <textarea
              className="input-field resize-none"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
            />
          </div>

          {/* Group access selection */}
          <div>
            <label className="label">Assign Group Access</label>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {groups.map((g) => {
                const level = groupAccessMap[g.id] || 'none'
                return (
                  <div key={g.id} className="flex items-center justify-between p-2.5 bg-dark-750 border border-dark-700 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-white">{g.name}</p>
                      {g.description && <p className="text-xs text-dark-400">{g.description}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setGroupLevel(g.id, 'full')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                          level === 'full'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : 'bg-dark-700 text-dark-400 hover:text-white'
                        }`}
                      >
                        Full Access
                      </button>
                      <button
                        type="button"
                        onClick={() => setGroupLevel(g.id, 'limited')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                          level === 'limited'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                            : 'bg-dark-700 text-dark-400 hover:text-white'
                        }`}
                      >
                        Limited Access
                      </button>
                    </div>
                  </div>
                )
              })}
              {groups.length === 0 && (
                <p className="text-dark-500 text-sm">No groups created yet</p>
              )}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 p-5 border-t border-dark-700">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={handleUpload}
            disabled={uploading || !file}
            className="btn-primary"
          >
            {uploading ? <Loader size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploading ? 'Uploading...' : 'Upload & Ingest'}
          </button>
        </div>
      </div>
    </div>
  )
}

function EditAccessModal({ doc, groups, onClose, onSuccess }) {
  // Map of group_id -> 'full' | 'limited' | 'none'
  const [groupAccessMap, setGroupAccessMap] = useState(() => {
    const map = {}
    groups.forEach((g) => {
      const existing = doc.group_accesses?.find((ga) => ga.group === g.id)
      map[g.id] = existing ? (existing.access_level || 'full') : 'none'
    })
    return map
  })
  const [saving, setSaving] = useState(false)

  const setGroupLevel = (groupId, level) => {
    setGroupAccessMap((prev) => ({
      ...prev,
      [groupId]: level,
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const group_accesses_input = Object.entries(groupAccessMap).map(([gid, level]) => ({
        group_id: Number(gid),
        access_level: level,
      }))
      await documentsApi.update(doc.id, { group_accesses_input })
      toast.success('Group access settings updated!')
      onSuccess()
    } catch {
      toast.error('Failed to update access settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 border border-dark-700 rounded-2xl w-full max-w-lg animate-slide-up">
        <div className="flex items-center justify-between p-5 border-b border-dark-700">
          <h2 className="font-semibold text-white">Configure Group Access</h2>
          <button onClick={onClose} className="text-dark-400 hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-dark-400">
            Document: <span className="text-white font-medium">{doc.title}</span>
          </p>

          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {groups.map((g) => {
              const currentLevel = groupAccessMap[g.id] || 'none'
              return (
                <div key={g.id} className="p-3 bg-dark-750 border border-dark-700 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">{g.name}</p>
                    <p className="text-xs text-dark-400 mt-0.5">
                      {currentLevel === 'full' && '🟢 Full Access (View, Download, Chat Query)'}
                      {currentLevel === 'limited' && '🟡 Limited Access (Chat Query only)'}
                      {currentLevel === 'none' && '🔴 No Access'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setGroupLevel(g.id, 'full')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                        currentLevel === 'full'
                          ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/50 shadow-sm'
                          : 'bg-dark-700 text-dark-400 hover:text-white'
                      }`}
                    >
                      Full Access
                    </button>
                    <button
                      type="button"
                      onClick={() => setGroupLevel(g.id, 'limited')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                        currentLevel === 'limited'
                          ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50 shadow-sm'
                          : 'bg-dark-700 text-dark-400 hover:text-white'
                      }`}
                    >
                      Limited Access
                    </button>
                    <button
                      type="button"
                      onClick={() => setGroupLevel(g.id, 'none')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
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
            })}
            {groups.length === 0 && (
              <p className="text-dark-500 text-sm">No user groups exist yet.</p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-3 p-5 border-t border-dark-700">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? <Loader size={14} className="animate-spin" /> : <Check size={14} />}
            Save Access Settings
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminDocuments() {
  const qc = useQueryClient()
  const [showUpload, setShowUpload] = useState(false)
  const [editDoc, setEditDoc] = useState(null)
  const [activeViewDocId, setActiveViewDocId] = useState(null)
  const [search, setSearch] = useState('')

  const { data: docsData, isLoading } = useQuery({
    queryKey: ['admin-documents', search],
    queryFn: () => documentsApi.list({ search }),
    select: (r) => r.data,
    refetchInterval: 5000,
  })

  const { data: groupsData } = useQuery({
    queryKey: ['groups'],
    queryFn: () => groupsApi.list(),
    select: (r) => r.data,
  })

  const documents = docsData?.results ?? (Array.isArray(docsData) ? docsData : [])
  const groups = groupsData?.results ?? (Array.isArray(groupsData) ? groupsData : [])

  const deleteMutation = useMutation({
    mutationFn: (id) => documentsApi.delete(id),
    onSuccess: () => {
      toast.success('Document deleted')
      qc.invalidateQueries(['admin-documents'])
    },
    onError: () => toast.error('Failed to delete'),
  })

  const handleDelete = (doc) => {
    if (window.confirm(`Delete "${doc.title}"? This cannot be undone.`)) {
      deleteMutation.mutate(doc.id)
    }
  }

  const refresh = () => {
    qc.invalidateQueries(['admin-documents'])
    setShowUpload(false)
    setEditDoc(null)
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Document Management</h1>
            <p className="text-dark-400 text-sm mt-1">Upload, manage, and control access to documents</p>
          </div>
          <button onClick={() => setShowUpload(true)} className="btn-primary">
            <Plus size={16} /> Upload Document
          </button>
        </div>

        {/* Search */}
        <div className="relative max-w-sm mb-6">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
          <input
            className="input-field pl-9"
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Table */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-700">
                <th className="text-left text-dark-400 font-medium px-4 py-3">Document</th>
                <th className="text-left text-dark-400 font-medium px-4 py-3">Group Access</th>
                <th className="text-left text-dark-400 font-medium px-4 py-3">Status</th>
                <th className="text-left text-dark-400 font-medium px-4 py-3">Uploaded</th>
                <th className="text-right text-dark-400 font-medium px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={5} className="text-center py-12 text-dark-500">
                  <Loader size={20} className="animate-spin mx-auto" />
                </td></tr>
              )}
              {!isLoading && documents.length === 0 && (
                <tr><td colSpan={5} className="text-center py-12 text-dark-500">
                  No documents found. Upload one to get started.
                </td></tr>
              )}
              {documents.map((doc) => (
                <tr key={doc.id} className="border-b border-dark-700/50 last:border-0 hover:bg-dark-700/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <FileText size={16} className="text-brand-400 flex-shrink-0" />
                      <div>
                        <p className="text-white font-medium">{doc.title}</p>
                        {doc.description && (
                          <p className="text-dark-500 text-xs truncate max-w-xs">{doc.description}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {doc.group_accesses?.map((ga) => {
                        const isFull = (ga.access_level || 'full') === 'full'
                        return (
                          <span
                            key={ga.id}
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium border ${
                              isFull
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isFull ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                            {ga.group_name} ({isFull ? 'Full' : 'Limited'})
                          </span>
                        )
                      })}
                      {(!doc.group_accesses || doc.group_accesses.length === 0) && (
                        <span className="badge badge-gray text-xs">All Groups (Full)</span>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <StatusBadge status={doc.status} />
                    {doc.chunk_count > 0 && (
                      <p className="text-xs text-dark-500 mt-1">{doc.chunk_count} chunks</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-dark-400 text-xs">
                    {format(new Date(doc.uploaded_at), 'MMM d, yyyy')}
                    <br />{doc.uploaded_by_name}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setActiveViewDocId(doc.id)}
                        className="btn-ghost p-1.5 rounded-lg text-dark-300 hover:text-white"
                        title="View Document In-App"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        onClick={() => setEditDoc(doc)}
                        className="btn-ghost p-1.5 rounded-lg"
                        title="Edit group access"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(doc)}
                        className="btn-ghost p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showUpload && (
        <UploadModal groups={groups} onClose={() => setShowUpload(false)} onSuccess={refresh} />
      )}
      {editDoc && (
        <EditAccessModal doc={editDoc} groups={groups} onClose={() => setEditDoc(null)} onSuccess={refresh} />
      )}
      {activeViewDocId && (
        <DocumentViewerModal documentId={activeViewDocId} onClose={() => setActiveViewDocId(null)} />
      )}
    </AppLayout>
  )
}
