export const QR_LIMITS = Object.freeze({
  nameBytes: 120,
  dataBytes: 8192,
  logoDataUriBytes: 192 * 1024,
  payloadBytes: 256 * 1024,
})

const TYPES = new Set(['url', 'text', 'wifi', 'email', 'phone'])
const DOT_STYLES = new Set(['square', 'dots', 'rounded', 'classy', 'classy-rounded', 'extra-rounded'])
const CORNER_STYLES = new Set(['square', 'dot', 'extra-rounded', 'classy', 'classy-rounded'])
const LEVELS = new Set(['L', 'M', 'Q', 'H'])
const TOP_LEVEL_STYLE_FIELDS = new Set([
  'size',
  'bgColor',
  'fgColor',
  'level',
  'includeMargin',
  'dotStyle',
  'cornerSquareStyle',
  'cornerSquareColor',
  'cornerDotStyle',
  'useGradient',
  'gradient',
  'logo',
])
const GRADIENT_FIELDS = new Set(['type', 'from', 'to', 'rotation'])
const LOGO_FIELDS = new Set([
  'enabled',
  'src',
  'size',
  'margin',
  'hideBackgroundDots',
  'syncColors',
  'hasTransparentBackground',
  'usePlate',
  'renderSrc',
])

const byteLength = (value) => Buffer.byteLength(value, 'utf8')
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const hasOnly = (value, allowed) => Object.keys(value).every((key) => allowed.has(key))
const isColor = (value) => typeof value === 'string' && /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(value)

function styleError() {
  return { error: 'El estilo del QR no es válido' }
}

function validateLogo(logo) {
  if (!isObject(logo) || !hasOnly(logo, LOGO_FIELDS)) return styleError()
  const {
    enabled,
    src = '',
    size,
    margin,
    hideBackgroundDots,
    syncColors,
    hasTransparentBackground,
    usePlate,
  } = logo
  if (
    typeof enabled !== 'boolean' ||
    typeof src !== 'string' ||
    typeof size !== 'number' ||
    !Number.isFinite(size) ||
    size < 0.05 ||
    size > 0.4 ||
    !Number.isInteger(margin) ||
    margin < 0 ||
    margin > 32 ||
    typeof hideBackgroundDots !== 'boolean' ||
    typeof syncColors !== 'boolean' ||
    typeof hasTransparentBackground !== 'boolean' ||
    typeof usePlate !== 'boolean'
  ) {
    return styleError()
  }
  if (src) {
    if (
      byteLength(src) > QR_LIMITS.logoDataUriBytes ||
      !/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/]+={0,2}$/i.test(src)
    ) {
      return styleError()
    }
  }
  if (enabled && !src) return styleError()
  if (
    Object.hasOwn(logo, 'renderSrc') &&
    (typeof logo.renderSrc !== 'string' || byteLength(logo.renderSrc) > QR_LIMITS.logoDataUriBytes)
  ) {
    return styleError()
  }
  // renderSrc is a browser-only rendering cache and is intentionally never persisted.
  return {
    value: {
      enabled,
      src,
      size,
      margin,
      hideBackgroundDots,
      syncColors,
      hasTransparentBackground,
      usePlate,
    },
  }
}

export function validateQrStyle(style) {
  if (!isObject(style) || !hasOnly(style, TOP_LEVEL_STYLE_FIELDS)) return styleError()
  const {
    size,
    bgColor,
    fgColor,
    level,
    includeMargin,
    dotStyle,
    cornerSquareStyle,
    cornerSquareColor = fgColor,
    cornerDotStyle,
    useGradient,
    gradient,
    logo,
  } = style
  if (
    !Number.isInteger(size) ||
    size < 64 ||
    size > 2048 ||
    !isColor(bgColor) ||
    !isColor(fgColor) ||
    !isColor(cornerSquareColor) ||
    !LEVELS.has(level) ||
    typeof includeMargin !== 'boolean' ||
    !DOT_STYLES.has(dotStyle) ||
    !CORNER_STYLES.has(cornerSquareStyle) ||
    !CORNER_STYLES.has(cornerDotStyle) ||
    typeof useGradient !== 'boolean' ||
    !isObject(gradient) ||
    !hasOnly(gradient, GRADIENT_FIELDS) ||
    !['linear', 'radial'].includes(gradient.type) ||
    !isColor(gradient.from) ||
    !isColor(gradient.to) ||
    typeof gradient.rotation !== 'number' ||
    !Number.isFinite(gradient.rotation) ||
    gradient.rotation < 0 ||
    gradient.rotation > 360
  ) {
    return styleError()
  }
  const checkedLogo = validateLogo(logo)
  if (checkedLogo.error) return checkedLogo
  return {
    value: {
      size,
      bgColor,
      fgColor,
      level,
      includeMargin,
      dotStyle,
      cornerSquareStyle,
      cornerSquareColor,
      cornerDotStyle,
      useGradient,
      gradient: {
        type: gradient.type,
        from: gradient.from,
        to: gradient.to,
        rotation: gradient.rotation,
      },
      logo: checkedLogo.value,
    },
  }
}

export function validateQrPayload(body) {
  if (!isObject(body)) return { error: 'Solicitud de QR no válida' }
  if (typeof body.name !== 'string' || typeof body.type !== 'string' || typeof body.data !== 'string') {
    return { error: 'Solicitud de QR no válida' }
  }
  const name = body.name.trim()
  const type = body.type.trim()
  const data = body.data
  if (!name) return { error: 'El nombre es obligatorio' }
  if (byteLength(name) > QR_LIMITS.nameBytes) return { error: 'El nombre es demasiado largo' }
  if (!TYPES.has(type)) return { error: 'Tipo de QR no válido' }
  if (!data.trim()) return { error: 'El contenido del QR es obligatorio' }
  if (byteLength(data) > QR_LIMITS.dataBytes) return { error: 'El contenido del QR es demasiado largo' }
  const checkedStyle = validateQrStyle(body.style)
  if (checkedStyle.error) return checkedStyle
  const value = { name, type, data, style: checkedStyle.value }
  if (byteLength(JSON.stringify(value)) > QR_LIMITS.payloadBytes) {
    return { error: 'El QR es demasiado grande' }
  }
  return { value }
}