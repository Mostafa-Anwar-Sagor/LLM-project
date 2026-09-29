import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi, groupsApi, authApi } from '../../api/endpoints'
import AppLayout from '../../components/layout/AppLayout'
import {
  Plus, Edit3, UserX, UserCheck, X, Check, Users, Search, Key, Shield,
  UserCheck as UserCheckIcon, ShieldAlert, Eye, Filter, Loader, RefreshCw
} from 'lucide-react'
import toast from 'react-hot-toast'

function UserModal({ user, groups, onClose, onSuccess }) {
  const isEdit = !!user
  const [form, setForm] = useState({
    username: user?.username || '',
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email || '',
    password: '',
    role: user?.profile?.role || 'member',
    group_id: user?.profile?.group?.id || '',
  })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.username.trim()) { toast.error('Username is required'); return }
    if (!isEdit && (!form.password || form.password.length < 6)) {
      toast.error('Password is required (min 6 characters)')
      return
    }

    setSaving(true)
    const payload = { ...form, group_id: form.group_id || null }
    if (isEdit && !form.password) delete payload.password

    try {
      if (isEdit) {
        await usersApi.update(user.id, payload)
        toast.success(`User '${form.username}' updated successfully!`)
      } else {
        await usersApi.create(payload)
        toast.success(`User '${form.username}' created successfully!`)
      }
      onSuccess()
    } catch (err) {
      const errors = err.response?.data
      const msg = typeof errors === 'object'
        ? Object.entries(errors).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' | ')
        : 'Failed to save user'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 border border-dark-700 rounded-2xl w-full max-w-lg animate-slide-up">
        <div className="flex items-center justify-between p-5 border-b border-dark-700">
          <h2 className="font-semibold text-white">{isEdit ? 'Edit User Profile' : 'Create New User'}</h2>
          <button onClick={onClose} className="text-dark-400 hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Username *</label>
            <input className="input-field" value={form.username} onChange={(e) => set('username', e.target.value)} placeholder="username" />
          </div>
          <div>
            <label className="label">First Name</label>
            <input className="input-field" value={form.first_name} onChange={(e) => set('first_name', e.target.value)} placeholder="First Name" />
          </div>
          <div>
            <label className="label">Last Name</label>
            <input className="input-field" value={form.last_name} onChange={(e) => set('last_name', e.target.value)} placeholder="Last Name" />
          </div>
          <div className="col-span-2">
            <label className="label">Email Address</label>
            <input className="input-field" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="email@company.com" />
          </div>
          <div className="col-span-2">
            <label className="label">{isEdit ? 'New Password (optional — leave blank to keep)' : 'Password *'}</label>
            <input className="input-field" type="password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder={isEdit ? 'Leave blank to keep current password' : 'Minimum 6 characters'} />
          </div>
          <div>
            <label className="label">System Role</label>
            <select className="input-field" value={form.role} onChange={(e) => set('role', e.target.value)}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="label">Group & Access Level</label>
            <select className="input-field" value={form.group_id} onChange={(e) => set('group_id', e.target.value)}>
              <option value="">— No Group —</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.default_access_level === 'limited' ? 'Limited Access' : 'Full Access'})
                </option>
              ))}
            </select>
            {form.group_id && (() => {
              const selectedGrp = groups.find((g) => String(g.id) === String(form.group_id))
              const isLimited = selectedGrp?.default_access_level === 'limited'
              return (
                <div className={`mt-2 p-2 rounded-lg text-xs flex items-center gap-1.5 border ${
                  isLimited
                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/25'
                    : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${isLimited ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                  <span>
                    {isLimited
                      ? 'Limited Access: User can query AI Chatbot RAG, but cannot download raw files.'
                      : 'Full Access: User can view, download files & query AI Chatbot RAG.'}
                  </span>
                </div>
              )
            })()}
          </div>
        </div>
        <div className="flex justify-end gap-3 p-5 border-t border-dark-700">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? <Loader size={14} className="animate-spin" /> : <Check size={14} />}
            {saving ? 'Saving...' : isEdit ? 'Update Profile' : 'Create User'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ResetPasswordModal({ user, onClose }) {
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)

  const handleReset = async () => {
    if (!password || password.length < 6) {
      toast.error('Password must be at least 6 characters long')
      return
    }
    setSaving(true)
    try {
      await usersApi.resetPassword(user.id, password)
      toast.success(`Password for '${user.username}' successfully reset!`)
      onClose()
    } catch {
      toast.error('Failed to reset password')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 border border-dark-700 rounded-2xl w-full max-w-md animate-slide-up">
        <div className="flex items-center justify-between p-5 border-b border-dark-700">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <Key size={18} className="text-amber-400" /> Reset Password — {user.username}
          </h2>
          <button onClick={onClose} className="text-dark-400 hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-dark-300">
            Set a new password for <span className="text-white font-semibold">{user.first_name ? `${user.first_name} ${user.last_name}` : user.username}</span>.
          </p>
          <div>
            <label className="label">New Password *</label>
            <input
              type="password"
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              autoFocus
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 p-5 border-t border-dark-700">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleReset} disabled={saving || !password} className="btn-primary">
            {saving ? <Loader size={14} className="animate-spin" /> : <Key size={14} />}
            {saving ? 'Resetting...' : 'Reset Password'}
          </button>
        </div>
      </div>
    </div>
  )
}

function UserDetailsModal({ user, onClose }) {
  const groupObj = user.profile?.group
  const isLimited = groupObj?.default_access_level === 'limited'

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 border border-dark-700 rounded-2xl w-full max-w-md animate-slide-up">
        <div className="flex items-center justify-between p-5 border-b border-dark-700">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <Eye size={18} className="text-brand-400" /> User Profile Details
          </h2>
          <button onClick={onClose} className="text-dark-400 hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-4 p-3 bg-dark-750 border border-dark-700 rounded-xl">
            <div className="w-12 h-12 bg-brand-600 rounded-full flex items-center justify-center text-white text-lg font-bold">
              {(user.first_name?.[0] || user.username?.[0] || '?').toUpperCase()}
            </div>
            <div>
              <h3 className="font-semibold text-white text-base">
                {user.first_name ? `${user.first_name} ${user.last_name}` : user.username}
              </h3>
              <p className="text-dark-400 text-xs">{user.email || 'No email provided'}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={user.is_active ? 'badge-green' : 'badge-red'}>
                  {user.is_active ? 'Active' : 'Deactivated'}
                </span>
                <span className={user.profile?.role === 'admin' ? 'badge badge-red' : 'badge badge-gray'}>
                  {user.profile?.role || 'member'}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2 text-sm text-dark-300 bg-dark-750/50 p-3 rounded-xl border border-dark-700">
            <div className="flex justify-between py-1 border-b border-dark-700/50">
              <span className="text-dark-400">Username:</span>
              <span className="font-mono text-white">{user.username}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-dark-700/50">
              <span className="text-dark-400">Group Assignment:</span>
              <span className="text-white font-medium">{groupObj ? groupObj.name : 'No Group'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-dark-700/50">
              <span className="text-dark-400">Access Level:</span>
              <span>
                {groupObj ? (
                  <span className={isLimited ? 'text-amber-400 font-medium' : 'text-emerald-400 font-medium'}>
                    {isLimited ? '🟡 Limited Access (AI Query Only)' : '🟢 Full Access (View, Download & AI)'}
                  </span>
                ) : (
                  <span className="text-dark-500">None</span>
                )}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-dark-400">Date Joined:</span>
              <span className="text-white">{user.date_joined ? new Date(user.date_joined).toLocaleDateString() : 'N/A'}</span>
            </div>
          </div>
        </div>
        <div className="flex justify-end p-5 border-t border-dark-700">
          <button onClick={onClose} className="btn-secondary">Close</button>
        </div>
      </div>
    </div>
  )
}

export default function AdminUsers() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(null)
  const [resetUser, setResetUser] = useState(null)
  const [viewUser, setViewUser] = useState(null)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'active' | 'inactive'
  const [groupFilter, setGroupFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('')

  const { data: currentUserData } = useQuery({
    queryKey: ['me'],
    queryFn: () => authApi.me(),
    select: (r) => r.data,
  })

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['users', search, statusFilter, groupFilter, roleFilter],
    queryFn: () => usersApi.list({
      search,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      group_id: groupFilter || undefined,
      role: roleFilter || undefined,
    }),
    select: (r) => r.data,
  })

  const { data: groupsData } = useQuery({
    queryKey: ['groups'],
    queryFn: () => groupsApi.list(),
    select: (r) => r.data,
  })

  const users = usersData?.results ?? (Array.isArray(usersData) ? usersData : [])
  const groups = groupsData?.results ?? (Array.isArray(groupsData) ? groupsData : [])
  const currentUserId = currentUserData?.id

  // Statistics
  const totalUsers = users.length
  const activeCount = users.filter((u) => u.is_active).length
  const inactiveCount = users.filter((u) => !u.is_active).length
  const adminCount = users.filter((u) => u.profile?.role === 'admin').length

  const deactivateMutation = useMutation({
    mutationFn: (id) => usersApi.delete(id),
    onSuccess: (res) => {
      toast.success(res.data?.detail || 'User deactivated successfully!')
      qc.invalidateQueries(['users'])
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to deactivate user')
    },
  })

  const activateMutation = useMutation({
    mutationFn: (id) => usersApi.activate(id),
    onSuccess: (res) => {
      toast.success(res.data?.detail || 'User re-activated successfully!')
      qc.invalidateQueries(['users'])
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to activate user')
    },
  })

  const handleDeactivate = (user) => {
    if (user.id === currentUserId) {
      toast.error('You cannot deactivate your own administrative account.')
      return
    }
    if (window.confirm(`Deactivate user "${user.username}"? They will be immediately blocked from logging in.`)) {
      deactivateMutation.mutate(user.id)
    }
  }

  const refresh = () => {
    qc.invalidateQueries(['users'])
    setModal(null)
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Title Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">User Management</h1>
            <p className="text-dark-400 text-sm mt-1">
              Manage accounts, assign group access permissions, and control user statuses.
            </p>
          </div>
          <button onClick={() => setModal('create')} className="btn-primary">
            <Plus size={16} /> Add User
          </button>
        </div>

        {/* Top KPI Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-dark-400 font-medium">Total Accounts</p>
              <p className="text-2xl font-bold text-white mt-1">{totalUsers}</p>
            </div>
            <div className="w-10 h-10 bg-brand-500/15 border border-brand-500/20 rounded-xl flex items-center justify-center text-brand-400">
              <Users size={18} />
            </div>
          </div>

          <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-dark-400 font-medium">Active Users</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{activeCount}</p>
            </div>
            <div className="w-10 h-10 bg-emerald-500/15 border border-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400">
              <UserCheckIcon size={18} />
            </div>
          </div>

          <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-dark-400 font-medium">Deactivated Users</p>
              <p className="text-2xl font-bold text-red-400 mt-1">{inactiveCount}</p>
            </div>
            <div className="w-10 h-10 bg-red-500/15 border border-red-500/20 rounded-xl flex items-center justify-center text-red-400">
              <UserX size={18} />
            </div>
          </div>

          <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-dark-400 font-medium">System Admins</p>
              <p className="text-2xl font-bold text-purple-400 mt-1">{adminCount}</p>
            </div>
            <div className="w-10 h-10 bg-purple-500/15 border border-purple-500/20 rounded-xl flex items-center justify-center text-purple-400">
              <Shield size={18} />
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-72">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
            <input
              className="input-field pl-9 py-2 text-sm"
              placeholder="Search by username, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Status Filter */}
            <div className="flex items-center gap-1 bg-dark-750 border border-dark-700 rounded-lg p-1 text-xs">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  statusFilter === 'all' ? 'bg-brand-600 text-white shadow-sm' : 'text-dark-400 hover:text-white'
                }`}
              >
                All Status
              </button>
              <button
                onClick={() => setStatusFilter('active')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  statusFilter === 'active' ? 'bg-emerald-600 text-white shadow-sm' : 'text-dark-400 hover:text-white'
                }`}
              >
                Active Only
              </button>
              <button
                onClick={() => setStatusFilter('inactive')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  statusFilter === 'inactive' ? 'bg-red-600 text-white shadow-sm' : 'text-dark-400 hover:text-white'
                }`}
              >
                Deactivated
              </button>
            </div>

            {/* Group Filter */}
            <select
              className="bg-dark-750 border border-dark-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
            >
              <option value="">All Groups</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>

            {/* Role Filter */}
            <select
              className="bg-dark-750 border border-dark-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="">All Roles</option>
              <option value="admin">Admin</option>
              <option value="member">Member</option>
            </select>
          </div>
        </div>

        {/* User Table */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-700 bg-dark-750/50">
                <th className="text-left text-dark-400 font-medium px-4 py-3">User Profile</th>
                <th className="text-left text-dark-400 font-medium px-4 py-3">Group Access</th>
                <th className="text-left text-dark-400 font-medium px-4 py-3">Role</th>
                <th className="text-left text-dark-400 font-medium px-4 py-3">Account Status</th>
                <th className="text-right text-dark-400 font-medium px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={5} className="text-center py-12 text-dark-500">
                  <Loader size={20} className="animate-spin mx-auto text-brand-500 mb-2" />
                  Loading accounts...
                </td></tr>
              )}
              {!isLoading && users.length === 0 && (
                <tr><td colSpan={5} className="text-center py-12">
                  <Users size={32} className="text-dark-600 mx-auto mb-2" />
                  <p className="text-dark-400 font-medium">No users found matching your filters</p>
                </td></tr>
              )}
              {users.map((u) => {
                const groupObj = u.profile?.group
                const isLimited = groupObj?.default_access_level === 'limited'
                const isSelf = u.id === currentUserId

                return (
                  <tr key={u.id} className={`border-b border-dark-700/50 last:border-0 transition-colors ${
                    !u.is_active ? 'bg-red-500/5 hover:bg-red-500/10 opacity-75' : 'hover:bg-dark-700/30'
                  }`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-brand-700 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm">
                          {(u.first_name?.[0] || u.username?.[0] || '?').toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="text-white font-medium">
                              {u.first_name ? `${u.first_name} ${u.last_name}` : u.username}
                            </p>
                            {isSelf && (
                              <span className="text-[10px] px-1.5 py-0.2 bg-brand-500/20 text-brand-300 rounded border border-brand-500/30 font-mono">
                                You
                              </span>
                            )}
                          </div>
                          <p className="text-dark-500 text-xs font-mono">{u.email || u.username}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      {groupObj ? (
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${
                            isLimited
                              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                              : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isLimited ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                          {groupObj.name} ({isLimited ? 'Limited Access' : 'Full Access'})
                        </span>
                      ) : (
                        <span className="badge badge-gray text-xs">No Group Assigned</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <span className={u.profile?.role === 'admin' ? 'badge badge-red font-semibold' : 'badge badge-gray'}>
                        {u.profile?.role || 'member'}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <span className={u.is_active ? 'badge-green' : 'badge-red'}>
                        {u.is_active ? 'Active' : 'Deactivated'}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setViewUser(u)}
                          className="btn-ghost p-1.5 rounded-lg text-dark-400 hover:text-white"
                          title="View Details"
                        >
                          <Eye size={14} />
                        </button>

                        <button
                          onClick={() => setResetUser(u)}
                          className="btn-ghost p-1.5 rounded-lg text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                          title="Reset Password"
                        >
                          <Key size={14} />
                        </button>

                        <button
                          onClick={() => setModal(u)}
                          className="btn-ghost p-1.5 rounded-lg text-dark-300 hover:text-white"
                          title="Edit User Info"
                        >
                          <Edit3 size={14} />
                        </button>

                        {u.is_active ? (
                          <button
                            onClick={() => handleDeactivate(u)}
                            disabled={isSelf}
                            className={`btn-ghost p-1.5 rounded-lg transition-colors ${
                              isSelf
                                ? 'opacity-30 cursor-not-allowed text-dark-500'
                                : 'text-red-400 hover:bg-red-500/10 hover:text-red-300'
                            }`}
                            title={isSelf ? 'Cannot deactivate your own logged-in account' : 'Deactivate User'}
                          >
                            <UserX size={14} />
                          </button>
                        ) : (
                          <button
                            onClick={() => activateMutation.mutate(u.id)}
                            className="btn-ghost p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
                            title="Re-activate User"
                          >
                            <UserCheckIcon size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <UserModal
          user={modal === 'create' ? null : modal}
          groups={groups}
          onClose={() => setModal(null)}
          onSuccess={refresh}
        />
      )}

      {resetUser && (
        <ResetPasswordModal
          user={resetUser}
          onClose={() => setResetUser(null)}
        />
      )}

      {viewUser && (
        <UserDetailsModal
          user={viewUser}
          onClose={() => setViewUser(null)}
        />
      )}
    </AppLayout>
  )
}

