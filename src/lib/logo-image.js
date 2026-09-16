import { loadLogoImage, MAX_LOGO_BYTES, MAX_LOGO_DIMENSION, optimizeLogoImage, optimizeLegacySvg } from './optimize-logo.js'

export { loadLogoImage }

function getVisibleImageBounds(image) {
  const width = image.naturalWidth || image.width
  const height = image.naturalHeight || image.height
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('No se pudo preparar el fondo del logo.')
  context.drawImage(image, 0, 0, width, height)
  const { data } = context.getImageData(0, 0, width, height)
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] <= 24) continue
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }
  return maxX < minX || maxY < minY
    ? { x: 0, y: 0, width, height }
    : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

function drawRoundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2)
  context.beginPath()
  context.moveTo(x + r, y)
  context.lineTo(x + width - r, y)
  context.quadraticCurveTo(x + width, y, x + width, y + r)
  context.lineTo(x + width, y + height - r)
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  context.lineTo(x + r, y + height)
  context.quadraticCurveTo(x, y + height, x, y + height - r)
  context.lineTo(x, y + r)
  context.quadraticCurveTo(x, y, x + r, y)
  context.closePath()
}

export function createLogoPlateSrc(image) {
  const bounds = getVisibleImageBounds(image)
  const scale = Math.min(1, 760 / bounds.width, 300 / bounds.height)
  const logoWidth = Math.max(1, Math.round(bounds.width * scale))
  const logoHeight = Math.max(1, Math.round(bounds.height * scale))
  const paddingX = Math.max(18, Math.min(42, Math.round(logoWidth * 0.08)))
  const paddingY = Math.max(12, Math.min(28, Math.round(logoHeight * 0.18)))
  const padding = 10
  const width = logoWidth + paddingX * 2
  const height = logoHeight + paddingY * 2
  const canvas = document.createElement('canvas')
  canvas.width = width + padding * 2
  canvas.height = height + padding * 2
  const context = canvas.getContext('2d')
  if (!context) throw new Error('No se pudo preparar el fondo del logo.')
  const radius = Math.min(height / 2, 26)
  context.shadowColor = 'rgba(15, 23, 42, 0.12)'
  context.shadowBlur = 10
  context.shadowOffsetY = 3
  context.fillStyle = '#ffffff'
  drawRoundedRect(context, padding, padding, width, height, radius)
  context.fill()
  context.shadowColor = 'transparent'
  context.strokeStyle = 'rgba(15, 23, 42, 0.10)'
  context.lineWidth = 1
  drawRoundedRect(context, padding + 0.5, padding + 0.5, width - 1, height - 1, radius)
  context.stroke()
  context.drawImage(image, bounds.x, bounds.y, bounds.width, bounds.height,
    padding + paddingX, padding + paddingY, logoWidth, logoHeight)
  return canvas.toDataURL('image/png')
}

function isLocalLogo(src) {
  return /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=\s]+$/i.test(src)
}

export async function hydrateLogoStyle(style) {
  let logo = style.logo
  if (!logo?.src) return style
  if (/^data:image\/svg\+xml[;,]/i.test(logo.src)) {
    logo = { ...logo, src: (await optimizeLegacySvg(logo.src)).src, renderSrc: '' }
    style = { ...style, logo }
  }
  if (!isLocalLogo(logo.src)) throw new Error('Vuelve a cargar el logo como PNG, JPG o WebP.')
  if (!logo.usePlate || logo.renderSrc) return style
  const image = await loadLogoImage(logo.src)
  return { ...style, logo: { ...logo, renderSrc: createLogoPlateSrc(image) } }
}

export async function compactStyleForStorage(style) {
  if (!style.logo) return style
  const { renderSrc, ...logo } = style.logo
  if (logo.src) {
    if (/^data:image\/svg\+xml[;,]/i.test(logo.src)) logo.src = (await optimizeLegacySvg(logo.src)).src
    if (!isLocalLogo(logo.src)) throw new Error('Vuelve a cargar el logo para optimizarlo.')
    const image = await loadLogoImage(logo.src)
    const byteEstimate = (logo.src.split(',')[1]?.length || 0) * 0.75
    if (byteEstimate > MAX_LOGO_BYTES || image.naturalWidth > MAX_LOGO_DIMENSION || image.naturalHeight > MAX_LOGO_DIMENSION) {
      logo.src = (await optimizeLogoImage(image)).src
    }
  }
  return { ...style, logo }
}