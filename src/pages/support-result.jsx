import { useEffect, useState } from 'react'
import { Link } from 'wouter'
import { CheckCircle2, Clock, Heart, Loader2, XCircle } from 'lucide-react'
import { apiRequest } from '../lib/queryClient'
import { usePageMeta } from '../hooks/use-page-meta'

const money = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

export default function SupportResult() {
  const [state, setState] = useState({ loading: true, data: null, error: '' })

  usePageMeta({
    title: 'Resultado de aporte | Q2R2',
    description: 'Consulta el estado de tu aporte a Q2R2.',
    path: '/apoyo/resultado',
  })

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id')
    if (!id) {
      setState({ loading: false, data: null, error: 'No se encontró un identificador para verificar el aporte.' })
      return
    }
    let active = true
    apiRequest('GET', `/api/support/result?id=${encodeURIComponent(id)}`)
      .then((res) => res.json())
      .then((data) => active && setState({ loading: false, data, error: '' }))
      .catch((err) => active && setState({ loading: false, data: null, error: err?.message || 'No se pudo verificar el aporte.' }))
    return () => { active = false }
  }, [])

  const status = String(state.data?.status || '').toLowerCase()
  const verified = status === 'verified' || status === 'approved'
  const pending = status === 'pending'

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-xl">
        {state.loading ? (
          <>
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary-600" />
            <h1 className="mt-5 text-xl font-bold">Verificando tu aporte…</h1>
          </>
        ) : verified ? (
          <>
            <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
            <h1 className="mt-5 text-2xl font-bold">Aporte verificado</h1>
            <p className="mt-2 text-gray-600">
              Gracias por apoyar Q2R2{state.data?.amountCop ? ` con ${money.format(state.data.amountCop)}` : ''}.
            </p>
          </>
        ) : pending ? (
          <>
            <Clock className="mx-auto h-14 w-14 text-amber-500" />
            <h1 className="mt-5 text-2xl font-bold">Aporte en proceso</h1>
            <p className="mt-2 text-gray-600">Aún no se ha confirmado el aporte. Puedes volver más tarde para verificarlo.</p>
          </>
        ) : (
          <>
            <XCircle className="mx-auto h-14 w-14 text-red-500" />
            <h1 className="mt-5 text-2xl font-bold">No pudimos confirmar el aporte</h1>
            <p className="mt-2 text-gray-600">{state.error || 'El aporte fue cancelado o no se completó.'}</p>
          </>
        )}
        <Link href="/app" className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-6 py-3 font-semibold text-white hover:bg-primary-700">
          <Heart className="h-4 w-4" /> Crear un QR
        </Link>
      </div>
    </div>
  )
}