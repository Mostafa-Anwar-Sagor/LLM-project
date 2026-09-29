import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { MessageSquare, X, Send, Bot, Sparkles, Loader2, FileText, Plus, ChevronRight } from 'lucide-react'
import { chatApi } from '../../api/endpoints'
import MarkdownText from './MarkdownText'

export default function FloatingChatWidget() {
  const location = useLocation()
  const [isOpen, setIsOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)

  // Do NOT render floating chatbot button if user is already on the dedicated Chat Page
  if (location.pathname.startsWith('/chat')) {
    return null
  }

  const [messages, setMessages] = useState([
    {
      sender: 'assistant',
      content: 'Hello! I am **ALIIS**, your enterprise AI assistant. Ask me anything about your documents, tasks, or projects.',
      source_documents: [],
    },
  ])

  const chatEndRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen, loading])

  const handleSend = async (e) => {
    e?.preventDefault()
    if (!question.trim() || loading) return

    const userQ = question.trim()
    setQuestion('')

    // Append user message
    setMessages((prev) => [
      ...prev,
      { sender: 'user', content: userQ, source_documents: [] },
    ])

    setLoading(true)

    try {
      const res = await chatApi.send(userQ)
      const data = res.data

      setMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          content: data.answer,
          source_documents: data.source_documents || [],
          chunks_retrieved: data.chunks_retrieved,
        },
      ])
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          content: 'I encountered an issue processing your request. Please try again.',
          source_documents: [],
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleChipClick = (promptText) => {
    setQuestion(promptText)
  }

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 p-4 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white rounded-full shadow-2xl shadow-brand-600/40 flex items-center justify-center transition-all duration-300 transform hover:scale-105 group"
        title="Chat with ALIIS AI Assistant"
      >
        <div className="relative">
          {isOpen ? <X size={24} /> : <Bot size={26} className="animate-pulse" />}
          {!isOpen && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          )}
        </div>
      </button>

      {/* Floating Popup Modal Drawer */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-[92vw] max-w-[420px] h-[580px] bg-dark-800 border border-dark-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
          {/* Widget Header */}
          <div className="px-5 py-4 bg-dark-850 border-b border-dark-700 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 bg-brand-500/20 border border-brand-500/30 rounded-xl flex items-center justify-center text-brand-400">
                <Sparkles size={18} />
              </div>
              <div>
                <h3 className="font-semibold text-white text-sm flex items-center gap-1.5">
                  ALIIS Assistant
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                </h3>
                <p className="text-xs text-dark-400">Enterprise Knowledge AI</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-dark-400 hover:text-white p-1 rounded-lg hover:bg-dark-700"
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages Container */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-dark-900">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${
                  msg.sender === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.sender === 'assistant' && (
                  <div className="w-7 h-7 bg-brand-500/20 text-brand-400 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot size={15} />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl p-3.5 text-sm shadow-md ${
                    msg.sender === 'user'
                      ? 'bg-brand-600 text-white rounded-tr-none'
                      : 'bg-dark-800 border border-dark-700 text-dark-100 rounded-tl-none'
                  }`}
                >
                  <MarkdownText content={msg.content} />

                  {/* Sources tag */}
                  {msg.source_documents && msg.source_documents.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-dark-700/60 flex flex-wrap gap-1">
                      {msg.source_documents.map((d) => (
                        <span
                          key={d.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-500/10 text-brand-300 border border-brand-500/20 rounded-md text-[11px]"
                        >
                          <FileText size={10} />
                          {d.title}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Thinking / Processing State */}
            {loading && (
              <div className="flex gap-3 justify-start animate-fade-in">
                <div className="w-7 h-7 bg-brand-500/20 text-brand-400 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Bot size={15} className="animate-spin" />
                </div>
                <div className="bg-dark-800 border border-dark-700 rounded-2xl rounded-tl-none p-3.5 flex items-center space-x-2 text-xs text-dark-300">
                  <Loader2 size={14} className="animate-spin text-brand-400" />
                  <span>ALIIS is analyzing documents...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Prompt Chips */}
          {messages.length <= 2 && !loading && (
            <div className="px-4 py-2 bg-dark-850 border-t border-dark-700/50 flex flex-wrap gap-1.5">
              <button
                onClick={() => handleChipClick('What are my tasks for this week?')}
                className="text-[11px] bg-dark-700 hover:bg-dark-600 text-dark-200 px-2.5 py-1 rounded-full transition-colors flex items-center gap-1"
              >
                <span>Task overview</span>
                <ChevronRight size={10} />
              </button>
              <button
                onClick={() => handleChipClick('Who is my supervisor?')}
                className="text-[11px] bg-dark-700 hover:bg-dark-600 text-dark-200 px-2.5 py-1 rounded-full transition-colors flex items-center gap-1"
              >
                <span>Supervisor info</span>
                <ChevronRight size={10} />
              </button>
            </div>
          )}

          {/* Input Bar */}
          <form onSubmit={handleSend} className="p-3 bg-dark-850 border-t border-dark-700 flex items-center space-x-2">
            <input
              type="text"
              placeholder="Ask ALIIS..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="flex-1 bg-dark-900 border border-dark-600 rounded-xl px-3.5 py-2 text-sm text-white placeholder-dark-500 focus:outline-none focus:border-brand-500"
            />
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="p-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-xl transition-colors"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  )
}
