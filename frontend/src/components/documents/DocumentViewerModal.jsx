import { useState, useEffect, useRef } from 'react'
import {
  X, Download, FileText, AlertCircle, Loader2, FileSpreadsheet,
  Presentation, ChevronLeft, ChevronRight, LayoutGrid,
  ZoomIn, ZoomOut, RotateCcw
} from 'lucide-react'
import api from '../../api/client'
import { documentsApi } from '../../api/endpoints'

import { renderAsync as renderDocx } from 'docx-preview'
import * as XLSX from 'xlsx'
import mammoth from 'mammoth'

export default function DocumentViewerModal({ documentId, onClose }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [docDetail, setDocDetail] = useState(null)
  const [blobUrl, setBlobUrl] = useState(null)
  const [fileBlob, setFileBlob] = useState(null)
  const [textContent, setTextContent] = useState('')
  const [sheets, setSheets] = useState([])
  const [activeSheetIdx, setActiveSheetIdx] = useState(0)

  // PPTX Slide Image States
  const [slides, setSlides] = useState([])       // [{slide_number, image (data URL)}]
  const [slidesLoading, setSlidesLoading] = useState(false)
  const [slidesError, setSlidesError] = useState(null)
  const [activeSlideIdx, setActiveSlideIdx] = useState(0)
  const [isGridMode, setIsGridMode] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(100)
  const [panX, setPanX] = useState(0)  // px offset for drag-to-pan
  const [panY, setPanY] = useState(0)

  const ZOOM_STEP = 10
  const ZOOM_MIN = 50
  const ZOOM_MAX = 300

  // Reset pan when zoom goes back to 100%
  const handleZoomIn = () => setZoomLevel((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP))
  const handleZoomOut = () => {
    setZoomLevel((z) => {
      const next = Math.max(ZOOM_MIN, z - ZOOM_STEP)
      if (next <= 100) { setPanX(0); setPanY(0) }
      return next
    })
  }
  const handleZoomReset = () => { setZoomLevel(100); setPanX(0); setPanY(0) }

  const docxContainerRef = useRef(null)
  const slideContainerRef = useRef(null)

  // Canvas drag-to-pan (no scrollbars — pure translate)
  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 })
  const [isPanning, setIsPanning] = useState(false)

  const handleMouseDown = (e) => {
    if (zoomLevel <= 100) return
    isDragging.current = true
    setIsPanning(true)
    dragStart.current = { x: e.clientX, y: e.clientY, panX, panY }
    e.preventDefault()
  }

  const handleMouseMove = (e) => {
    if (!isDragging.current) return
    const dx = e.clientX - dragStart.current.x
    const dy = e.clientY - dragStart.current.y
    setPanX(dragStart.current.panX + dx)
    setPanY(dragStart.current.panY + dy)
  }

  const handleMouseUp = () => {
    isDragging.current = false
    setIsPanning(false)
  }

  // Mouse wheel zoom on the slide canvas
  const handleWheel = (e) => {
    if (!slideContainerRef.current) return
    e.preventDefault()
    if (e.deltaY < 0) {
      setZoomLevel((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP))
    } else {
      setZoomLevel((z) => {
        const next = Math.max(ZOOM_MIN, z - ZOOM_STEP)
        if (next <= 100) { setPanX(0); setPanY(0) }
        return next
      })
    }
  }

  useEffect(() => {
    let isMounted = true
    let currentBlobUrl = null

    async function loadDocument() {
      try {
        setLoading(true)
        setError(null)
        setSheets([])
        setSlides([])
        setSlidesError(null)

        // 1. Fetch document metadata
        const detailRes = await documentsApi.detail(documentId)
        if (!isMounted) return
        const doc = detailRes.data
        setDocDetail(doc)

        const fileType = (doc.file_type || '').toLowerCase().replace('.', '')

        // For PPTX: fetch rendered slide images from backend
        if (['pptx', 'ppt'].includes(fileType)) {
          setSlidesLoading(true)
          try {
            const slidesRes = await api.get(`/documents/${documentId}/slides/`)
            if (isMounted) {
              setSlides(slidesRes.data.slides || [])
            }
          } catch (slideErr) {
            if (isMounted) {
              setSlidesError(slideErr.response?.data?.error || 'Could not render slides.')
            }
          } finally {
            if (isMounted) setSlidesLoading(false)
          }
          if (isMounted) setLoading(false)
          return // PPTX handled via slides API — no blob needed
        }

        // 2. Fetch raw file blob for other types
        const blobRes = await api.get(`/documents/${documentId}/serve/`, {
          responseType: 'blob',
        })

        if (!isMounted) return
        const blob = blobRes.data
        setFileBlob(blob)
        currentBlobUrl = URL.createObjectURL(blob)
        setBlobUrl(currentBlobUrl)

        const arrayBuffer = await blob.arrayBuffer()

        // Word (.docx) rendering
        if (fileType === 'docx' || fileType === 'doc') {
          try {
            const result = await mammoth.convertToHtml({ arrayBuffer })
            // docx-preview handles DOM render in useEffect below
          } catch (e) {
            console.warn('Mammoth fallback:', e)
          }
        }

        // Excel (.xlsx, .xls, .csv) rendering
        if (['xlsx', 'xls', 'csv'].includes(fileType)) {
          try {
            const workbook = XLSX.read(arrayBuffer, { type: 'array' })
            const parsedSheets = workbook.SheetNames.map((name) => {
              const worksheet = workbook.Sheets[name]
              const html = XLSX.utils.sheet_to_html(worksheet, { id: 'excel-table' })
              return { name, html }
            })
            if (isMounted) setSheets(parsedSheets)
          } catch (e) {
            console.warn('XLSX parsing failed:', e)
          }
        }

        // Plain text rendering
        if (['txt', 'md', 'json', 'xml', 'html', 'py', 'js', 'ts', 'c', 'cpp', 'log'].includes(fileType)) {
          const text = new TextDecoder().decode(arrayBuffer)
          if (isMounted) setTextContent(text)
        }
      } catch (err) {
        if (isMounted) {
          setError(err.response?.data?.detail || 'Failed to load document preview.')
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    if (documentId) loadDocument()

    return () => {
      isMounted = false
      if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl)
    }
  }, [documentId])

  // docx-preview DOM rendering
  useEffect(() => {
    if (!loading && docxContainerRef.current && fileBlob) {
      const fileType = (docDetail?.file_type || '').toLowerCase().replace('.', '')
      if (fileType === 'docx') {
        docxContainerRef.current.innerHTML = ''
        renderDocx(fileBlob, docxContainerRef.current, undefined, {
          className: 'docx-viewer',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
        }).catch((err) => console.warn('docx-preview notice:', err))
      }
    }
  }, [loading, fileBlob, docDetail])

  const handleDownload = () => {
    if (!blobUrl || !docDetail) return
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = docDetail.title || 'document'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const handleDownloadForPptx = async () => {
    if (!docDetail) return
    try {
      const blobRes = await api.get(`/documents/${documentId}/serve/`, { responseType: 'blob' })
      const url = URL.createObjectURL(blobRes.data)
      const a = document.createElement('a')
      a.href = url
      a.download = docDetail.title || 'presentation.pptx'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Download failed:', e)
    }
  }

  const fileType = (docDetail?.file_type || '').toLowerCase().replace('.', '')
  const isPdf = fileType === 'pdf'
  const isDocx = fileType === 'docx' || fileType === 'doc'
  const isExcel = ['xlsx', 'xls', 'csv'].includes(fileType)
  const isPptx = fileType === 'pptx' || fileType === 'ppt'
  const isImage = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(fileType)
  const isText = ['txt', 'md', 'json', 'xml', 'html', 'py', 'js', 'ts', 'c', 'cpp', 'log'].includes(fileType)

  const activeSlide = slides[activeSlideIdx]

  const handleKeyDown = (e) => {
    if (!isPptx || slides.length === 0) return
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      setActiveSlideIdx((prev) => Math.min(slides.length - 1, prev + 1))
      setPanX(0); setPanY(0)
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      setActiveSlideIdx((prev) => Math.max(0, prev - 1))
      setPanX(0); setPanY(0)
    }
    if (e.key === '+' || e.key === '=') handleZoomIn()
    if (e.key === '-') handleZoomOut()
    if (e.key === '0') handleZoomReset()
  }

  return (
    <div
      className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="bg-dark-800 border border-dark-700 rounded-2xl w-full max-w-6xl h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-700 bg-dark-850 flex-shrink-0">
          <div className="flex items-center space-x-3 truncate mr-4 flex-1 min-w-0">
            <div className="p-2 bg-orange-500/10 text-orange-400 rounded-xl flex-shrink-0">
              {isPptx ? <Presentation size={20} /> : <FileText size={20} className="text-brand-400" />}
            </div>
            <div className="truncate">
              <h2 className="font-semibold text-white truncate text-base">
                {docDetail?.title || 'Loading...'}
              </h2>
              {docDetail && (
                <div className="flex items-center space-x-2 text-xs text-dark-400 mt-0.5">
                  <span className="uppercase font-mono font-medium px-2 py-0.5 bg-dark-700 rounded-md text-orange-300">
                    {docDetail.file_type || 'FILE'}
                  </span>
                  <span>•</span>
                  {isPptx ? (
                    <span>{slides.length > 0 ? `${slides.length} Slides` : 'Loading slides...'}</span>
                  ) : (
                    <span>{docDetail.chunk_count} Chunk(s)</span>
                  )}
                  {docDetail.uploaded_by_name && (
                    <><span>•</span><span>By {docDetail.uploaded_by_name}</span></>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2 flex-shrink-0">
            {/* Grid/Presentation toggle for PPTX */}
            {isPptx && slides.length > 0 && (
              <button
                onClick={() => setIsGridMode(!isGridMode)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors border ${
                  isGridMode
                    ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                    : 'bg-dark-700 text-dark-200 border-dark-600 hover:text-white'
                }`}
              >
                <LayoutGrid size={14} />
                <span>{isGridMode ? 'Slide View' : 'All Slides'}</span>
              </button>
            )}

            {/* Download button */}
            <button
              onClick={isPptx ? handleDownloadForPptx : handleDownload}
              className="flex items-center space-x-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-sm font-medium transition-colors shadow-lg shadow-brand-600/20"
            >
              <Download size={16} />
              <span>Download</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded-xl transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden bg-dark-900 flex flex-col">
          {(loading || slidesLoading) && (
            <div className="flex-1 flex flex-col items-center justify-center space-y-4 text-dark-400">
              <Loader2 size={40} className="animate-spin text-orange-500" />
              {isPptx ? (
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium text-white">Opening PowerPoint presentation...</p>
                  <p className="text-xs text-dark-400">First load renders slides with full design quality.</p>
                  <p className="text-xs text-dark-500">Subsequent opens will be instant ⚡</p>
                </div>
              ) : (
                <p className="text-sm">Loading document preview...</p>
              )}
            </div>
          )}

          {(error || slidesError) && !loading && !slidesLoading && (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <AlertCircle size={40} className="text-red-400 mb-3" />
              <p className="text-sm text-dark-400 mb-4">{error || slidesError}</p>
              <button onClick={onClose} className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-white text-sm rounded-xl">
                Close
              </button>
            </div>
          )}

          {!loading && !slidesLoading && !error && !slidesError && (
            <div className="flex-1 overflow-hidden flex flex-col">
              {/* ─── PDF Viewer ─── */}
              {isPdf && blobUrl && (
                <div className="flex-1 p-4">
                  <iframe
                    src={blobUrl}
                    title={docDetail?.title}
                    className="w-full h-full rounded-xl border border-dark-700 bg-white"
                  />
                </div>
              )}

              {/* ─── Word Viewer ─── */}
              {isDocx && (
                <div className="flex-1 p-4 overflow-auto bg-dark-950">
                  <div
                    ref={docxContainerRef}
                    className="w-full max-w-4xl mx-auto bg-white text-black p-8 shadow-2xl rounded-lg min-h-full docx-wrapper"
                  />
                </div>
              )}

              {/* ─── Excel Viewer ─── */}
              {isExcel && (
                <div className="flex-1 flex flex-col bg-dark-850 border-t border-dark-700 overflow-hidden">
                  {sheets.length > 1 && (
                    <div className="flex items-center space-x-1 p-2 bg-dark-800 border-b border-dark-700 overflow-x-auto">
                      {sheets.map((sheet, idx) => (
                        <button
                          key={sheet.name}
                          onClick={() => setActiveSheetIdx(idx)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                            activeSheetIdx === idx ? 'bg-brand-600 text-white' : 'bg-dark-700 text-dark-300 hover:text-white'
                          }`}
                        >
                          <FileSpreadsheet size={13} />
                          {sheet.name}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex-1 p-4 overflow-auto bg-white text-slate-900 text-sm">
                    {sheets[activeSheetIdx] ? (
                      <div className="excel-table-container font-sans" dangerouslySetInnerHTML={{ __html: sheets[activeSheetIdx].html }} />
                    ) : (
                      <div className="p-8 text-center text-slate-500">No sheet data found.</div>
                    )}
                  </div>
                </div>
              )}

              {/* ─── PPTX Original Slide Image Viewer ─── */}
              {isPptx && slides.length > 0 && (
                <div className="flex-1 overflow-hidden flex flex-col bg-dark-950">
                  {/* Slide Strip Navigation */}
                  {!isGridMode && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-dark-900 border-b border-dark-800 overflow-x-auto flex-shrink-0">
                      <button
                        disabled={activeSlideIdx === 0}
                        onClick={() => setActiveSlideIdx((p) => Math.max(0, p - 1))}
                        className="p-1.5 rounded-lg bg-dark-800 hover:bg-dark-700 text-white disabled:opacity-30 flex-shrink-0"
                      >
                        <ChevronLeft size={16} />
                      </button>

                      <div className="flex items-center gap-1.5 overflow-x-auto flex-1 py-1">
                        {slides.map((s, idx) => (
                          <button
                            key={idx}
                            onClick={() => setActiveSlideIdx(idx)}
                            className={`flex-shrink-0 relative rounded-lg overflow-hidden border-2 transition-all ${
                              activeSlideIdx === idx
                                ? 'border-orange-500 ring-2 ring-orange-500/40'
                                : 'border-dark-700 hover:border-orange-400/60'
                            }`}
                            title={`Slide ${s.slide_number}`}
                          >
                            <img
                              src={s.image}
                              alt={`Slide ${s.slide_number}`}
                              className="h-12 w-auto object-cover"
                              style={{ aspectRatio: '16/9' }}
                            />
                            <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] text-center py-0.5 font-mono">
                              {s.slide_number}
                            </div>
                          </button>
                        ))}
                      </div>

                      <button
                        disabled={activeSlideIdx === slides.length - 1}
                        onClick={() => setActiveSlideIdx((p) => Math.min(slides.length - 1, p + 1))}
                        className="p-1.5 rounded-lg bg-dark-800 hover:bg-dark-700 text-white disabled:opacity-30 flex-shrink-0"
                      >
                        <ChevronRight size={16} />
                      </button>

                      {/* Prev / Next buttons + counter group */}
                      <div className="flex items-center gap-1 ml-2 bg-dark-800 border border-dark-700 rounded-xl px-2 py-1 flex-shrink-0">
                        <button
                          disabled={activeSlideIdx === 0}
                          onClick={() => setActiveSlideIdx((p) => Math.max(0, p - 1))}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-dark-200 hover:text-white hover:bg-dark-700 disabled:opacity-30 transition-colors font-medium"
                          title="Previous Slide"
                        >
                          <ChevronLeft size={14} />
                          Prev
                        </button>

                        <span className="text-xs text-dark-500 select-none">|</span>

                        <span className="text-xs text-dark-400 font-mono px-1 min-w-[3rem] text-center">
                          {activeSlideIdx + 1} / {slides.length}
                        </span>

                        <span className="text-xs text-dark-500 select-none">|</span>

                        <button
                          disabled={activeSlideIdx === slides.length - 1}
                          onClick={() => setActiveSlideIdx((p) => Math.min(slides.length - 1, p + 1))}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-dark-200 hover:text-white hover:bg-dark-700 disabled:opacity-30 transition-colors font-medium"
                          title="Next Slide"
                        >
                          Next
                          <ChevronRight size={14} />
                        </button>
                      </div>

                      {/* Zoom Controls */}
                      <div className="flex items-center gap-1 ml-3 bg-dark-800 border border-dark-700 rounded-xl px-2 py-1 flex-shrink-0">
                        <button
                          onClick={handleZoomOut}
                          disabled={zoomLevel <= ZOOM_MIN}
                          className="p-1 rounded-lg text-dark-300 hover:text-white hover:bg-dark-700 disabled:opacity-30 transition-colors"
                          title="Zoom Out (-)"
                        >
                          <ZoomOut size={15} />
                        </button>
                        <button
                          onClick={handleZoomReset}
                          className="px-2 py-0.5 text-xs font-mono text-dark-200 hover:text-white rounded transition-colors min-w-[3rem] text-center"
                          title="Reset Zoom (0)"
                        >
                          {zoomLevel}%
                        </button>
                        <button
                          onClick={handleZoomIn}
                          disabled={zoomLevel >= ZOOM_MAX}
                          className="p-1 rounded-lg text-dark-300 hover:text-white hover:bg-dark-700 disabled:opacity-30 transition-colors"
                          title="Zoom In (+)"
                        >
                          <ZoomIn size={15} />
                        </button>
                        <button
                          onClick={handleZoomReset}
                          className="p-1 rounded-lg text-dark-300 hover:text-orange-400 hover:bg-dark-700 transition-colors"
                          title="Reset to Fit"
                        >
                          <RotateCcw size={13} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── Single Slide Display — Canvas Pan (no scrollbars) ── */}
                  {!isGridMode && activeSlide && (
                    <div
                      ref={slideContainerRef}
                      className="flex-1 select-none relative"
                      style={{
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: zoomLevel > 100 ? (isPanning ? 'grabbing' : 'grab') : 'default',
                        background: 'transparent',
                      }}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                      onWheel={handleWheel}
                    >
                      <img
                        src={activeSlide.image}
                        alt={`Slide ${activeSlide.slide_number}`}
                        className="rounded-xl shadow-2xl border border-dark-700 flex-shrink-0"
                        style={{
                          // Scale via CSS transform — no scrollbars ever
                          transform: `scale(${zoomLevel / 100}) translate(${panX / (zoomLevel / 100)}px, ${panY / (zoomLevel / 100)}px)`,
                          transformOrigin: 'center center',
                          transition: isPanning ? 'none' : 'transform 0.18s ease',
                          maxWidth: '100%',
                          maxHeight: '100%',
                          width: 'auto',
                          height: 'auto',
                          display: 'block',
                          imageRendering: '-webkit-optimize-contrast',
                          pointerEvents: 'none',
                          userSelect: 'none',
                        }}
                        draggable={false}
                      />
                    </div>
                  )}

                  {/* ── Grid Thumbnail Overview ── */}
                  {isGridMode && (
                    <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 md:grid-cols-3 gap-4">
                      {slides.map((slide, idx) => (
                        <div
                          key={idx}
                          onClick={() => { setActiveSlideIdx(idx); setIsGridMode(false) }}
                          className={`cursor-pointer rounded-xl overflow-hidden border-2 transition-all hover:border-orange-400 hover:shadow-lg hover:shadow-orange-500/20 ${
                            activeSlideIdx === idx ? 'border-orange-500 ring-2 ring-orange-500/30' : 'border-dark-700'
                          }`}
                        >
                          <img
                            src={slide.image}
                            alt={`Slide ${slide.slide_number}`}
                            className="w-full h-auto object-cover"
                          />
                          <div className="bg-dark-850 text-center text-xs text-dark-400 py-1.5 font-medium">
                            Slide {slide.slide_number}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ─── Image Viewer ─── */}
              {isImage && blobUrl && (
                <div className="flex-1 flex items-center justify-center p-4">
                  <img
                    src={blobUrl}
                    alt={docDetail?.title}
                    className="max-h-full max-w-full object-contain rounded-xl shadow-2xl border border-dark-700"
                  />
                </div>
              )}

              {/* ─── Text / Code Viewer ─── */}
              {isText && (
                <div className="flex-1 p-6 overflow-auto bg-dark-850 border-t border-dark-700">
                  <pre className="text-dark-200 font-mono text-sm leading-relaxed whitespace-pre-wrap">
                    {textContent || 'No text content.'}
                  </pre>
                </div>
              )}

              {/* ─── Unknown File Fallback ─── */}
              {!isPdf && !isDocx && !isExcel && !isPptx && !isImage && !isText && (
                <div className="flex-1 flex flex-col items-center justify-center h-full text-center p-8">
                  <FileText size={48} className="text-brand-400 mb-3" />
                  <h3 className="text-lg font-medium text-white mb-2">{docDetail?.title}</h3>
                  <p className="text-sm text-dark-400 mb-6">Download this file to view it on your device.</p>
                  <button
                    onClick={handleDownload}
                    className="flex items-center space-x-2 px-6 py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-sm font-medium transition-colors shadow-lg shadow-brand-600/20"
                  >
                    <Download size={18} />
                    <span>Download File</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
