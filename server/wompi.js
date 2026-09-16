import crypto from 'crypto'

export const SUPPORT_AMOUNTS_COP = Object.freeze([5000, 10000, 20000])
export const SUPPORT_CURRENCY = 'COP'

export function getWompiConfig() {
  const pick = (base, prod) => process.env[prod] || process.env[base] || ''
  const publicKey = pick('WOMPI_PUBLIC_KEY', 'WOMPI_PUBLIC_KEY_PROD')
  const privateKey = pick('WOMPI_PRIVATE_KEY', 'WOMPI_PRIVATE_KEY_PROD')
  const integritySecret = pick('WOMPI_INTEGRITY_SECRET', 'WOMPI_INTEGRITY_SECRET_PROD')
  const isTest = publicKey.startsWith('pub_test')
  return {
    publicKey,
    privateKey,
    integritySecret,
    apiBase: isTest ? 'https://sandbox.wompi.co/v1' : 'https://production.wompi.co/v1',
  }
}

export function isWompiConfigured() {
  const { publicKey, privateKey, integritySecret } = getWompiConfig()
  return Boolean(publicKey && privateKey && integritySecret)
}

export function isValidSupportAmount(amountCop) {
  return Number.isInteger(amountCop) && SUPPORT_AMOUNTS_COP.includes(amountCop)
}

export function buildIntegritySignature({ reference, amountInCents, currency, integritySecret }) {
  return crypto
    .createHash('sha256')
    .update(`${reference}${amountInCents}${currency}${integritySecret}`)
    .digest('hex')
}

export function buildCheckoutUrl({ publicKey, amountInCents, reference, signature, redirectUrl, currency = SUPPORT_CURRENCY }) {
  const params = [
    `public-key=${encodeURIComponent(publicKey)}`,
    `currency=${currency}`,
    `amount-in-cents=${amountInCents}`,
    `reference=${encodeURIComponent(reference)}`,
    `signature:integrity=${signature}`,
    `redirect-url=${encodeURIComponent(redirectUrl)}`,
  ].join('&')
  return `https://checkout.wompi.co/p/?${params}`
}

function supportReferenceSignature(body, integritySecret) {
  return crypto
    .createHmac('sha256', integritySecret)
    .update(`q2r2:support-reference:v1:${body}`)
    .digest('base64url')
    .slice(0, 24)
}

export function createSupportReference(integritySecret, now = Date.now()) {
  if (typeof integritySecret !== 'string' || !integritySecret) {
    throw new Error('Wompi support is not configured')
  }
  const body = `support-v1.${Math.floor(now).toString(36)}.${crypto.randomBytes(12).toString('base64url')}`
  return `${body}.${supportReferenceSignature(body, integritySecret)}`
}

export function verifySupportReference(reference, integritySecret, now = Date.now()) {
  if (typeof reference !== 'string' || typeof integritySecret !== 'string' || !integritySecret) return false
  const parts = reference.split('.')
  if (parts.length !== 4 || parts[0] !== 'support-v1' || !/^[0-9a-z]+$/.test(parts[1]) || !/^[A-Za-z0-9_-]{16}$/.test(parts[2]) || !/^[A-Za-z0-9_-]{24}$/.test(parts[3])) {
    return false
  }
  const timestamp = Number.parseInt(parts[1], 36)
  if (!Number.isSafeInteger(timestamp) || timestamp > now + 5 * 60_000 || now - timestamp > 31 * 24 * 60 * 60_000) {
    return false
  }
  const supplied = Buffer.from(parts[3])
  const expected = Buffer.from(supportReferenceSignature(parts.slice(0, 3).join('.'), integritySecret))
  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected)
}

export async function fetchWompiTransaction(id) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(id)) {
    throw new Error('Invalid transaction id')
  }
  const { apiBase, privateKey } = getWompiConfig()
  const res = await fetch(`${apiBase}/transactions/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${privateKey}` },
  })
  if (!res.ok) throw new Error('Wompi transaction lookup failed')
  const json = await res.json()
  return json?.data
}