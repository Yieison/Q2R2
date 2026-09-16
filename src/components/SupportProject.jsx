import { useState } from 'react'
import { Heart, Loader2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '../lib/queryClient'

const formatCop = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

export default function SupportProject({ compact = false }) {
  const [pendingAmount, setPendingAmount] = useState(null)
  const [error, setError] = useState('')
  const { data, isLoading, isError } = useQuery({
    queryKey: ['/api/support'],
    staleTime: 5 * 60 * 1000,
  })

  const amounts = data?.amounts || []
  const available = data?.available === true && amounts.length > 0

  const startSupport = async (amountCop) => {
    setError('')
    setPendingAmount(amountCop)
    try {
      const res = await apiRequest('POST', '/api/support/checkout', { amountCop })
      const result = await res.json()
      if (!result?.checkoutUrl) throw new Error('No se pudo abrir el aporte.')
      window.location.assign(result.checkoutUrl)
    } catch (err) {
      setError(err?.message || 'No se pudo iniciar el aporte.')
      setPendingAmount(null)
    }
  }

  return (
    <section className={compact ? 'text-center' : 'rounded-2xl border border-primary-100 bg-primary-50/60 p-6 text-center'}>
      <div className="mx-auto flex max-w-xl flex-col items-center">
        <Heart className="h-5 w-5 text-primary-600" fill="currentColor" />
        <h2 className="mt-2 text-base font-bold text-gray-900">Apoyar Q2R2</h2>
        <p className="mt-1 text-sm leading-relaxed text-gray-600">
          Crear QRs es gratis. Si esta herramienta te resulta útil, puedes apoyar su mantenimiento con un aporte único. Sin suscripciones.
        </p>
        {isLoading ? (
          <Loader2 className="mt-3 h-4 w-4 animate-spin text-primary-600" />
        ) : available ? (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {amounts.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => startSupport(amount)}
                disabled={pendingAmount !== null}
                className="btn-secondary px-3 py-2 text-xs disabled:opacity-60"
              >
                {pendingAmount === amount && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {formatCop.format(amount)}
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs text-gray-500">
            {isError ? 'Los aportes no están disponibles en este momento.' : 'Los aportes no están disponibles por ahora.'}
          </p>
        )}
        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
      </div>
    </section>
  )
}