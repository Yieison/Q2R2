import { useEffect, useRef, useState } from 'react'
import QRCodeStyling from 'qr-code-styling'
import { 
  Link, 
  Type, 
  Wifi, 
  Mail, 
  Phone, 
  Download,
  Palette,
  Settings,
  QrCode
} from 'lucide-react'
import QRInput from './components/QRInput'
import QRStyler from './components/QRStyler'

function App() {
  const [qrType, setQrType] = useState('url')
  const [qrData, setQrData] = useState('')
  const [qrStyle, setQrStyle] = useState({
    size: 256,
    bgColor: '#ffffff',
    fgColor: '#000000',
    level: 'M',
    includeMargin: true,
    dotStyle: 'square',
    cornerSquareStyle: 'square',
    cornerDotStyle: 'dot',
    useGradient: false,
    gradient: {
      type: 'linear',
      from: '#0ea5e9',
      to: '#0369a1',
      rotation: 45
    },
    logo: {
      enabled: false,
      src: '',
      size: 0.32,
      margin: 6,
      hideBackgroundDots: true
    }
  })
  
  const qrContainerRef = useRef(null)
  const qrInstanceRef = useRef(null)
  const currentYear = new Date().getFullYear()

  const computeDotsOptions = () => {
    if (qrStyle.useGradient) {
      return {
        type: qrStyle.dotStyle,
        gradient: {
          type: qrStyle.gradient.type,
          rotation: (qrStyle.gradient.rotation * Math.PI) / 180,
          colorStops: [
            { offset: 0, color: qrStyle.gradient.from },
            { offset: 1, color: qrStyle.gradient.to }
          ]
        }
      }
    }

    return {
      type: qrStyle.dotStyle,
      color: qrStyle.fgColor
    }
  }

  useEffect(() => {
    if (!qrInstanceRef.current) {
      qrInstanceRef.current = new QRCodeStyling({
        width: qrStyle.size,
        height: qrStyle.size,
        data: qrData || ' ',
        margin: qrStyle.includeMargin ? 16 : 0,
        qrOptions: {
          errorCorrectionLevel: qrStyle.level
        },
        backgroundOptions: {
          color: qrStyle.bgColor
        },
        dotsOptions: computeDotsOptions(),
        cornersSquareOptions: {
          color: qrStyle.fgColor,
          type: qrStyle.cornerSquareStyle
        },
        cornersDotOptions: {
          color: qrStyle.fgColor,
          type: qrStyle.cornerDotStyle
        },
        image: qrStyle.logo.enabled && qrStyle.logo.src ? qrStyle.logo.src : undefined,
        imageOptions: {
          hideBackgroundDots: qrStyle.logo.hideBackgroundDots,
          imageSize: qrStyle.logo.size,
          margin: qrStyle.logo.margin,
          crossOrigin: 'anonymous'
        }
      })
    }

    if (qrContainerRef.current && qrInstanceRef.current) {
      qrContainerRef.current.innerHTML = ''
      qrInstanceRef.current.append(qrContainerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!qrInstanceRef.current) {
      return
    }

    qrInstanceRef.current.update({
      data: qrData || ' ',
      width: qrStyle.size,
      height: qrStyle.size,
      margin: qrStyle.includeMargin ? 16 : 0,
      qrOptions: {
        errorCorrectionLevel: qrStyle.level
      },
      backgroundOptions: {
        color: qrStyle.bgColor
      },
      dotsOptions: computeDotsOptions(),
      cornersSquareOptions: {
        color: qrStyle.fgColor,
        type: qrStyle.cornerSquareStyle
      },
      cornersDotOptions: {
        color: qrStyle.fgColor,
        type: qrStyle.cornerDotStyle
      },
      image: qrStyle.logo.enabled && qrStyle.logo.src ? qrStyle.logo.src : undefined,
      imageOptions: {
        hideBackgroundDots: qrStyle.logo.hideBackgroundDots,
        imageSize: qrStyle.logo.size,
        margin: qrStyle.logo.margin,
        crossOrigin: 'anonymous'
      }
    })
  }, [
    qrData,
    qrStyle.size,
    qrStyle.bgColor,
    qrStyle.fgColor,
    qrStyle.level,
    qrStyle.includeMargin,
    qrStyle.dotStyle,
    qrStyle.cornerSquareStyle,
    qrStyle.cornerDotStyle,
    qrStyle.useGradient,
    qrStyle.gradient,
    qrStyle.logo
  ])

  const qrTypes = [
    { id: 'url', name: 'URL', icon: Link },
    { id: 'text', name: 'Texto', icon: Type },
    { id: 'wifi', name: 'WiFi', icon: Wifi },
    { id: 'email', name: 'Email', icon: Mail },
    { id: 'phone', name: 'Teléfono', icon: Phone }
  ]

  const downloadQR = () => {
    if (!qrData || !qrInstanceRef.current) {
      return
    }

    qrInstanceRef.current.download({
      extension: 'png',
      name: `qr-code-${Date.now()}`
    })
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <QrCode className="w-12 h-12 text-primary-600" />
            <h1 className="text-5xl font-bold bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">
              Gen QR
            </h1>
          </div>
          <p className="text-gray-600 text-lg">
            Genera códigos QR modernos y personalizables para cualquier propósito
          </p>
        </header>

        {/* Main Content */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Panel - Configuration */}
          <div className="space-y-6">
            {/* QR Type Selector */}
            <div className="card">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary-600" />
                Tipo de QR
              </h2>
              <div className="flex flex-wrap gap-2">
                {qrTypes.map(type => {
                  const Icon = type.icon
                  return (
                    <button
                      key={type.id}
                      onClick={() => {
                        setQrType(type.id)
                        setQrData('')
                      }}
                      className={`tab-button ${
                        qrType === type.id 
                          ? 'tab-button-active' 
                          : 'tab-button-inactive'
                      }`}
                    >
                      <Icon className="w-4 h-4 inline mr-2" />
                      {type.name}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* QR Input */}
            <div className="card">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Type className="w-5 h-5 text-primary-600" />
                Contenido
              </h2>
              <QRInput 
                type={qrType} 
                value={qrData} 
                onChange={setQrData}
              />
            </div>

            {/* QR Styler */}
            <div className="card">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Palette className="w-5 h-5 text-primary-600" />
                Personalización
              </h2>
              <QRStyler 
                style={qrStyle} 
                onChange={setQrStyle}
              />
            </div>
          </div>

          {/* Right Panel - Preview & Download */}
          <div className="lg:sticky lg:top-8 h-fit space-y-6">
            <div className="card">
              <h2 className="text-xl font-semibold mb-6 text-center">
                Vista Previa
              </h2>
              
              {/* QR Code Display */}
              <div 
                className="flex justify-center items-center p-8 bg-gray-50 rounded-lg mb-6 min-h-[320px]"
              >
                <div
                  ref={qrContainerRef}
                  className={`${qrData ? 'block' : 'hidden'} transition-all duration-300 ease-in-out`}
                />
                {!qrData && (
                  <div className="text-center text-gray-400">
                    <QrCode className="w-24 h-24 mx-auto mb-4 opacity-20" />
                    <p className="text-sm">
                      Ingresa contenido para generar tu código QR
                    </p>
                  </div>
                )}
              </div>

              {/* Download Button */}
              <button
                onClick={downloadQR}
                disabled={!qrData}
                className={`w-full btn-primary flex items-center justify-center gap-2 ${
                  !qrData ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <Download className="w-5 h-5" />
                Descargar QR
              </button>

              {/* Info */}
              {qrData && (
                <div className="mt-4 p-4 bg-primary-50 rounded-lg border border-primary-100">
                  <div className="flex flex-wrap gap-2">
                    <span className="badge">
                      {qrTypes.find(t => t.id === qrType)?.name}
                    </span>
                    <span className="badge">
                      {qrStyle.size}px
                    </span>
                    <span className="badge">
                      Nivel {qrStyle.level}
                    </span>
                    <span className="badge">
                      {qrStyle.dotStyle}
                    </span>
                    <span className="badge">
                      esquinas {qrStyle.cornerSquareStyle}/{qrStyle.cornerDotStyle}
                    </span>
                    {qrStyle.useGradient && (
                      <span className="badge">
                        degradado
                      </span>
                    )}
                    {qrStyle.logo.enabled && qrStyle.logo.src && (
                      <span className="badge">
                        Logo activo
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="card bg-slate-900 text-slate-100">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Sugerencias de estilo
              </h3>
              <ul className="space-y-2 text-sm text-slate-200/80">
                <li>• Usa niveles de corrección altos cuando agregues un logo.</li>
                <li>• Combina módulos en puntos con esquinas redondeadas para un look fluido.</li>
                <li>• Ajusta el margen del logo si oculta demasiado el patrón.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-16 text-center text-gray-500 text-sm">
          <p>© {currentYear} Gen QR · Hecho con talento colombiano</p>
        </footer>
      </div>
    </div>
  )
}

export default App
