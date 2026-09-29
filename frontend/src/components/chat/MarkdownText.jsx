import React from 'react'

export default function MarkdownText({ content }) {
  if (!content) return null

  // Split by double newline blocks (\n\n) for Gemini-style paragraphs/cards
  const blocks = content.split(/\n\s*\n/)

  const renderInline = (rawText) => {
    if (!rawText) return null
    const parts = rawText.split(/(\*\*.*?\*\*)/g)
    return parts.map((part, pIdx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const inner = part.slice(2, -2)
        return (
          <strong key={pIdx} className="font-semibold text-white">
            {inner}
          </strong>
        )
      }
      return part
    })
  }

  return (
    <div className="space-y-3 font-sans leading-relaxed text-sm">
      {blocks.map((block, bIdx) => {
        const lines = block.split('\n').map((l) => l.trim()).filter(Boolean)
        if (lines.length === 0) return null

        return (
          <div key={bIdx} className="space-y-1">
            {lines.map((line, lIdx) => {
              // Bullet item
              if (line.startsWith('• ') || line.startsWith('- ')) {
                const bulletText = line.slice(2)
                return (
                  <div key={lIdx} className="flex items-start space-x-2 my-1 text-dark-100">
                    <span className="text-brand-400 font-bold select-none text-base mt-0.5">•</span>
                    <div className="flex-1 leading-relaxed">{renderInline(bulletText)}</div>
                  </div>
                )
              }

              // Bold Header line
              if ((line.startsWith('**') && line.includes('**')) || line.startsWith('#')) {
                return (
                  <div key={lIdx} className="font-semibold text-white mt-1 mb-1 text-sm flex items-center gap-1.5">
                    <span className="w-1.5 h-3.5 bg-brand-500 rounded-full inline-block" />
                    <span>{renderInline(line)}</span>
                  </div>
                )
              }

              // Regular text / indented body
              return (
                <div key={lIdx} className="text-dark-200 pl-4 text-xs sm:text-sm leading-normal">
                  {renderInline(line)}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
