import { Link } from 'wouter'
import { ArrowRight, Check, Download, Link as LinkIcon, Mail, Phone, QrCode, Type, Wifi } from 'lucide-react'
import { useAuth } from '../hooks/use-auth'
import { usePageMeta } from '../hooks/use-page-meta'
import SupportProject from '../components/SupportProject'

const features = [
  { icon: LinkIcon, label: 'URL' }, { icon: Type, label: 'Texto' }, { icon: Wifi, label: 'WiFi' },
  { icon: Mail, label: 'Email' }, { icon: Phone, label: 'Teléfono' },
]

const steps = [
  { step: '01', title: 'Escribe tu contenido', text: 'Elige el tipo de QR y añade una URL, texto, red WiFi, email o teléfono.' },
  { step: '02', title: 'Personalízalo', text: 'Ajusta colores, degradados, formas y agrega tu logo con vista previa en tiempo real.' },
  { step: '03', title: 'Descárgalo gratis', text: 'Exporta un PNG limpio y en alta resolución directamente desde tu navegador.' },
]

export default function LandingPage() {
  usePageMeta({
    title: 'Q2R2 — Generador de códigos QR gratis',
    description: 'Crea, personaliza y descarga códigos QR PNG gratis en tu navegador. Una cuenta es opcional y solo sirve para guardarlos.',
    path: '/',
  })
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Link href="/" className="flex items-center gap-2"><QrCode className="h-6 w-6 text-primary-600" /><span className="text-lg font-bold tracking-tight">Q2R2</span></Link>
          <nav className="hidden md:block"><a href="#como-funciona" className="text-sm font-medium text-gray-500 hover:text-gray-900">Cómo funciona</a></nav>
          <div className="flex items-center gap-3">
            {!user && <Link href="/auth" className="hidden text-sm font-medium text-gray-500 hover:text-gray-900 md:block">Iniciar sesión</Link>}
            <Link href="/app" className="btn-primary px-4 py-2 text-sm">{user ? 'Abrir generador' : 'Crear QR gratis'} <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 pb-20 pt-24 text-center">
        <div className="mx-auto max-w-3xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-100 bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700"><Check className="h-3.5 w-3.5" />Gratis, sin cuenta y sin marcas de agua</span>
          <h1 className="mt-6 text-5xl font-extrabold leading-[1.1] tracking-tight sm:text-6xl lg:text-7xl">Códigos QR<br /><span className="text-primary-600">a tu medida</span></h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-gray-500">Diseña QRs con colores, degradados y tu logo. Descarga un PNG limpio y en alta resolución, sin crear una cuenta.</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/app" className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-primary-700 active:scale-95">Crear un QR gratis <ArrowRight className="h-4 w-4" /></Link>
            {!user && <Link href="/auth" className="inline-flex items-center gap-1 rounded-xl border border-gray-200 px-6 py-3 text-sm font-semibold text-gray-600 hover:border-gray-300 hover:text-gray-900">Guardar en una cuenta</Link>}
          </div>
          <p className="mt-4 text-xs text-gray-400">Sin tarjeta · cuenta opcional para guardar</p>
        </div>

        <div className="mx-auto mt-16 max-w-lg overflow-hidden rounded-3xl border border-gray-100 bg-gray-50 p-6 shadow-xl">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-red-300" /><i className="h-2.5 w-2.5 rounded-full bg-yellow-300" /><i className="h-2.5 w-2.5 rounded-full bg-green-300" /><i className="ml-2 h-5 flex-1 rounded-md bg-gray-100" /></div>
            <div className="flex gap-4"><div className="flex-1 space-y-2"><i className="block h-3 w-3/4 rounded bg-gray-100" /><i className="block h-8 w-full rounded-lg bg-gray-100" /><i className="mt-3 block h-3 w-1/2 rounded bg-gray-100" /><div className="mt-2 grid grid-cols-5 gap-1.5">{['bg-primary-500', 'bg-violet-500', 'bg-pink-500', 'bg-emerald-500', 'bg-amber-500'].map((color) => <i key={color} className={`h-6 w-6 rounded-full ${color}`} />)}</div></div><div className="flex h-28 w-28 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-600 to-primary-800"><QrCode className="h-16 w-16 text-white/90" strokeWidth={1.5} /></div></div>
            <div className="mt-4 flex gap-2">{features.map(({ icon: Icon, label }) => <div key={label} className="flex flex-1 flex-col items-center gap-1 rounded-lg bg-gray-50 py-2 text-gray-400"><Icon className="h-4 w-4" /><span className="text-[10px] font-medium">{label}</span></div>)}</div>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="border-y border-gray-100 bg-gray-50 py-24">
        <div className="mx-auto max-w-6xl px-5"><div className="mb-14 text-center"><h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Así de sencillo</h2><p className="mt-3 text-gray-500">Tu QR se genera localmente en el navegador.</p></div>
          <div className="grid gap-6 sm:grid-cols-3">{steps.map((step) => <div key={step.step} className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm"><span className="text-4xl font-black text-gray-100">{step.step}</span><h3 className="mt-3 text-lg font-bold">{step.title}</h3><p className="mt-1.5 text-sm leading-relaxed text-gray-500">{step.text}</p></div>)}</div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-24"><div className="overflow-hidden rounded-3xl bg-gray-900 px-8 py-16 text-center"><h2 className="text-3xl font-bold text-white sm:text-4xl">Tu QR listo en segundos</h2><p className="mx-auto mt-3 max-w-md text-gray-400">Crea, personaliza y descarga. Si quieres conservar tus diseños, puedes usar una cuenta opcional.</p><Link href="/app" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3 text-sm font-bold text-gray-900 transition-all hover:bg-gray-100">Abrir generador <Download className="h-4 w-4" /></Link></div></section>

      <footer className="border-t border-gray-100 py-10"><div className="mx-auto max-w-6xl px-5"><SupportProject compact /><div className="mt-8 flex flex-col items-center justify-between gap-3 text-xs text-gray-400 sm:flex-row"><span className="flex items-center gap-2"><QrCode className="h-4 w-4 text-primary-600" />Q2R2</span><p>La creación anónima es local. Los QRs guardados se cifran en el servidor, que puede descifrarlos para tu cuenta; cualquier QR escaneable puede ser leído al escanearlo.</p><Link href="/app" className="font-medium text-primary-600">Crear QR</Link></div></div></footer>
    </div>
  )
}