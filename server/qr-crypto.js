import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from 'crypto'

const ENVELOPE_VERSION = 'qre1'
const HKDF_SALT = 'q2r2:qr-storage:key-derivation:v1'
const HKDF_INFO = 'q2r2:qr-storage:aes-256-gcm:v1'

export class QrEncryptionError extends Error {
  constructor() {
    super('No se pudo procesar el código QR protegido')
  }
}

function requireSessionSecret(sessionSecret) {
  if (typeof sessionSecret !== 'string' || Buffer.byteLength(sessionSecret, 'utf8') < 32) {
    throw new Error('SESSION_SECRET must be a strong secret of at least 32 bytes')
  }
  return sessionSecret
}

export function deriveSessionQrKey(sessionSecret) {
  const secret = requireSessionSecret(sessionSecret)
  return Buffer.from(hkdfSync('sha256', secret, HKDF_SALT, HKDF_INFO, 32))
}

function parseDedicatedKey(value) {
  if (value == null || value === '') return null
  if (typeof value !== 'string' || !/^[a-fA-F0-9]{64}$/.test(value)) {
    throw new Error('QR_ENCRYPTION_KEY must be exactly 64 hexadecimal characters')
  }
  return Buffer.from(value, 'hex')
}

export function createQrKeyring({ sessionSecret, dedicatedKey } = {}) {
  const sessionKey = deriveSessionQrKey(
    sessionSecret === undefined ? process.env.SESSION_SECRET : sessionSecret,
  )
  const dedicated = parseDedicatedKey(
    dedicatedKey === undefined ? process.env.QR_ENCRYPTION_KEY : dedicatedKey,
  )
  return {
    activeSource: dedicated ? 'dedicated' : 'session',
    keys: { session: sessionKey, ...(dedicated ? { dedicated } : {}) },
  }
}

export function getQrKeyring() {
  return createQrKeyring()
}

function aad(source, userId, id) {
  return Buffer.from(`${ENVELOPE_VERSION}|${source}|${userId}|${id}`, 'utf8')
}

function keyFor(keyring, source) {
  const key = keyring?.keys?.[source]
  if (!key || !Buffer.isBuffer(key) || key.length !== 32) throw new QrEncryptionError()
  return key
}

function decodeBase64Url(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('invalid encoding')
  const decoded = Buffer.from(value, 'base64url')
  if (!decoded.length || decoded.toString('base64url') !== value) throw new Error('invalid encoding')
  return decoded
}

export function isEncryptedQrData(value) {
  return typeof value === 'string' && value.startsWith(`${ENVELOPE_VERSION}.`)
}

export function encryptQrPayload(payload, { id, userId, keyring = getQrKeyring() }) {
  try {
    if (!Number.isInteger(id) || !Number.isInteger(userId)) throw new Error('invalid context')
    const source = keyring.activeSource
    const key = keyFor(keyring, source)
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    cipher.setAAD(aad(source, userId, id))
    const plaintext = Buffer.from(JSON.stringify(payload), 'utf8')
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()])
    return `${ENVELOPE_VERSION}.${source}.${iv.toString('base64url')}.${encrypted.toString('base64url')}`
  } catch (error) {
    if (error instanceof QrEncryptionError) throw error
    throw new QrEncryptionError()
  }
}

export function decryptQrPayload(envelope, { id, userId, keyring = getQrKeyring() }) {
  try {
    if (!Number.isInteger(id) || !Number.isInteger(userId) || typeof envelope !== 'string') {
      throw new Error('invalid input')
    }
    const [version, source, ivText, encryptedText, ...extra] = envelope.split('.')
    if (
      version !== ENVELOPE_VERSION ||
      !['session', 'dedicated'].includes(source) ||
      !ivText ||
      !encryptedText ||
      extra.length
    ) {
      throw new Error('invalid envelope')
    }
    const iv = decodeBase64Url(ivText)
    const encrypted = decodeBase64Url(encryptedText)
    if (iv.length !== 12 || encrypted.length <= 16) throw new Error('invalid envelope')
    const decipher = createDecipheriv('aes-256-gcm', keyFor(keyring, source), iv)
    decipher.setAAD(aad(source, userId, id))
    decipher.setAuthTag(encrypted.subarray(-16))
    const plaintext = Buffer.concat([
      decipher.update(encrypted.subarray(0, -16)),
      decipher.final(),
    ]).toString('utf8')
    const payload = JSON.parse(plaintext)
    if (
      !payload ||
      typeof payload !== 'object' ||
      Array.isArray(payload) ||
      typeof payload.name !== 'string' ||
      typeof payload.type !== 'string' ||
      typeof payload.data !== 'string' ||
      !payload.style ||
      typeof payload.style !== 'object' ||
      Array.isArray(payload.style)
    ) {
      throw new Error('invalid payload')
    }
    return payload
  } catch {
    throw new QrEncryptionError()
  }
}

export function encryptLegacyQrRecord(record, keyring = getQrKeyring()) {
  if (!record || isEncryptedQrData(record.data)) throw new QrEncryptionError()
  const payload = {
    name: record.name,
    type: record.type,
    data: record.data,
    style: record.style,
  }
  return {
    ...record,
    name: '[encrypted]',
    type: 'encrypted',
    data: encryptQrPayload(payload, { ...record, keyring }),
    style: {},
  }
}

export function safeReferenceEquals(left, right) {
  const a = Buffer.from(String(left))
  const b = Buffer.from(String(right))
  return a.length === b.length && timingSafeEqual(a, b)
}