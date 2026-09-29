import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  Bot, MessageSquare, FileText, LayoutDashboard,
  Users, FolderOpen, Settings, LogOut, ChevronRight,
  Shield
} from 'lucide-react'

export default function Sidebar() {
  const { user, logout, isAdmin } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const memberLinks = [
    { to: '/chat', icon: MessageSquare, label: 'Chat' },
    { to: '/documents', icon: FileText, label: 'Documents' },
  ]

  const adminLinks = [
    { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
    { to: '/admin/documents', icon: FolderOpen, label: 'Documents' },
    { to: '/admin/groups', icon: Settings, label: 'Groups' },
    { to: '/admin/users', icon: Users, label: 'Users' },
  ]

  return (
    <aside className="w-64 bg-dark-900 border-r border-dark-700 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="p-5 border-b border-dark-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-brand-600 rounded-lg flex items-center justify-center">
            <Bot size={20} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-white text-sm leading-tight">ALIIS</p>
            <p className="text-dark-500 text-xs">AI Knowledge System</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 overflow-y-auto space-y-1">
        {/* Member section */}
        <div className="mb-4">
          <p className="text-dark-500 text-xs font-medium px-3 mb-2 uppercase tracking-wider">
            Workspace
          </p>
          {memberLinks.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''}`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </div>

        {/* Admin section */}
        {isAdmin && (
          <div>
            <p className="text-dark-500 text-xs font-medium px-3 mb-2 uppercase tracking-wider flex items-center gap-1.5">
              <Shield size={10} />
              Admin Panel
            </p>
            {adminLinks.map(({ to, icon: Icon, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? 'active' : ''}`
                }
              >
                <Icon size={16} />
                {label}
              </NavLink>
            ))}
          </div>
        )}
      </nav>

      {/* User profile footer */}
      <div className="p-3 border-t border-dark-700">
        <div className="flex items-center gap-3 p-2 rounded-lg">
          <div className="w-8 h-8 bg-brand-700 rounded-full flex items-center justify-center text-white text-xs font-bold">
            {(user?.first_name?.[0] || user?.username?.[0] || '?').toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {user?.first_name ? `${user.first_name} ${user.last_name}` : user?.username}
            </p>
            <p className="text-xs text-dark-400 truncate">
              {user?.group?.name || (isAdmin ? 'Administrator' : 'No group')}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="text-dark-500 hover:text-red-400 transition-colors p-1"
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  )
}
