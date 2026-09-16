import { useState } from 'react'
import { Link, Redirect } from 'wouter'
import { QrCode, Loader2, Check } from 'lucide-react'
import { useAuth } from '../hooks/use-auth'
import { usePageMeta } from '../hooks/use-page-meta'
import { clearQrDraft, getQrDraft } from '../lib/qr-draft'

const PERKS = [
  'Guarda tus diseños para editarlos después',
  'Accede a tus QRs desde tu cuenta',
  'Crea y descarga QRs gratis, siempre',
]

const AuthPage = () => {
  usePageMeta({
    title: 'Iniciar sesión o crear cuenta | Q2R2',
    description: 'Inicia sesión o crea una cuenta opcional para guardar tus códigos QR en Q2R2.',
    path: '/auth',
  })

  const { user, isLoading, loginMutation, registerMutation } = useAuth()
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ username: '', password: '' })
  const hasSaveIntent = new URLSearchParams(window.location.search).get('intent') === 'save' && Boolean(getQrDraft())

  const activeMutation = mode === 'login' ? loginMutation : registerMutation

  const handleSubmit = (e) => {
    e.preventDefault()
    activeMutation.mutate({ username: form.username.trim(), password: form.password })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <Loader2 className="h-7 w-7 animate-spin text-primary-600" />
      </div>
    )
  }

  if (user) return <Redirect to="/app" />

  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-2">

      {/* ── Form column ── */}
      <div className="flex flex-col justify-center px-6 py-16 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-sm">

          {/* Logo */}
          <Link href="/" className="mb-10 flex items-center gap-2">
            <QrCode className="h-6 w-6 text-primary-600" />
            <span className="text-lg font-bold tracking-tight text-gray-900">Q2R2</span>
          </Link>

          {/* Tab switcher */}
          <div className="mb-8 flex rounded-xl border border-gray-200 bg-gray-50 p-1">
            {['login', 'register'].map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all ${
                  mode === m
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-400 hover:text-gray-600'
                }`}>
                {m === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
              </button>
            ))}
          </div>

          <div className="mb-7">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              {mode === 'login' ? 'Bienvenido de nuevo' : 'Crea una cuenta opcional'}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {mode === 'login'
                ? 'Accede a tus QRs guardados.'
                : 'Guarda tus diseños para volver a editarlos cuando quieras.'}
            </p>
          </div>
          {hasSaveIntent && (
            <div className="mb-6 rounded-lg border border-primary-100 bg-primary-50 px-4 py-3 text-sm text-primary-800">
              Tu diseño está preparado solo en esta sesión. Inicia sesión o crea una cuenta y volverás al generador para decidir si quieres guardarlo.
              <Link href="/app" onClick={clearQrDraft} className="mt-2 block font-semibold underline">Cancelar y volver al generador</Link>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Usuario</label>
              <input type="text" value={form.username}
                onChange={(e) => setForm(p => ({ ...p, username: e.target.value }))}
                placeholder="tu_usuario" autoComplete="username"
                className="input-field" required />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Contraseña</label>
              <input type="password" value={form.password}
                onChange={(e) => setForm(p => ({ ...p, password: e.target.value }))}
                placeholder="••••••••"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                className="input-field" required />
              {mode === 'register' && (
                <p className="mt-1.5 text-xs text-gray-400">Mínimo 6 caracteres.</p>
              )}
            </div>

            {activeMutation.isError && (
              <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                {activeMutation.error?.message || 'Ocurrió un error. Inténtalo de nuevo.'}
              </div>
            )}

            <button type="submit" disabled={activeMutation.isPending}
              className="w-full btn-primary py-3 text-sm disabled:opacity-60 disabled:cursor-not-allowed">
              {activeMutation.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
            </button>
          </form>
        </div>
      </div>

      {/* ── Visual column ── */}
      <div className="hidden lg:flex flex-col justify-center bg-gray-950 px-14 py-16 text-white">
        <div className="mx-auto max-w-sm">
          <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
            <QrCode className="h-7 w-7 text-white" strokeWidth={1.5} />
          </div>

          <h2 className="text-3xl font-extrabold leading-tight tracking-tight">
            Crea y descarga QRs sin límites.
          </h2>

          <p className="mt-4 text-gray-400 leading-relaxed">
            Diseña códigos QR con tus colores, tu logo y tu estilo. No necesitas
            una cuenta para crear ni descargar; úsala solo si quieres guardarlos.
          </p>

          <ul className="mt-8 space-y-3.5">
            {PERKS.map((perk) => (
              <li key={perk} className="flex items-center gap-3 text-sm text-gray-300">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary-600">
                  <Check className="h-3 w-3 text-white" strokeWidth={3} />
                </span>
                {perk}
              </li>
            ))}
          </ul>

          {/* Mini mockup */}
          <div className="mt-10 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="mb-3 flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-white/20" />
              <div className="h-2 w-2 rounded-full bg-white/20" />
              <div className="h-2 w-2 rounded-full bg-white/20" />
            </div>
            <div className="flex gap-3">
              <div className="flex-1 space-y-2">
                <div className="h-2.5 w-2/3 rounded-full bg-white/15" />
                <div className="h-7 w-full rounded-lg bg-white/10" />
                <div className="mt-2 flex gap-2">
                  {['bg-sky-500','bg-violet-500','bg-pink-500','bg-emerald-500'].map((c,i) => (
                    <div key={i} className={`h-5 w-5 rounded-full ${c} opacity-80`} />
                  ))}
                </div>
              </div>
              <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-xl bg-white/10">
                <QrCode className="h-12 w-12 text-white/70" strokeWidth={1.5} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AuthPage
