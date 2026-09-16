import QRCodeStyling from 'qr-code-styling'
import { buildQrOptions } from '@shared/qr-options'

function slugify(name, fallback = 'codigo-qr') {
  const slug = (name || '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
  return slug || fallback
}

export async function downloadQrPng({ data, style, name }) {
  const qr = new QRCodeStyling(buildQrOptions(data, style))
  const blob = await qr.getRawData('png')
  if (!blob) throw new Error('No se pudo generar el archivo PNG')

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${slugify(name)}.png`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}