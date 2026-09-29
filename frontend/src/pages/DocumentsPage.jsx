import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { documentsApi } from '../api/endpoints'
import AppLayout from '../components/layout/AppLayout'
import DocumentViewerModal from '../components/documents/DocumentViewerModal'
import {
  FileText, Search, Download, Eye, Clock, CheckCircle,
  XCircle, Loader, Filter
} from 'lucide-react'
import { format } from 'date-fns'

function StatusBadge({ status }) {
  if (status === 'ready') return <span className="badge-green"><CheckCircle size={10} className="mr-1" />Ready</span>
  if (status === 'processing') return <span className="badge-yellow"><Loader size={10} className="mr-1 animate-spin" />Processing</span>
  if (status === 'failed') return <span className="badge-red"><XCircle size={10} className="mr-1" />Failed</span>
  return <span className="badge-gray">{status}</span>
}

function DocumentCard({ doc, onView }) {
  return (
    <div className="card hover:border-dark-600 transition-all duration-200 group">
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="w-10 h-10 bg-brand-500/15 border border-brand-500/20 rounded-lg 
                        flex items-center justify-center flex-shrink-0 group-hover:bg-brand-500/25 
                        transition-colors">
          <FileText size={18} className="text-brand-400" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-medium text-white truncate">{doc.title}</h3>
            <StatusBadge status={doc.status} />
          </div>

          {doc.description && (
            <p className="text-dark-400 text-sm mt-1 line-clamp-2">{doc.description}</p>
          )}

          <div className="flex items-center gap-4 mt-3 text-xs text-dark-500">
            <span className="flex items-center gap-1">
              <Clock size={11} />
              {doc.uploaded_at ? format(new Date(doc.uploaded_at), 'MMM d, yyyy') : 'Recently'}
            </span>
            <span className="uppercase font-medium text-dark-400">
              {doc.file_type || 'file'}
            </span>
            {doc.chunk_count > 0 && (
              <span>{doc.chunk_count} chunks</span>
            )}
          </div>

          {/* Group access badges */}
          <div className="flex items-center flex-wrap gap-2 mt-2">
            <span className="text-xs text-dark-500 font-medium">Groups:</span>
            {doc.group_accesses && doc.group_accesses.length > 0 ? (
              doc.group_accesses.map((ga) => (
                <span key={ga.id} className="badge badge-blue text-xs font-medium">
                  {ga.group_name}
                </span>
              ))
            ) : (
              <span className="badge badge-gray text-xs">All Groups</span>
            )}
            <span className="badge badge-green text-xs font-medium">
              ✓ Granted
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => onView(doc.id)}
            className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1.5 rounded-lg"
            title="View Document In-App"
          >
            <Eye size={14} />
            <span>View</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DocumentsPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [activeDocId, setActiveDocId] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['documents', search, statusFilter],
    queryFn: () => documentsApi.list({ search, status: statusFilter || undefined }),
    select: (res) => res.data,
  })

  const documents = data?.results || data || []

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Documents</h1>
          <p className="text-dark-400 text-sm mt-1">
            Documents your group has access to
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
            <input
              type="text"
              placeholder="Search documents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-dark-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-field w-auto"
            >
              <option value="">All Status</option>
              <option value="ready">Ready</option>
              <option value="processing">Processing</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        {/* Document list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
          </div>
        ) : documents.length === 0 ? (
          <div className="card text-center py-16">
            <div className="w-12 h-12 bg-dark-700 rounded-full flex items-center justify-center mx-auto mb-4 text-dark-400">
              <FileText size={24} />
            </div>
            <h3 className="text-white font-medium text-base mb-1">No documents found</h3>
            <p className="text-dark-400 text-sm max-w-sm mx-auto">
              {search || statusFilter
                ? 'No documents match your search filters.'
                : 'No documents are accessible to your group yet.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} onView={setActiveDocId} />
            ))}
          </div>
        )}
      </div>

      {/* In-App Document Viewer Modal */}
      {activeDocId && (
        <DocumentViewerModal
          documentId={activeDocId}
          onClose={() => setActiveDocId(null)}
        />
      )}
    </AppLayout>
  )
}
