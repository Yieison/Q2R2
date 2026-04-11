import { useState } from 'react'
import ColorThief from 'color-thief-browser'

const componentToHex = (value = 0) => {
  const clamped = Math.max(0, Math.min(255, Math.round(value)))
  return clamped.toString(16).padStart(2, '0')
}

const rgbArrayToHex = (rgb = []) => {
  const [r, g, b] = rgb
  if ([r, g, b].some(v => typeof v !== 'number' || Number.isNaN(v))) {
    return '#000000'
  }
  return `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`
}

const lightenHex = (hex, amount = 0.65) => {
  if (!hex || typeof hex !== 'string') return '#ffffff'
  const clean = hex.replace('#', '')
  if (clean.length !== 6) return hex
  const r = parseInt(clean.substring(0, 2), 16)
  const g = parseInt(clean.substring(2, 4), 16)
  const b = parseInt(clean.substring(4, 6), 16)
  const lighten = (channel) => Math.round(channel + (255 - channel) * amount)
  return `#${componentToHex(lighten(r))}${componentToHex(lighten(g))}${componentToHex(lighten(b))}`
}

const extractPaletteFromImage = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'Anonymous'
    image.src = src
    image.onload = () => {
      try {
        const thief = new ColorThief()
        const palette = thief.getPalette(image, 6)
        resolve(palette)
      } catch (error) {
        reject(error)
      }
    }
    image.onerror = reject
  })

const gradientTypes = [
  { label: 'Lineal', value: 'linear' },
  { label: 'Radial', value: 'radial' }
]

const QRStyler = ({ style, onChange }) => {
  const [logoInfo, setLogoInfo] = useState(null)

  const updateStyle = (field, value) => {
    onChange(prev => ({ ...prev, [field]: value }))
  }

  const updateLogo = (value) => {
    onChange(prev => ({ ...prev, logo: { ...prev.logo, ...value } }))
  }

  const updateGradient = (value) => {
    onChange(prev => ({ ...prev, gradient: { ...prev.gradient, ...value } }))
  }

  const applyLogoPalette = (src, paletteHex) => {
    onChange(prev => {
      const [primary, secondary, tertiary] = paletteHex ?? []
      let nextBg = prev.bgColor
      if (tertiary) {
        nextBg = lightenHex(tertiary, 0.75)
      } else if (primary) {
        nextBg = lightenHex(primary, 0.85)
      }

      return {
        ...prev,
        fgColor: primary ?? prev.fgColor,
        bgColor: nextBg,
        useGradient: secondary ? true : prev.useGradient,
        gradient: secondary
          ? { ...prev.gradient, from: primary ?? prev.gradient.from, to: secondary }
          : prev.gradient,
        logo: {
          ...prev.logo,
          enabled: true,
          src: src ?? prev.logo.src
        }
      }
    })
  }

  const handleLogoUpload = (file) => {
    if (!file) return
    setLogoInfo({
      name: file.name,
      type: file.type || 'desconocido',
      size: file.size || 0,
      loading: true
    })
    const reader = new FileReader()
    reader.onloadend = async () => {
      if (typeof reader.result !== 'string') return
      const src = reader.result
      const previewImage = new Image()
      previewImage.crossOrigin = 'Anonymous'
      previewImage.onload = async () => {
        try {
          const thief = new ColorThief()
          const palette = thief.getPalette(previewImage, 6)
          const hexPalette = palette?.map(rgbArrayToHex)
          applyLogoPalette(src, hexPalette)
        } catch (error) {
          applyLogoPalette(src)
        } finally {
          setLogoInfo({
            name: file.name,
            type: file.type || 'desconocido',
            size: file.size || 0,
            width: previewImage.width,
            height: previewImage.height
          })
        }
      }
      previewImage.onerror = () => {
        applyLogoPalette(src)
        setLogoInfo({
          name: file.name,
          type: file.type || 'desconocido',
          size: file.size || 0,
          error: 'No se pudo analizar la imagen'
        })
      }
      previewImage.src = src
    }
    reader.readAsDataURL(file)
  }

  const adaptColorsFromLogo = async () => {
    if (!style.logo.src) return
    try {
      const palette = await extractPaletteFromImage(style.logo.src)
      const hexPalette = palette?.map(rgbArrayToHex)
      applyLogoPalette(style.logo.src, hexPalette)
    } catch (error) {
      // Ignoramos el error y mantenemos los colores actuales
    }
  }

  const presetColors = [
    { name: 'Negro', fg: '#000000', bg: '#ffffff' },
    { name: 'Azul', fg: '#0ea5e9', bg: '#ffffff' },
    { name: 'Verde', fg: '#10b981', bg: '#ffffff' },
    { name: 'Púrpura', fg: '#8b5cf6', bg: '#ffffff' },
    { name: 'Rojo', fg: '#ef4444', bg: '#ffffff' },
    { name: 'Dorado', fg: '#f59e0b', bg: '#ffffff' }
  ]

  const sizes = [
    { label: 'Pequeño', value: 128 },
    { label: 'Mediano', value: 256 },
    { label: 'Grande', value: 384 },
    { label: 'Extra Grande', value: 512 }
  ]

  const dotStyles = [
    { label: 'Cuadrados', value: 'square' },
    { label: 'Puntos', value: 'dots' },
    { label: 'Redondeados', value: 'rounded' },
    { label: 'Classy', value: 'classy' },
    { label: 'Classy Soft', value: 'classy-rounded' }
  ]

  const cornerSquareStyles = [
    { label: 'Cuadrados', value: 'square' },
    { label: 'Extra Redondeados', value: 'extra-rounded' },
    { label: 'Classy', value: 'classy' },
    { label: 'Classy Soft', value: 'classy-rounded' },
    { label: 'Con Punto', value: 'dot' }
  ]

  const cornerDotStyles = [
    { label: 'Punto', value: 'dot' },
    { label: 'Cuadrado', value: 'square' }
  ]

  const errorLevels = [
    { label: 'Bajo (7%)', value: 'L' },
    { label: 'Medio (15%)', value: 'M' },
    { label: 'Alto (25%)', value: 'Q' },
    { label: 'Muy Alto (30%)', value: 'H' }
  ]

  return (
    <div className="space-y-6">
      {/* Size Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Tamaño
        </label>
        <div className="grid grid-cols-2 gap-2">
          {sizes.map(size => (
            <button
              key={size.value}
              onClick={() => updateStyle('size', size.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                style.size === size.value
                  ? 'bg-primary-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {size.label}
              <span className="block text-xs opacity-75">{size.value}px</span>
            </button>
          ))}
        </div>
      </div>

      {/* Color Presets */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Colores Predefinidos
        </label>
        <div className="grid grid-cols-3 gap-2">
          {presetColors.map(preset => (
            <button
              key={preset.name}
              onClick={() =>
                onChange(prev => ({
                  ...prev,
                  fgColor: preset.fg,
                  bgColor: preset.bg,
                }))
              }
              className="group relative p-3 border-2 rounded-lg hover:border-primary-400 transition-all"
              style={{ 
                borderColor: style.fgColor === preset.fg ? '#0ea5e9' : '#e5e7eb',
                backgroundColor: preset.bg
              }}
            >
              <div 
                className="w-full h-8 rounded"
                style={{ backgroundColor: preset.fg }}
              />
              <span className="text-xs font-medium text-gray-700 mt-1 block">
                {preset.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Custom Colors */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Color del QR
          </label>
          <div className="flex gap-2">
            <input
              type="color"
              value={style.fgColor}
              onChange={(e) => updateStyle('fgColor', e.target.value)}
              className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
            />
            <input
              type="text"
              value={style.fgColor}
              onChange={(e) => updateStyle('fgColor', e.target.value)}
              className="flex-1 input-field text-sm font-mono"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Color de Fondo
          </label>
          <div className="flex gap-2">
            <input
              type="color"
              value={style.bgColor}
              onChange={(e) => updateStyle('bgColor', e.target.value)}
              className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
            />
            <input
              type="text"
              value={style.bgColor}
              onChange={(e) => updateStyle('bgColor', e.target.value)}
              className="flex-1 input-field text-sm font-mono"
            />
          </div>
        </div>
      </div>

      {/* Gradient & Dynamic Colors */}
      <div className="card-light space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">
              Colores dinámicos
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Activa degradados o sincroniza la paleta con el logo.
            </p>
          </div>
          <button
            onClick={() => updateStyle('useGradient', !style.useGradient)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              style.useGradient ? 'bg-primary-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                style.useGradient ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {style.useGradient ? (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">
                  Color inicial
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={style.gradient.from}
                    onChange={(e) => updateGradient({ from: e.target.value })}
                    className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={style.gradient.from}
                    onChange={(e) => updateGradient({ from: e.target.value })}
                    className="flex-1 input-field text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">
                  Color final
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={style.gradient.to}
                    onChange={(e) => updateGradient({ to: e.target.value })}
                    className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={style.gradient.to}
                    onChange={(e) => updateGradient({ to: e.target.value })}
                    className="flex-1 input-field text-sm font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">
                  Tipo de degradado
                </label>
                <select
                  value={style.gradient.type}
                  onChange={(e) => updateGradient({ type: e.target.value })}
                  className="input-field"
                >
                  {gradientTypes.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">
                  Ángulo (°)
                </label>
                <input
                  type="range"
                  min="0"
                  max="360"
                  step="1"
                  value={style.gradient.rotation}
                  onChange={(e) => updateGradient({ rotation: Number(e.target.value) })}
                  disabled={style.gradient.type !== 'linear'}
                  className={`range-slider ${
                    style.gradient.type !== 'linear' ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {style.gradient.type === 'linear'
                    ? `${style.gradient.rotation}°`
                    : 'No aplica para degradados radiales'}
                </p>
              </div>
            </div>

            <div
              className="h-12 rounded-lg border border-gray-200"
              style={{
                background:
                  style.gradient.type === 'linear'
                    ? `linear-gradient(${style.gradient.rotation}deg, ${style.gradient.from}, ${style.gradient.to})`
                    : `radial-gradient(circle, ${style.gradient.from}, ${style.gradient.to})`
              }}
            />
          </div>
        ) : (
          <p className="text-xs text-gray-500">
            Activa el interruptor para aplicar degradados personalizados.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={adaptColorsFromLogo}
            disabled={!style.logo.src}
            className={`btn-secondary text-sm ${
              !style.logo.src ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            Adaptar colores desde el logo
          </button>
        </div>
      </div>

      {/* Dot Styles */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Estilo del Patrón (módulos)
        </label>
        <div className="grid sm:grid-cols-3 gap-2">
          {dotStyles.map(styleOption => (
            <button
              key={styleOption.value}
              onClick={() => updateStyle('dotStyle', styleOption.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                style.dotStyle === styleOption.value
                  ? 'bg-primary-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {styleOption.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Personaliza la forma de cada módulo del código QR.
        </p>
      </div>

      {/* Corner Styles */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Marcos de las esquinas
          </label>
          <div className="grid grid-cols-1 gap-2">
            {cornerSquareStyles.map(option => (
              <button
                key={option.value}
                onClick={() => updateStyle('cornerSquareStyle', option.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all text-left ${
                  style.cornerSquareStyle === option.value
                    ? 'bg-primary-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Centro de las esquinas
          </label>
          <div className="grid grid-cols-1 gap-2">
            {cornerDotStyles.map(option => (
              <button
                key={option.value}
                onClick={() => updateStyle('cornerDotStyle', option.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all text-left ${
                  style.cornerDotStyle === option.value
                    ? 'bg-primary-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Logo Options */}
      <div className="card-light">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Logo central</h3>
            <p className="text-xs text-gray-500 mt-1">
              Añade un logotipo sobre el código QR. Usa imágenes PNG o SVG.
            </p>
          </div>
          <button
            onClick={() => updateLogo({ enabled: !style.logo.enabled })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              style.logo.enabled ? 'bg-primary-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                style.logo.enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {style.logo.enabled && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                onChange={(e) => handleLogoUpload(e.target.files?.[0])}
                className="file-input"
              />
              {style.logo.src && (
                <button
                  onClick={() => updateLogo({ src: '', enabled: false })}
                  className="btn-secondary text-sm"
                >
                  Quitar logo
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500">
              Formatos soportados: PNG, JPG, SVG. Recomendado mínimo 512×512 px.
            </p>

            {style.logo.src && (
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">
                    Tamaño relativo
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="0.45"
                    step="0.01"
                    value={style.logo.size}
                    onChange={(e) => updateLogo({ size: Number(e.target.value) })}
                    className="range-slider"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {Math.round(style.logo.size * 100)}% del ancho del QR
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">
                    Margen
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    step="1"
                    value={style.logo.margin}
                    onChange={(e) => updateLogo({ margin: Number(e.target.value) })}
                    className="range-slider"
                  />
                  <p className="text-xs text-gray-500 mt-1">{style.logo.margin}px</p>
                </div>
              </div>
            )}

            {style.logo.src && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="hide-dots"
                  checked={style.logo.hideBackgroundDots}
                  onChange={(e) => updateLogo({ hideBackgroundDots: e.target.checked })}
                  className="w-4 h-4 text-primary-600 rounded focus:ring-2 focus:ring-primary-500"
                />
                <label htmlFor="hide-dots" className="text-xs text-gray-600">
                  Ocultar patrones detrás del logo
                </label>
              </div>
            )}

            {style.logo.src && (
              <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg border border-gray-100">
                <img
                  src={style.logo.src}
                  alt="Logo"
                  className="h-12 w-12 object-contain rounded"
                />
                <div className="text-xs text-gray-500 space-y-1">
                  <p>Previsualización del logo cargado.</p>
                  {logoInfo && !logoInfo.loading && (
                    <div className="space-y-1">
                      <p>
                        {logoInfo.width && logoInfo.height
                          ? `${logoInfo.width}×${logoInfo.height}px`
                          : 'Resolución desconocida'}
                        {' · '}
                        {logoInfo.type?.toUpperCase() || 'Formato desconocido'}
                        {' · '}
                        {logoInfo.size
                          ? `${(logoInfo.size / 1024).toFixed(1)} KB`
                          : ''}
                      </p>
                      {logoInfo.error && (
                        <p className="text-red-500">{logoInfo.error}</p>
                      )}
                      {logoInfo.width && logoInfo.height && (logoInfo.width < 256 || logoInfo.height < 256) && (
                        <p className="text-amber-600">
                          Considera usar una imagen de mayor resolución para evitar pixelado.
                        </p>
                      )}
                    </div>
                  )}
                  {logoInfo && logoInfo.loading && (
                    <p>Analizando logo…</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error Correction Level */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Nivel de Corrección de Errores
        </label>
        <div className="grid grid-cols-2 gap-2">
          {errorLevels.map(level => (
            <button
              key={level.value}
              onClick={() => updateStyle('level', level.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                style.level === level.value
                  ? 'bg-primary-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {level.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Mayor nivel = más resistente a daños, pero QR más denso
        </p>
      </div>

      {/* Margin Toggle */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Incluir Margen
          </label>
          <p className="text-xs text-gray-500 mt-1">
            Espacio blanco alrededor del QR
          </p>
        </div>
        <button
          onClick={() => updateStyle('includeMargin', !style.includeMargin)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            style.includeMargin ? 'bg-primary-600' : 'bg-gray-300'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              style.includeMargin ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    </div>
  )
}

export default QRStyler
