import { useEffect, useRef, useState } from 'react'
import QRCodeStyling from 'qr-code-styling'
import { Download, Loader2, Pencil, Trash2 } from 'lucide-react'
import { buildQrOptions } from '@shared/qr-options'
import { downloadQrPng } from '../lib/qr-download'
import { hydrateLogoStyle } from '../lib/logo-image'

const typeLabels = {
  url: 'URL',
  text: 'Texto',
  wifi: 'WiFi',
  email: 'Email',
  phone: 'Teléfono',
}

const SavedQrCard = ({ qr, onLoad, onDelete, isDeleting, isLoading }) => {
  const previewRef = useRef(null)
  const instanceRef = useRef(null)
  const [style, setStyle] = useState(qr.style)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')

  useEffect(() => {
    let active = true
    hydrateLogoStyle(qr.style)
      .then((nextStyle) => active && setStyle(nextStyle))
      .catch(() => active && setStyle(qr.style))
    return () => { active = false }
  }, [qr.data, qr.style])

  useEffect(() => {
    instanceRef.current = new QRCodeStyling(buildQrOptions(qr.data, style, 140))
    if (!previewRef.current) return
    previewRef.current.replaceChildren()
    instanceRef.current.append(previewRef.current)
  }, [qr.data, style])

  const handleDownload = async () => {
    if (isDownloading) return
    setDownloadError('')
    setIsDownloading(true)
    try {
      const hydratedStyle = await hydrateLogoStyle(style)
      await downloadQrPng({ data: qr.data, style: hydratedStyle, name: qr.name })
    } catch (err) {
      setDownloadError(err?.message || 'No se pudo descargar')
    } finally {
      setIsDownloading(false)
    }
  }

  const createdAt = qr.createdAt ? new Date(qr.createdAt).toLocaleDateString() : ''

  return (
    <div className="card flex flex-col">
      <div className="flex justify-center items-center p-4 bg-gray-50 rounded-lg mb-4 min-h-[160px] overflow-hidden">
        <div
          ref={previewRef}
          className="[&>canvas]:max-w-full [&>canvas]:h-auto [&>svg]:max-w-full [&>svg]:h-auto"
        />
      </div>

      <h3 className="font-semibold text-gray-800 truncate" title={qr.name}>
        {qr.name}
      </h3>
      <div className="flex flex-wrap gap-2 mt-2 mb-4">
        <span className="badge">{typeLabels[qr.type] || qr.type}</span>
        {createdAt && <span className="text-xs text-gray-400 self-center">{createdAt}</span>}
      </div>

      <div className="mt-auto grid grid-cols-3 gap-2">
        <button
          onClick={() => onLoad(qr)}
          disabled={isLoading}
          className="flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-sm font-medium bg-primary-50 text-primary-700 hover:bg-primary-100 transition-colors"
          title="Editar"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
          {isLoading ? 'Abriendo' : 'Editar'}
        </button>
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className="flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50"
          title="Descargar"
        >
          {isDownloading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          PNG
        </button>
        <button
          onClick={() => onDelete(qr)}
          disabled={isDeleting}
          className="flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
          title="Eliminar"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      {downloadError && <p className="mt-2 text-xs text-red-600">{downloadError}</p>}
    </div>
  )
}

export default SavedQrCard
