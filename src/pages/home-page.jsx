import { useEffect, useRef, useState } from 'react'
import QRCodeStyling from 'qr-code-styling'
import { Link as WLink, useLocation } from 'wouter'
import {
  Download, FolderOpen, Link, Loader2, LogIn, LogOut, Mail, Palette,
  Phone, QrCode, Save, Settings, Type, Wifi,
} from 'lucide-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import QRInput from '../components/QRInput'
import QRStyler from '../components/QRStyler'
import SavedQrCard from '../components/SavedQrCard'
import SupportProject from '../components/SupportProject'
import { useAuth } from '../hooks/use-auth'
import { apiRequest, queryClient } from '../lib/queryClient'
import { downloadQrPng } from '../lib/qr-download'
import { clearQrDraft, getQrDraft, saveQrDraft } from '../lib/qr-draft'
import { compactStyleForStorage, hydrateLogoStyle } from '../lib/logo-image'
import { buildQrOptions, defaultQrStyle } from '@shared/qr-options'
import { usePageMeta } from '../hooks/use-page-meta'

const qrTypes = [
  { id: 'url', name: 'URL', icon: Link },
  { id: 'text', name: 'Texto', icon: Type },
  { id: 'wifi', name: 'WiFi', icon: Wifi },
  { id: 'email', name: 'Email', icon: Mail },
  { id: 'phone', name: 'Teléfono', icon: Phone },
]

function mergeStyle(style) {
  return {
    ...defaultQrStyle,
    ...style,
    cornerSquareColor:
      style?.cornerSquareColor || style?.fgColor || defaultQrStyle.cornerSquareColor,
    gradient: { ...defaultQrStyle.gradient, ...(style?.gradient || {}) },
    logo: { ...defaultQrStyle.logo, ...(style?.logo || {}) },
  }
}

export default function HomePage() {
  usePageMeta({
    title: 'Generador QR gratis | Q2R2',
    description: 'Crea, personaliza y descarga códigos QR PNG gratis desde tu navegador. Una cuenta solo es necesaria para guardarlos.',
    path: '/app',
  })

  const { user, logoutMutation } = useAuth()
  const [, navigate] = useLocation()
  const [qrType, setQrType] = useState('url')
  const [qrData, setQrData] = useState('')
  const [qrStyle, setQrStyle] = useState(() => mergeStyle(defaultQrStyle))
  const [qrName, setQrName] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [saveError, setSaveError] = useState('')
  const [draftReady, setDraftReady] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [downloadError, setDownloadError] = useState('')
  const [isDownloading, setIsDownloading] = useState(false)
  const [showSupport, setShowSupport] = useState(false)
  const [loadingQrId, setLoadingQrId] = useState(null)
  const qrContainerRef = useRef(null)
  const qrInstanceRef = useRef(null)
  const savedSectionRef = useRef(null)
  const previousUserIdRef = useRef(undefined)
  const currentUserIdRef = useRef(user?.id ?? null)
  const editorRevisionRef = useRef(0)
  const draftRestoreRef = useRef({ userId: null, createdAt: null, inFlight: false, committed: false })
  currentUserIdRef.current = user?.id ?? null

  const {
    data: savedQrs = [],
    isLoading: loadingSaved,
    isError: savedError,
  } = useQuery({
    queryKey: ['/api/qrcodes'],
    enabled: Boolean(user?.id),
  })

  useEffect(() => {
    qrInstanceRef.current = new QRCodeStyling(buildQrOptions('', qrStyle, 360))
    if (qrContainerRef.current) qrInstanceRef.current.append(qrContainerRef.current)
  }, [])

  useEffect(() => {
    const container = qrContainerRef.current
    const instance = qrInstanceRef.current
    if (!container || !instance) return
    if (!qrData) {
      container.replaceChildren()
      return
    }
    instance.update(buildQrOptions(qrData, qrStyle, 360))
    container.replaceChildren()
    instance.append(container)
  }, [qrData, qrStyle])

  useEffect(() => {
    const previousUserId = previousUserIdRef.current
    const currentUserId = user?.id ?? null
    if (previousUserId !== undefined && previousUserId !== currentUserId) {
      setQrType('url')
      setQrData('')
      setQrStyle(mergeStyle(defaultQrStyle))
      setQrName('')
      setEditingId(null)
      setIsDirty(false)
      setDraftReady(false)
      setSaveError('')
      setShowSupport(false)
      setLoadingQrId(null)
      editorRevisionRef.current += 1
      draftRestoreRef.current = { userId: null, createdAt: null, inFlight: false, committed: false }
    }
    previousUserIdRef.current = currentUserId
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    const draft = getQrDraft()
    if (!draft) return
    const createdAt = draft.createdAt
    const restore = draftRestoreRef.current
    if (restore.userId === user.id && restore.createdAt === createdAt && (restore.inFlight || restore.committed)) return

    const ownerId = user.id
    const revision = editorRevisionRef.current + 1
    editorRevisionRef.current = revision
    draftRestoreRef.current = { userId: ownerId, createdAt, inFlight: true, committed: false }
    setQrType(draft.type || 'url')
    setQrData(draft.data || '')
    setQrName(draft.name || '')
    setQrStyle(mergeStyle(draft.style))
    setEditingId(null)
    setIsDirty(true)
    setDraftReady(true)

    hydrateLogoStyle(mergeStyle(draft.style))
      .then((style) => {
        const currentDraft = getQrDraft()
        const currentRestore = draftRestoreRef.current
        if (
          currentUserIdRef.current !== ownerId ||
          editorRevisionRef.current !== revision ||
          currentRestore.userId !== ownerId ||
          currentRestore.createdAt !== createdAt ||
          currentDraft?.createdAt !== createdAt
        ) return
        draftRestoreRef.current = { ...currentRestore, inFlight: false, committed: true }
        setQrStyle(mergeStyle(style))
      })
      .catch(() => {
        const currentRestore = draftRestoreRef.current
        if (currentUserIdRef.current !== ownerId || editorRevisionRef.current !== revision) return
        draftRestoreRef.current = { ...currentRestore, inFlight: false, committed: true }
      })
  }, [user?.id])

  const saveMutation = useMutation({
    mutationFn: async ({ id, ownerId, editorRevision: _editorRevision, ...payload }) => {
      const style = await compactStyleForStorage(payload.style)
      if (ownerId !== currentUserIdRef.current) throw new Error('La sesión cambió antes de guardar el QR.')
      const url = id ? `/api/qrcodes/${id}` : '/api/qrcodes'
      const res = await apiRequest(id ? 'PUT' : 'POST', url, { ...payload, style })
      return res.json()
    },
    onSuccess: async (saved, variables) => {
      if (variables.ownerId !== currentUserIdRef.current) return
      queryClient.invalidateQueries({ queryKey: ['/api/qrcodes'] })
      if (variables.editorRevision !== editorRevisionRef.current) return
      let hydratedStyle
      try {
        hydratedStyle = mergeStyle(await hydrateLogoStyle(saved?.style || qrStyle))
      } catch {
        // The saved QR remains usable even if an optional image hydration fails.
      }
      if (variables.ownerId !== currentUserIdRef.current || variables.editorRevision !== editorRevisionRef.current) return
      setSaveError('')
      setIsDirty(false)
      setDraftReady(false)
      clearQrDraft()
      draftRestoreRef.current = { userId: null, createdAt: null, inFlight: false, committed: false }
      if (saved?.id) setEditingId(saved.id)
      if (hydratedStyle) setQrStyle(hydratedStyle)
    },
    onError: (err) => setSaveError(err?.message || 'No se pudo guardar el QR.'),
  })

  const deleteMutation = useMutation({
    mutationFn: ({ id, ownerId }) => {
      if (ownerId !== currentUserIdRef.current) throw new Error('La sesión cambió antes de eliminar el QR.')
      return apiRequest('DELETE', `/api/qrcodes/${id}`)
    },
    onSuccess: (_result, variables) => {
      if (variables.ownerId !== currentUserIdRef.current) return
      queryClient.invalidateQueries({ queryKey: ['/api/qrcodes'] })
      if (editingId === variables.id) resetEditor()
    },
  })

  function resetEditor() {
    editorRevisionRef.current += 1
    setQrType('url')
    setQrData('')
    setQrStyle(mergeStyle(defaultQrStyle))
    setQrName('')
    setEditingId(null)
    setIsDirty(false)
    setDraftReady(false)
    setSaveError('')
  }

  const updateStyle = (style) => {
    editorRevisionRef.current += 1
    setQrStyle(style)
    setIsDirty(true)
  }

  const handleSave = () => {
    setSaveError('')
    if (!qrData.trim()) {
      setSaveError('Ingresa contenido antes de guardar.')
      return
    }
    const name = qrName.trim() || `QR ${qrTypes.find((item) => item.id === qrType)?.name || ''}`.trim()
    const payload = { name, type: qrType, data: qrData, style: qrStyle }
    if (!user) {
      if (!saveQrDraft(payload)) {
        setSaveError('No pudimos preparar el diseño para iniciar sesión. Puedes descargarlo gratis o intenta de nuevo.')
        return
      }
      navigate('/auth?intent=save')
      return
    }
    saveMutation.mutate({ id: editingId, ownerId: user.id, editorRevision: editorRevisionRef.current, ...payload })
  }

  const handleLoad = async (qr) => {
    if (isDirty && editingId !== qr.id && !window.confirm('Tienes cambios sin guardar. ¿Quieres descartarlos y abrir este QR?')) return
    const ownerId = currentUserIdRef.current
    const revision = editorRevisionRef.current + 1
    editorRevisionRef.current = revision
    setLoadingQrId(qr.id)
    let style
    try {
      style = mergeStyle(await hydrateLogoStyle(mergeStyle(qr.style)))
    } catch {
      style = mergeStyle(qr.style)
    }
    if (ownerId !== currentUserIdRef.current || revision !== editorRevisionRef.current) {
      setLoadingQrId((current) => current === qr.id ? null : current)
      return
    }
    setQrType(qr.type)
    setQrData(qr.data)
    setQrName(qr.name)
    setQrStyle(style)
    setEditingId(qr.id)
    setSaveError('')
    setDraftReady(false)
    setIsDirty(false)
    setLoadingQrId(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelDraft = () => {
    clearQrDraft()
    draftRestoreRef.current = { userId: null, createdAt: null, inFlight: false, committed: false }
    setDraftReady(false)
    setSaveError('')
  }

  const downloadQR = async () => {
    if (!qrData || isDownloading) return
    setDownloadError('')
    setIsDownloading(true)
    try {
      const style = await hydrateLogoStyle(qrStyle)
      await downloadQrPng({ data: qrData, style, name: qrName || `QR ${qrType}` })
      setShowSupport(true)
    } catch (err) {
      setDownloadError(err?.message || 'No se pudo descargar el QR.')
    } finally {
      setIsDownloading(false)
    }
  }

  const logout = () => {
    clearQrDraft()
    queryClient.removeQueries({ queryKey: ['/api/qrcodes'] })
    resetEditor()
    logoutMutation.mutate()
  }

  return (
    <div className="min-h-screen bg-gray-50/60 px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex items-center justify-between border-b border-gray-100 pb-6">
          <WLink href="/" className="flex items-center gap-2">
            <QrCode className="h-8 w-8 text-primary-600" />
            <span className="bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-2xl font-bold text-transparent">Q2R2</span>
          </WLink>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <button onClick={() => savedSectionRef.current?.scrollIntoView({ behavior: 'smooth' })} className="hidden items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 sm:flex">
                  <FolderOpen className="h-4 w-4" /> Mis QRs {savedQrs.length > 0 && <span className="rounded-full bg-primary-600 px-2 py-0.5 text-xs text-white">{savedQrs.length}</span>}
                </button>
                <span className="hidden text-sm text-gray-600 sm:inline">Hola, <strong>{user.username}</strong></span>
                <button onClick={logout} disabled={logoutMutation.isPending} className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-60">
                  {logoutMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />} Salir
                </button>
              </>
            ) : (
              <WLink href="/auth" className="btn-secondary px-4 py-2 text-sm"><LogIn className="h-4 w-4" /> Guardar en cuenta</WLink>
            )}
          </div>
        </header>

        <div className="mb-12 text-center">
          <h1 className="mb-4 bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-4xl font-bold text-transparent sm:text-5xl">Genera códigos QR</h1>
          <p className="text-lg text-gray-600">Personalízalos y descárgalos gratis en PNG, sin cuenta.</p>
          <p className="mt-2 text-xs text-gray-500">La creación anónima ocurre en tu navegador. Al guardar, el contenido se cifra en el servidor; un QR escaneable sigue siendo legible por quien lo escanee.</p>
        </div>

        {draftReady && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary-100 bg-primary-50 p-4 text-sm text-primary-800">
            <span>Tu diseño está listo para guardar en esta cuenta. Revísalo y elige <strong>Guardar en mi cuenta</strong> cuando quieras.</span>
            <button type="button" onClick={cancelDraft} className="font-semibold underline">Descartar borrador</button>
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-6">
            <section className="card">
              <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold"><Settings className="h-5 w-5 text-primary-600" /> Tipo de QR</h2>
              <div className="flex flex-wrap gap-2">
                {qrTypes.map(({ id, name, icon: Icon }) => (
                  <button key={id} type="button" onClick={() => { editorRevisionRef.current += 1; setLoadingQrId(null); setQrType(id); setQrData(''); setIsDirty(true) }} className={`tab-button ${qrType === id ? 'tab-button-active' : 'tab-button-inactive'}`}>
                    <Icon className="mr-2 inline h-4 w-4" />{name}
                  </button>
                ))}
              </div>
            </section>
            <section className="card">
              <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold"><Type className="h-5 w-5 text-primary-600" /> Contenido</h2>
              <QRInput type={qrType} value={qrData} onChange={(value) => { editorRevisionRef.current += 1; setLoadingQrId(null); setQrData(value); setIsDirty(true) }} />
            </section>
            <section className="card">
              <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold"><Palette className="h-5 w-5 text-primary-600" /> Personalización</h2>
              <QRStyler style={qrStyle} onChange={updateStyle} />
            </section>
          </div>

          <aside className="h-fit space-y-6 lg:sticky lg:top-8">
            <section className="card">
              <h2 className="mb-6 text-center text-xl font-semibold">Vista previa</h2>
              <div className="mb-6 flex min-h-[320px] items-center justify-center overflow-hidden rounded-lg bg-gray-50 p-8">
                <div ref={qrContainerRef} className={`${qrData ? 'block' : 'hidden'} [&>canvas]:h-auto [&>canvas]:max-w-full [&>svg]:h-auto [&>svg]:max-w-full`} />
                {!qrData && <div className="text-center text-gray-400"><QrCode className="mx-auto mb-4 h-24 w-24 opacity-20" /><p className="text-sm">Ingresa contenido para generar tu código QR</p></div>}
              </div>
              <div className="space-y-3">
                <input value={qrName} onChange={(event) => { editorRevisionRef.current += 1; setLoadingQrId(null); setQrName(event.target.value); setIsDirty(true) }} placeholder="Nombre para guardar (opcional)" className="input-field" />
                {saveError && <p className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-600">{saveError}</p>}
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={handleSave} disabled={!qrData || saveMutation.isPending} className="btn-primary disabled:cursor-not-allowed disabled:opacity-50">
                    {saveMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                    {user ? (editingId ? 'Actualizar' : 'Guardar') : 'Guardar'}
                  </button>
                  <button type="button" onClick={downloadQR} disabled={!qrData || isDownloading} className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50">
                    {isDownloading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
                    {isDownloading ? 'Generando…' : 'Descargar PNG'}
                  </button>
                </div>
                {downloadError && <p className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-600">{downloadError}</p>}
                {editingId && <p className="text-xs text-primary-700">Editando un QR guardado. Puedes cambiar contenido, tipo, nombre y estilo; guarda para actualizarlo.</p>}
              </div>
              {qrData && <div className="mt-4 flex flex-wrap gap-2 rounded-lg border border-primary-100 bg-primary-50 p-4"><span className="badge">{qrTypes.find((item) => item.id === qrType)?.name}</span><span className="badge">{qrStyle.size}px</span><span className="badge">Nivel {qrStyle.level}</span>{qrStyle.logo.enabled && qrStyle.logo.src && <span className="badge">Logo activo</span>}</div>}
            </section>
            {showSupport && <SupportProject />}
          </aside>
        </div>

        {user && (
          <section ref={savedSectionRef} className="mt-16">
            <div className="mb-6 flex items-center gap-2"><FolderOpen className="h-6 w-6 text-primary-600" /><h2 className="text-2xl font-bold text-gray-800">Mis QRs guardados</h2></div>
            {loadingSaved ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>
              : savedError ? <div className="card text-center text-red-600">No se pudieron cargar tus QRs. Inténtalo de nuevo.</div>
                : savedQrs.length === 0 ? <div className="card py-12 text-center text-gray-500"><QrCode className="mx-auto mb-4 h-16 w-16 opacity-20" /><p>Todavía no has guardado ningún QR.</p></div>
                  : <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{savedQrs.map((qr) => <SavedQrCard key={qr.id} qr={qr} onLoad={handleLoad} onDelete={(item) => { if (window.confirm(`¿Eliminar "${item.name}"?`)) deleteMutation.mutate({ id: item.id, ownerId: user.id }) }} isLoading={loadingQrId === qr.id} isDeleting={deleteMutation.isPending && deleteMutation.variables?.id === qr.id} />)}</div>}
          </section>
        )}

        <footer className="mt-16 border-t border-gray-100 py-10">
          <SupportProject compact />
          <p className="mt-8 text-center text-xs text-gray-400">© {new Date().getFullYear()} Q2R2 · Crear QRs es gratis; la cuenta es opcional para guardarlos.</p>
        </footer>
      </div>
    </div>
  )
}