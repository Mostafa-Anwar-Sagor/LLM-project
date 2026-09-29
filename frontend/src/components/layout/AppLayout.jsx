import Sidebar from './Sidebar'
import FloatingChatWidget from '../chat/FloatingChatWidget'

export default function AppLayout({ children }) {
  return (
    <div className="flex h-screen overflow-hidden bg-dark-950 relative">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
      <FloatingChatWidget />
    </div>
  )
}
