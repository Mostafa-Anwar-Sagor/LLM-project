import { useQuery } from '@tanstack/react-query'
import { documentsApi, usersApi, groupsApi, chatApi } from '../../api/endpoints'
import AppLayout from '../../components/layout/AppLayout'
import { FileText, Users, Settings, MessageSquare, TrendingUp, Clock } from 'lucide-react'
import { format } from 'date-fns'

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="card flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-dark-400 text-sm">{label}</p>
        <p className="text-2xl font-bold text-white">{value ?? '—'}</p>
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const { data: docs } = useQuery({
    queryKey: ['admin-docs'],
    queryFn: () => documentsApi.list({ page_size: 5 }),
    select: (r) => r.data,
  })
  const { data: users } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => usersApi.list(),
    select: (r) => r.data,
  })
  const { data: groups } = useQuery({
    queryKey: ['admin-groups'],
    queryFn: () => groupsApi.list(),
    select: (r) => r.data,
  })
  const { data: chats } = useQuery({
    queryKey: ['admin-chats'],
    queryFn: () => chatApi.history({ page_size: 5 }),
    select: (r) => r.data,
  })

  const docCount = docs?.count ?? (Array.isArray(docs) ? docs.length : 0)
  const userCount = users?.count ?? (Array.isArray(users) ? users.length : 0)
  const groupCount = groups?.count ?? (Array.isArray(groups) ? groups.length : 0)
  const chatCount = chats?.count ?? (Array.isArray(chats) ? chats.length : 0)

  const recentDocs = docs?.results ?? (Array.isArray(docs) ? docs.slice(0, 5) : [])
  const recentChats = chats?.results ?? (Array.isArray(chats) ? chats.slice(0, 5) : [])

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-dark-400 text-sm mt-1">System overview and recent activity</p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard icon={FileText} label="Documents" value={docCount} color="bg-brand-600" />
          <StatCard icon={Users} label="Users" value={userCount} color="bg-emerald-600" />
          <StatCard icon={Settings} label="Groups" value={groupCount} color="bg-purple-600" />
          <StatCard icon={MessageSquare} label="Chat Logs" value={chatCount} color="bg-amber-600" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Documents */}
          <div className="card">
            <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
              <FileText size={16} className="text-brand-400" />
              Recent Documents
            </h2>
            <div className="space-y-3">
              {recentDocs.length === 0 && (
                <p className="text-dark-500 text-sm">No documents yet.</p>
              )}
              {recentDocs.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 py-2 border-b border-dark-700 last:border-0">
                  <div className="w-8 h-8 bg-brand-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText size={14} className="text-brand-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{doc.title}</p>
                    <p className="text-xs text-dark-500 flex items-center gap-1">
                      <Clock size={10} />
                      {format(new Date(doc.uploaded_at), 'MMM d, HH:mm')}
                    </p>
                  </div>
                  <span className={`badge text-xs ${
                    doc.status === 'ready' ? 'badge-green' :
                    doc.status === 'processing' ? 'badge-yellow' : 'badge-red'
                  }`}>
                    {doc.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Chat Activity */}
          <div className="card">
            <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
              <MessageSquare size={16} className="text-amber-400" />
              Recent Conversations
            </h2>
            <div className="space-y-3">
              {recentChats.length === 0 && (
                <p className="text-dark-500 text-sm">No conversations yet.</p>
              )}
              {recentChats.map((chat) => (
                <div key={chat.id} className="py-2 border-b border-dark-700 last:border-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-brand-400">{chat.username}</span>
                    <span className="text-xs text-dark-600">
                      {format(new Date(chat.timestamp), 'MMM d, HH:mm')}
                    </span>
                    {chat.was_out_of_scope && (
                      <span className="badge badge-yellow text-xs">Out of scope</span>
                    )}
                  </div>
                  <p className="text-sm text-dark-300 truncate">{chat.question}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
