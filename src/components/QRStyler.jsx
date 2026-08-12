import { useEffect, useState } from 'react'

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

const hexToRgb = (hex = '') => {
  const clean = hex.replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(clean)) return null

  return [
    parseInt(clean.substring(0, 2), 16),
    parseInt(clean.substring(2, 4), 16),
    parseInt(clean.substring(4, 6), 16)
  ]
}

const getRelativeLuminance = ([red = 0, green = 0, blue = 0]) => {
  const normalize = (channel) => {
    const value = channel / 255
    return value <= 0.03928
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4
  }

  return 0.2126 * normalize(red) + 0.7152 * normalize(green) + 0.0722 * normalize(blue)
}

const getContrastRatio = (left, right) => {
  const leftRgb = hexToRgb(left)
  const rightRgb = hexToRgb(right)
  if (!leftRgb || !rightRgb) return null

  const lighter = Math.max(getRelativeLuminance(leftRgb), getRelativeLuminance(rightRgb))
  const darker = Math.min(getRelativeLuminance(leftRgb), getRelativeLuminance(rightRgb))
  return (lighter + 0.05) / (darker + 0.05)
}

const getSaturation = (red = 0, green = 0, blue = 0) => {
  const max = Math.max(red, green, blue) / 255
  const min = Math.min(red, green, blue) / 255
  return max === 0 ? 0 : (max - min) / max
}

const getColorDistance = (left = [], right = []) => {
  const [leftRed = 0, leftGreen = 0, leftBlue = 0] = left
  const [rightRed = 0, rightGreen = 0, rightBlue = 0] = right
  return Math.sqrt(
    (leftRed - rightRed) ** 2 +
    (leftGreen - rightGreen) ** 2 +
    (leftBlue - rightBlue) ** 2
  )
}

const darkenHex = (hex, amount = 0.18) => {
  if (!hex || typeof hex !== 'string') return '#000000'
  const clean = hex.replace('#', '')
  if (clean.length !== 6) return hex
  const red = parseInt(clean.substring(0, 2), 16)
  const green = parseInt(clean.substring(2, 4), 16)
  const blue = parseInt(clean.substring(4, 6), 16)
  const darken = (channel) => Math.round(channel * (1 - amount))
  return `#${componentToHex(darken(red))}${componentToHex(darken(green))}${componentToHex(darken(blue))}`
}

const quantizeChannel = (value = 0, step = 12) => {
  const quantized = Math.round(value / step) * step
  return Math.max(0, Math.min(255, quantized))
}

const cleanupLegacyColorThiefCanvases = () => {
  if (typeof document === 'undefined') return
  document.querySelectorAll('body > canvas').forEach((canvas) => canvas.remove())
}

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'Anonymous'
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = src
  })

const analyzeImageElement = (image, colorCount = 6, quality = 5) => {
  const width = image.naturalWidth || image.width
  const height = image.naturalHeight || image.height

  if (!width || !height) {
    return { palette: [], hasTransparency: false }
  }

  const scale = Math.min(1, 220 / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))

  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) {
    return { palette: [], hasTransparency: false }
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
  const buckets = new Map()
  let hasTransparency = false

  for (let index = 0; index < data.length; index += 4 * quality) {
    const red = data[index]
    const green = data[index + 1]
    const blue = data[index + 2]
    const alpha = data[index + 3]

    if (alpha < 245) hasTransparency = true
    if (alpha < 150) continue

    const rgb = [red, green, blue]
    const saturation = getSaturation(red, green, blue)
    const luminance = getRelativeLuminance(rgb)

    if (luminance > 0.92 && saturation < 0.2) continue

    const key = [
      quantizeChannel(red),
      quantizeChannel(green),
      quantizeChannel(blue)
    ].join(',')
    const bucket = buckets.get(key) ?? {
      count: 0,
      score: 0,
      red: 0,
      green: 0,
      blue: 0
    }
    const score = (0.75 + saturation * 1.4) * (1 + (1 - luminance) * 0.35)

    bucket.count += 1
    bucket.score += score
    bucket.red += red
    bucket.green += green
    bucket.blue += blue
    buckets.set(key, bucket)
  }

  const palette = [...buckets.values()]
    .sort((left, right) => right.score - left.score)
    .map((bucket) => [
      Math.round(bucket.red / bucket.count),
      Math.round(bucket.green / bucket.count),
      Math.round(bucket.blue / bucket.count)
    ])
    .reduce((colors, color) => {
      const isDistinct = colors.every((existing) => getColorDistance(existing, color) > 34)
      return isDistinct && colors.length < colorCount ? [...colors, color] : colors
    }, [])

  return { palette, hasTransparency }
}

const getVisibleImageBounds = (image) => {
  const width = image.naturalWidth || image.width
  const height = image.naturalHeight || image.height

  if (!width || !height) return null

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null

  context.drawImage(image, 0, 0, width, height)
  const { data } = context.getImageData(0, 0, width, height)
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3]
      if (alpha <= 24) continue

      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }

  if (maxX < minX || maxY < minY) {
    return { x: 0, y: 0, width, height }
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  }
}

const drawRoundedRect = (context, x, y, width, height, radius) => {
  const safeRadius = Math.min(radius, width / 2, height / 2)

  context.beginPath()
  context.moveTo(x + safeRadius, y)
  context.lineTo(x + width - safeRadius, y)
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius)
  context.lineTo(x + width, y + height - safeRadius)
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height)
  context.lineTo(x + safeRadius, y + height)
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius)
  context.lineTo(x, y + safeRadius)
  context.quadraticCurveTo(x, y, x + safeRadius, y)
  context.closePath()
}

const createLogoPlateSrc = (image) => {
  const bounds = getVisibleImageBounds(image)
  if (!bounds) return ''

  const scale = Math.min(1, 760 / bounds.width, 300 / bounds.height)
  const logoWidth = Math.max(1, Math.round(bounds.width * scale))
  const logoHeight = Math.max(1, Math.round(bounds.height * scale))
  const paddingX = Math.max(18, Math.min(42, Math.round(logoWidth * 0.08)))
  const paddingY = Math.max(12, Math.min(28, Math.round(logoHeight * 0.18)))
  const shadowPadding = 10
  const plateWidth = logoWidth + paddingX * 2
  const plateHeight = logoHeight + paddingY * 2
  const canvas = document.createElement('canvas')
  canvas.width = plateWidth + shadowPadding * 2
  canvas.height = plateHeight + shadowPadding * 2

  const context = canvas.getContext('2d')
  if (!context) return ''

  const radius = Math.min(plateHeight / 2, 26)
  const x = shadowPadding
  const y = shadowPadding

  context.shadowColor = 'rgba(15, 23, 42, 0.12)'
  context.shadowBlur = 10
  context.shadowOffsetY = 3
  context.fillStyle = '#ffffff'
  drawRoundedRect(context, x, y, plateWidth, plateHeight, radius)
  context.fill()

  context.shadowColor = 'transparent'
  context.strokeStyle = 'rgba(15, 23, 42, 0.10)'
  context.lineWidth = 1
  drawRoundedRect(context, x + 0.5, y + 0.5, plateWidth - 1, plateHeight - 1, radius)
  context.stroke()

  context.drawImage(
    image,
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
    x + paddingX,
    y + paddingY,
    logoWidth,
    logoHeight
  )

  return canvas.toDataURL('image/png')
}

const extractPaletteFromImage = (src) =>
  loadImage(src).then((image) => analyzeImageElement(image).palette)

const gradientTypes = [
  { label: 'Lineal', value: 'linear' },
  { label: 'Radial', value: 'radial' }
]

const QRStyler = ({ style, onChange }) => {
  const [logoInfo, setLogoInfo] = useState(null)

  useEffect(() => {
    cleanupLegacyColorThiefCanvases()
  }, [])

  const updateStyle = (field, value) => {
    onChange(prev => ({ ...prev, [field]: value }))
  }

  const updateForegroundColor = (value) => {
    onChange(prev => ({
      ...prev,
      fgColor: value,
      cornerSquareColor: prev.cornerSquareColor === prev.fgColor
        ? value
        : prev.cornerSquareColor
    }))
  }

  const updateLogo = (value) => {
    onChange(prev => ({ ...prev, logo: { ...prev.logo, ...value } }))
  }

  const updateGradient = (value) => {
    onChange(prev => ({ ...prev, gradient: { ...prev.gradient, ...value } }))
  }

  const getLogoPalettePatch = (prev, paletteHex = []) => {
    const [primary, secondary] = paletteHex
    if (!primary) return {}

    return {
      fgColor: primary,
      cornerSquareColor: prev.cornerSquareColor === prev.fgColor
        ? primary
        : prev.cornerSquareColor,
      gradient: prev.useGradient
        ? {
            ...prev.gradient,
            from: primary,
            to: secondary ?? darkenHex(primary)
          }
        : prev.gradient
    }
  }

  const applyLogoPalette = (src, paletteHex, options = {}) => {
    onChange(prev => {
      const shouldSyncColors = options.force || prev.logo.syncColors
      const colorPatch = shouldSyncColors
        ? getLogoPalettePatch(prev, paletteHex)
        : {}

      return {
        ...prev,
        ...colorPatch,
        logo: {
          ...prev.logo,
          enabled: true,
          src: src ?? prev.logo.src,
          ...(options.logo ?? {}),
          ...(typeof options.syncColors === 'boolean'
            ? { syncColors: options.syncColors }
            : {})
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

      try {
        cleanupLegacyColorThiefCanvases()
        const previewImage = await loadImage(src)
        const { palette, hasTransparency } = analyzeImageElement(previewImage)
        const hexPalette = palette?.map(rgbArrayToHex)
        const width = previewImage.naturalWidth || previewImage.width
        const height = previewImage.naturalHeight || previewImage.height
        const aspectRatio = height ? width / height : 1
        const plateSrc = hasTransparency ? createLogoPlateSrc(previewImage) : ''
        const shouldRestoreCleanArea =
          style.logo.hasTransparentBackground &&
          !hasTransparency &&
          !style.logo.hideBackgroundDots
        const logoPatch = {
          hasTransparentBackground: hasTransparency,
          renderSrc: plateSrc,
          usePlate: hasTransparency && Boolean(plateSrc),
          size: hasTransparency && aspectRatio > 1.7
            ? Math.min(style.logo.size, 0.34)
            : Math.min(style.logo.size, 0.38),
          ...(hasTransparency ? { hideBackgroundDots: false, margin: 0 } : {}),
          ...(shouldRestoreCleanArea ? { hideBackgroundDots: true } : {})
        }

        applyLogoPalette(src, hexPalette, { logo: logoPatch })
        setLogoInfo({
          name: file.name,
          type: file.type || 'desconocido',
          size: file.size || 0,
          width: previewImage.naturalWidth || previewImage.width,
          height: previewImage.naturalHeight || previewImage.height,
          hasTransparency
        })
      } catch (error) {
        applyLogoPalette(src, undefined, {
          logo: {
            hasTransparentBackground: false,
            renderSrc: '',
            usePlate: false
          }
        })
        setLogoInfo({
          name: file.name,
          type: file.type || 'desconocido',
          size: file.size || 0,
          error: 'No se pudo analizar la imagen'
        })
      } finally {
        cleanupLegacyColorThiefCanvases()
      }
    }
    reader.readAsDataURL(file)
  }

  const adaptColorsFromLogo = async (options = {}) => {
    if (!style.logo.src) return
    try {
      const palette = await extractPaletteFromImage(style.logo.src)
      const hexPalette = palette?.map(rgbArrayToHex)
      applyLogoPalette(style.logo.src, hexPalette, {
        force: true,
        syncColors: options.syncColors ?? true
      })
    } catch (error) {
      updateLogo({ syncColors: options.syncColors ?? style.logo.syncColors })
    }
  }

  const toggleLogoColorSync = async () => {
    const syncColors = !style.logo.syncColors

    if (!syncColors) {
      updateLogo({ syncColors })
      return
    }

    if (!style.logo.src) {
      updateLogo({ syncColors })
      return
    }

    await adaptColorsFromLogo({ syncColors })
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
    { label: 'Extra Grande', value: 512 },
    { label: 'HD', value: 768 },
    { label: 'Alta Resolución', value: 1024 },
    { label: 'Impresión', value: 2048 }
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

  const cornerSquareColor = style.cornerSquareColor ?? style.fgColor
  const cornerContrast = getContrastRatio(cornerSquareColor, style.bgColor)
  const cornerRgb = hexToRgb(cornerSquareColor)
  const backgroundRgb = hexToRgb(style.bgColor)
  const hasRecommendedCornerContrast = cornerContrast !== null &&
    cornerRgb !== null &&
    backgroundRgb !== null &&
    cornerContrast >= 4.5 &&
    getRelativeLuminance(cornerRgb) < getRelativeLuminance(backgroundRgb)

  return (
    <div className="space-y-6">
      {/* Size Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Tamaño
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                  cornerSquareColor: preset.fg,
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
              onChange={(e) => updateForegroundColor(e.target.value)}
              className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
            />
            <input
              type="text"
              value={style.fgColor}
              onChange={(e) => updateForegroundColor(e.target.value)}
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
            onClick={toggleLogoColorSync}
            disabled={!style.logo.src}
            className={`text-sm ${
              style.logo.syncColors ? 'btn-primary' : 'btn-secondary'
            } ${!style.logo.src ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {style.logo.syncColors
              ? 'Colores del logo activos'
              : 'Adaptar colores desde el logo'}
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
          <div className="flex items-center justify-between gap-2 mb-3">
            <label className="block text-sm font-medium text-gray-700">
              Marcos de las esquinas
            </label>
            {cornerSquareColor !== style.fgColor && (
              <button
                type="button"
                onClick={() => updateStyle('cornerSquareColor', style.fgColor)}
                className="text-xs font-medium text-primary-600 hover:text-primary-700"
              >
                Igualar al QR
              </button>
            )}
          </div>
          <label className="block text-xs font-medium text-gray-600 mb-2">
            Color del borde
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="color"
              value={cornerSquareColor}
              onChange={(e) => updateStyle('cornerSquareColor', e.target.value)}
              className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
            />
            <input
              type="text"
              value={cornerSquareColor}
              onChange={(e) => updateStyle('cornerSquareColor', e.target.value)}
              className="flex-1 input-field text-sm font-mono"
              aria-label="Color del borde de los marcadores de posición"
            />
          </div>
          {cornerContrast !== null && (
            <p className={`text-xs mb-3 ${
              hasRecommendedCornerContrast ? 'text-emerald-700' : 'text-amber-700'
            }`}>
              Contraste {cornerContrast.toFixed(1)}:1.{' '}
              {hasRecommendedCornerContrast
                ? 'Buena separación frente al fondo.'
                : 'Usa un borde más oscuro que el fondo y procura al menos 4.5:1.'}
            </p>
          )}
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
                  onClick={() => updateLogo({
                    src: '',
                    renderSrc: '',
                    enabled: false,
                    usePlate: false,
                    hasTransparentBackground: false
                  })}
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
                    max="0.38"
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
                    disabled={style.logo.usePlate}
                    className={`range-slider ${
                      style.logo.usePlate ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {style.logo.usePlate ? 'Automático con placa' : style.logo.margin + 'px'}
                  </p>
                </div>
              </div>
            )}

            {style.logo.src && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="hide-dots"
                    checked={style.logo.hasTransparentBackground
                      ? style.logo.usePlate
                      : style.logo.hideBackgroundDots}
                    onChange={(e) => {
                      if (style.logo.hasTransparentBackground) {
                        updateLogo({ usePlate: e.target.checked, hideBackgroundDots: false })
                        return
                      }

                      updateLogo({ hideBackgroundDots: e.target.checked })
                    }}
                    className="w-4 h-4 text-primary-600 rounded focus:ring-2 focus:ring-primary-500"
                  />
                  <label htmlFor="hide-dots" className="text-xs text-gray-600">
                    {style.logo.hasTransparentBackground
                      ? 'Placa compacta detrás del logo'
                      : 'Área limpia detrás del logo'}
                  </label>
                </div>
                {style.logo.hasTransparentBackground && style.logo.usePlate && (
                  <p className="text-xs text-gray-500">
                    Usa una placa redondeada para separar el logo sin abrir un hueco grande.
                  </p>
                )}
              </div>
            )}

            {style.logo.src && (
              <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg border border-gray-100">
                <img
                  src={style.logo.usePlate && style.logo.renderSrc ? style.logo.renderSrc : style.logo.src}
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
