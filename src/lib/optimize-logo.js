export const MAX_LOGO_FILE_BYTES = 4 * 1024 * 1024
export const MAX_LOGO_BYTES = 48 * 1024
export const MAX_LOGO_DIMENSION = 384

const supportedTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])

export function loadLogoImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('No se pudo leer la imagen del logo.'))
    image.src = src
  })
}

async function validateSvg(file) {
  const text = await file.text()
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) {
    throw new Error('El SVG contiene referencias no permitidas. Usa un PNG o WebP.')
  }
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
  if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'svg') {
    throw new Error('El archivo SVG no es válido.')
  }
  for (const node of doc.querySelectorAll('*')) {
    if (['script', 'foreignobject', 'iframe', 'object', 'embed', 'style', 'animate', 'set'].includes(node.localName.toLowerCase())) {
      throw new Error('Usa un SVG estático sin scripts ni contenido externo.')
    }
    for (const attr of node.attributes) {
      if (/^on/i.test(attr.localName) || /@import|javascript:/i.test(attr.value) ||
        (attr.localName === 'href' && !attr.value.startsWith('#')) ||
        (/url\s*\(/i.test(attr.value) && !/^url\(\s*['"]?#[\w-]+['"]?\s*\)$/i.test(attr.value))) {
        throw new Error('El SVG contiene recursos externos. Expórtalo como PNG o WebP.')
      }
    }
  }
}

export function fitLogoDimensions(width, height, max = MAX_LOGO_DIMENSION) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('El logo no tiene dimensiones válidas.')
  }
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

function toBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('No se pudo optimizar el logo.')), type, quality)
  })
}

function toDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('No se pudo preparar el logo.'))
    reader.readAsDataURL(blob)
  })
}

export async function optimizeLogoImage(image) {
  const originalWidth = image.naturalWidth || image.width
  const originalHeight = image.naturalHeight || image.height
  if (originalWidth > 8192 || originalHeight > 8192 || originalWidth * originalHeight > 16_777_216) {
    throw new Error('El logo es demasiado grande. Usa una imagen de hasta 16 megapíxeles y 8192 px por lado.')
  }
  for (const max of [MAX_LOGO_DIMENSION, 288, 192, 128]) {
    const { width, height } = fitLogoDimensions(originalWidth, originalHeight, max)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Tu navegador no permite procesar imágenes.')
    context.drawImage(image, 0, 0, width, height)
    const png = await toBlob(canvas, 'image/png')
    if (png.size <= MAX_LOGO_BYTES) {
      return { src: await toDataUrl(png), size: png.size, width, height, type: png.type }
    }
    for (const quality of [0.85, 0.7]) {
      const webp = await toBlob(canvas, 'image/webp', quality)
      if (webp.size <= MAX_LOGO_BYTES) {
        return { src: await toDataUrl(webp), size: webp.size, width, height, type: webp.type }
      }
    }
  }
  throw new Error('No se pudo reducir el logo a 48 KB. Prueba con una imagen más sencilla.')
}

export async function optimizeLogoFile(file) {
  if (!supportedTypes.has(file.type)) throw new Error('Usa una imagen PNG, JPG, WebP o SVG estático.')
  if (file.size > MAX_LOGO_FILE_BYTES) throw new Error('El archivo del logo debe pesar como máximo 4 MB.')
  if (file.type === 'image/svg+xml') await validateSvg(file)
  const url = URL.createObjectURL(file)
  try {
    return await optimizeLogoImage(await loadLogoImage(url))
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function optimizeLegacySvg(src) {
  const match = /^data:image\/svg\+xml((?:;[^,]*)?),(.*)$/is.exec(src)
  if (!match) throw new Error('El formato del logo no es válido.')
  let bytes
  try {
    bytes = /;base64/i.test(match[1])
      ? Uint8Array.from(atob(match[2]), char => char.charCodeAt(0))
      : new TextEncoder().encode(decodeURIComponent(match[2]))
  } catch {
    throw new Error('No se pudo leer el SVG guardado.')
  }
  return optimizeLogoFile(new File([bytes], 'logo.svg', { type: 'image/svg+xml' }))
}