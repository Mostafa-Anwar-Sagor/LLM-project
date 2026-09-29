import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen">
    <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
  </div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

export function RequireAdmin({ children }) {
  const { user, loading, isAdmin } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/chat" replace />
  return children
}
