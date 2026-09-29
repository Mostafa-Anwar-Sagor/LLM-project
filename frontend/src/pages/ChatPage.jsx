import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { chatApi } from '../api/endpoints'
import { useAuth } from '../context/AuthContext'
import AppLayout from '../components/layout/AppLayout'
import MarkdownText from '../components/chat/MarkdownText'
import {
  Plus, MessageSquare, Trash2, Send, Bot, Sparkles,
  FileText, Loader2, User, ChevronRight, Zap, Shield, Clock
} from 'lucide-react'
import { format } from 'date-fns'

export default function ChatPage() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const [activeConvId, setActiveConvId] = useState(null)
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)

  const messagesEndRef = useRef(null)

  // Calculate dynamic greeting
  const hour = new Date().getHours()
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const userName = user?.first_name || user?.username || 'Executive'
  const groupName = user?.group_name || (user?.role === 'admin' ? 'Enterprise' : 'Workspace')

  // 1. Fetch conversations list
  const { data: convsData, isLoading: loadingConvs } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => chatApi.listConversations(),
    select: (r) => r.data,
  })

  const conversations = convsData || []

  // 2. Fetch active conversation messages
  const { data: activeConvData, isLoading: loadingMessages } = useQuery({
    queryKey: ['conversation', activeConvId],
    queryFn: () => chatApi.getConversation(activeConvId),
    enabled: !!activeConvId,
    select: (r) => r.data,
  })

  const currentMessages = activeConvData?.messages || []

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentMessages, loading])

  // Mutation: Create New Conversation
  const createConvMutation = useMutation({
    mutationFn: (title) => chatApi.createConversation(title || 'New Conversation'),
    onSuccess: (res) => {
      qc.invalidateQueries(['conversations'])
      setActiveConvId(res.data.id)
    },
  })

  // Mutation: Delete Conversation
  const deleteConvMutation = useMutation({
    mutationFn: (id) => chatApi.deleteConversation(id),
    onSuccess: (_, deletedId) => {
      qc.invalidateQueries(['conversations'])
      if (activeConvId === deletedId) {
        setActiveConvId(null)
      }
    },
  })

  const handleNewChat = () => {
    createConvMutation.mutate('New Conversation')
  }

  const handleSend = async (e) => {
    e?.preventDefault()
    if (!question.trim() || loading) return

    const userQ = question.trim()
    setQuestion('')
    setLoading(true)

    try {
      const res = await chatApi.send(userQ, activeConvId)
      const data = res.data

      if (!activeConvId && data.conversation_id) {
        setActiveConvId(data.conversation_id)
      }

      qc.invalidateQueries(['conversations'])
      qc.invalidateQueries(['conversation', activeConvId || data.conversation_id])
    } catch (err) {
      console.error('Send error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handlePromptClick = (promptText) => {
    setQuestion(promptText)
  }

  return (
    <AppLayout>
      <div className="flex h-full bg-dark-950 overflow-hidden">
        {/* Sidebar: Conversation Threads */}
        <div className="w-72 bg-dark-900 border-r border-dark-750 flex flex-col flex-shrink-0">
          <div className="p-4 border-b border-dark-750">
            <button
              onClick={handleNewChat}
              disabled={createConvMutation.isPending}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-medium text-sm transition-all shadow-lg shadow-brand-600/20"
            >
              <Plus size={18} />
              <span>New Conversation</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            <div className="text-xs font-semibold text-dark-400 px-3 py-1 uppercase tracking-wider">
              Recent Chats
            </div>

            {loadingConvs ? (
              <div className="flex items-center justify-center py-8 text-dark-500">
                <Loader2 size={20} className="animate-spin text-brand-400" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-8 text-dark-500 text-xs px-3">
                No previous conversations. Start a new chat above.
              </div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => setActiveConvId(conv.id)}
                  className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                    activeConvId === conv.id
                      ? 'bg-dark-800 text-white font-medium border border-dark-700'
                      : 'text-dark-300 hover:bg-dark-800/60 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate mr-2">
                    <MessageSquare size={16} className="text-brand-400 flex-shrink-0" />
                    <span className="text-xs truncate">{conv.title}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteConvMutation.mutate(conv.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-dark-400 hover:text-red-400 rounded transition-opacity"
                    title="Delete chat"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Main Chat Content Panel */}
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-dark-950">
          {/* Header */}
          <div className="px-6 py-4 bg-dark-900 border-b border-dark-750 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-500/15 border border-brand-500/30 rounded-xl flex items-center justify-center text-brand-400">
                <Bot size={22} />
              </div>
              <div>
                <h1 className="text-base font-semibold text-white flex items-center gap-2">
                  ALIIS AI Assistant
                  <span className="badge badge-green text-[10px] font-mono">Active</span>
                </h1>
                <p className="text-xs text-dark-400">
                  {activeConvData?.title || 'Interactive Document Knowledge Chat'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-dark-400 bg-dark-800 px-3 py-1.5 rounded-xl border border-dark-750">
              <Shield size={14} className="text-brand-400" />
              <span>Permission-Scoped RAG Protection</span>
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Welcome Greeting Screen if no messages */}
            {(!activeConvId || currentMessages.length === 0) && !loading && (
              <div className="max-w-2xl mx-auto py-10 text-center space-y-8 animate-fade-in">
                <div className="w-16 h-16 bg-gradient-to-tr from-brand-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-2xl shadow-brand-500/30 text-white">
                  <Sparkles size={32} />
                </div>

                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-white">
                    {timeGreeting}, {userName} 👋
                  </h2>
                  <p className="text-dark-400 text-sm max-w-lg mx-auto">
                    How can I assist you with your <span className="text-brand-400 font-semibold">{groupName}</span> documents and deliverables today?
                  </p>
                </div>

                {/* Professional Action Capability Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-left max-w-xl mx-auto">
                  <button
                    onClick={() => handlePromptClick('Summarize recent project tasks and deliverables')}
                    className="p-4 bg-dark-850 hover:bg-dark-800 border border-dark-750 hover:border-brand-500/50 rounded-2xl text-xs text-dark-200 transition-all group flex flex-col justify-between shadow-sm"
                  >
                    <span className="font-semibold text-white mb-1 group-hover:text-brand-400 flex items-center gap-1.5 text-sm">
                      <Zap size={16} className="text-amber-400" />
                      Summarize Deliverables
                    </span>
                    <span className="text-dark-400 text-xs">Extract key updates & project status</span>
                  </button>

                  <button
                    onClick={() => handlePromptClick('Who is the supervisor or team contact person?')}
                    className="p-4 bg-dark-850 hover:bg-dark-800 border border-dark-750 hover:border-brand-500/50 rounded-2xl text-xs text-dark-200 transition-all group flex flex-col justify-between shadow-sm"
                  >
                    <span className="font-semibold text-white mb-1 group-hover:text-brand-400 flex items-center gap-1.5 text-sm">
                      <User size={16} className="text-brand-400" />
                      Team & Contact Directory
                    </span>
                    <span className="text-dark-400 text-xs">Find supervisors & department leads</span>
                  </button>

                  <button
                    onClick={() => handlePromptClick('What are the core technical specs and requirements?')}
                    className="p-4 bg-dark-850 hover:bg-dark-800 border border-dark-750 hover:border-brand-500/50 rounded-2xl text-xs text-dark-200 transition-all group flex flex-col justify-between shadow-sm"
                  >
                    <span className="font-semibold text-white mb-1 group-hover:text-brand-400 flex items-center gap-1.5 text-sm">
                      <Sparkles size={16} className="text-indigo-400" />
                      Technical Specifications
                    </span>
                    <span className="text-dark-400 text-xs">Explore architecture & requirements</span>
                  </button>

                  <button
                    onClick={() => handlePromptClick('Provide an overview of accessible documents for my group')}
                    className="p-4 bg-dark-850 hover:bg-dark-800 border border-dark-750 hover:border-brand-500/50 rounded-2xl text-xs text-dark-200 transition-all group flex flex-col justify-between shadow-sm"
                  >
                    <span className="font-semibold text-white mb-1 group-hover:text-brand-400 flex items-center gap-1.5 text-sm">
                      <FileText size={16} className="text-emerald-400" />
                      Group Document Repository
                    </span>
                    <span className="text-dark-400 text-xs">Overview of documents for your group</span>
                  </button>
                </div>
              </div>
            )}

            {/* Conversation Messages */}
            {currentMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-4 max-w-3xl ${
                  msg.sender === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-semibold ${
                    msg.sender === 'user'
                      ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30'
                      : 'bg-dark-800 border border-dark-700 text-brand-400'
                  }`}
                >
                  {msg.sender === 'user' ? <User size={18} /> : <Bot size={18} />}
                </div>

                {/* Bubble */}
                <div
                  className={`rounded-2xl p-4 text-sm shadow-xl leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-brand-600 text-white rounded-tr-none'
                      : 'bg-dark-850 border border-dark-750 text-dark-100 rounded-tl-none w-full'
                  }`}
                >
                  <MarkdownText content={msg.content} />

                  {/* Sources tag */}
                  {msg.source_documents && msg.source_documents.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-dark-750 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-dark-400 font-medium mr-1">Sources:</span>
                      {msg.source_documents.map((d) => (
                        <span
                          key={d.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand-500/10 text-brand-300 border border-brand-500/20 rounded-lg text-xs font-medium"
                        >
                          <FileText size={12} />
                          {d.title}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Animated Thinking Indicator */}
            {loading && (
              <div className="flex gap-4 max-w-3xl mr-auto animate-fade-in">
                <div className="w-9 h-9 rounded-xl bg-brand-500/20 text-brand-400 border border-brand-500/30 flex items-center justify-center flex-shrink-0">
                  <Bot size={18} className="animate-spin" />
                </div>
                <div className="bg-dark-850 border border-dark-750 rounded-2xl rounded-tl-none p-4 flex items-center space-x-3 text-xs text-dark-300 shadow-xl">
                  <Loader2 size={16} className="animate-spin text-brand-400" />
                  <span className="font-medium text-dark-200">ALIIS is analyzing context & generating answer...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Chat Input Form */}
          <div className="p-4 bg-dark-900 border-t border-dark-750">
            <form onSubmit={handleSend} className="max-w-4xl mx-auto relative flex items-center">
              <input
                type="text"
                placeholder="Ask a question about your documents... (Enter to send)"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                className="w-full bg-dark-950 border border-dark-700 rounded-2xl pl-5 pr-14 py-3.5 text-sm text-white placeholder-dark-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all shadow-inner"
              />
              <button
                type="submit"
                disabled={loading || !question.trim()}
                className="absolute right-2.5 p-2.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white rounded-xl transition-all shadow-md shadow-brand-600/30"
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
