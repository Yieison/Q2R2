import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import express from 'express'
import {
  QrEncryptionError,
  createQrKeyring,
  decryptQrPayload,
  encryptLegacyQrRecord,
  encryptQrPayload,
  isEncryptedQrData,
} from '../server/qr-crypto.js'
import {
  ENCRYPTED_QR_NAME,
  ENCRYPTED_QR_TYPE,
  migrateCoordinatedQrRecords,
  migrateLockedQrRecords,
} from '../server/qr-migration.js'
import { requestOrigin, requireSameOrigin } from '../server/origin.js'
import { validateQrPayload } from '../server/qr-validation.js'
import { isValidSupportAmount } from '../server/wompi.js'

const sessionSecret = 'test-session-secret-that-is-at-least-thirty-two-bytes'
const keyring = createQrKeyring({ sessionSecret })
const payload = {
  name: 'Menú',
  type: 'url',
  data: 'https://example.test/menu',
  style: {
    size: 256,
    bgColor: '#ffffff',
    fgColor: '#000000',
    level: 'M',
    includeMargin: true,
    dotStyle: 'square',
    cornerSquareStyle: 'square',
    cornerDotStyle: 'dot',
    useGradient: false,
    gradient: { type: 'linear', from: '#ffffff', to: '#000000', rotation: 0 },
    logo: {
      enabled: false,
      src: '',
      size: 0.32,
      margin: 6,
      hideBackgroundDots: true,
      syncColors: false,
      hasTransparentBackground: false,
      usePlate: false,
    },
  },
}

test('QR payload encryption round trips with owner and record context', () => {
  const envelope = encryptQrPayload(payload, { id: 17, userId: 9, keyring })
  assert.ok(isEncryptedQrData(envelope))
  assert.deepEqual(decryptQrPayload(envelope, { id: 17, userId: 9, keyring }), payload)
})

test('QR payload encryption rejects tampering and a different owner', () => {
  const envelope = encryptQrPayload(payload, { id: 17, userId: 9, keyring })
  assert.throws(
    () => decryptQrPayload(`${envelope}x`, { id: 17, userId: 9, keyring }),
    QrEncryptionError,
  )
  assert.throws(
    () => decryptQrPayload(envelope, { id: 17, userId: 10, keyring }),
    QrEncryptionError,
  )
})

test('legacy records migrate to neutral columns and remain decryptable', () => {
  const legacy = { id: 4, userId: 3, ...payload }
  const migrated = encryptLegacyQrRecord(legacy, keyring)
  assert.equal(migrated.name, '[encrypted]')
  assert.equal(migrated.type, 'encrypted')
  assert.deepEqual(migrated.style, {})
  assert.deepEqual(decryptQrPayload(migrated.data, { id: 4, userId: 3, keyring }), payload)
})

test('locked migration batches update only plaintext mock records', async () => {
  const legacy = { id: 4, userId: 3, ...payload }
  const encrypted = encryptQrPayload(payload, { id: 5, userId: 3, keyring })
  const existing = {
    id: 5,
    userId: 3,
    name: ENCRYPTED_QR_NAME,
    type: ENCRYPTED_QR_TYPE,
    data: encrypted,
    style: {},
  }
  const updates = []
  const migrated = await migrateLockedQrRecords([legacy, existing], {
    keyring,
    updateRecord: async (record, values) => updates.push({ id: record.id, values }),
  })
  assert.equal(migrated, 1)
  assert.equal(updates.length, 1)
  assert.equal(updates[0].id, legacy.id)
  assert.equal(updates[0].values.name, ENCRYPTED_QR_NAME)
  assert.deepEqual(
    decryptQrPayload(updates[0].values.data, { id: legacy.id, userId: legacy.userId, keyring }),
    payload,
  )
})

test('locked migration fails closed when an encrypted record has the wrong key', async () => {
  const encrypted = encryptQrPayload(payload, { id: 5, userId: 3, keyring })
  await assert.rejects(
    migrateLockedQrRecords([{
      id: 5,
      userId: 3,
      name: ENCRYPTED_QR_NAME,
      type: ENCRYPTED_QR_TYPE,
      data: encrypted,
      style: {},
    }], {
      keyring: createQrKeyring({ sessionSecret: 'another-test-session-secret-over-thirty-two-bytes' }),
      updateRecord: async () => assert.fail('encrypted records must not be rewritten'),
    }),
    QrEncryptionError,
  )
})

test('coordinated preflight makes no writes before a later wrong-key record', async () => {
  const legacyRows = Array.from({ length: 101 }, (_, index) => ({
    id: index + 1,
    userId: 3,
    ...payload,
  }))
  const protectedRow = {
    id: 102,
    userId: 3,
    name: ENCRYPTED_QR_NAME,
    type: ENCRYPTED_QR_TYPE,
    data: encryptQrPayload(payload, { id: 102, userId: 3, keyring }),
    style: {},
  }
  const rows = [...legacyRows, protectedRow]
  const updates = []
  await assert.rejects(
    migrateCoordinatedQrRecords({
      keyring: createQrKeyring({ sessionSecret: 'another-test-session-secret-over-thirty-two-bytes' }),
      batchSize: 100,
      readBatch: async (cursor, limit) => rows.filter((row) => row.id > cursor).slice(0, limit),
      updateRecord: async (record, values) => updates.push({ record, values }),
    }),
    QrEncryptionError,
  )
  assert.equal(updates.length, 0)
})

test('dedicated keys do not prevent decryption session-source records', () => {
  const sessionEnvelope = encryptQrPayload(payload, { id: 7, userId: 2, keyring })
  const withDedicatedKey = createQrKeyring({
    sessionSecret,
    dedicatedKey: 'a'.repeat(64),
  })
  assert.deepEqual(
    decryptQrPayload(sessionEnvelope, { id: 7, userId: 2, keyring: withDedicatedKey }),
    payload,
  )
})

test('QR and support amount validation rejects unsafe inputs', () => {
  assert.equal(isValidSupportAmount(5000), true)
  assert.equal(isValidSupportAmount(5001), false)
  assert.equal(isValidSupportAmount('5000'), false)
  const invalid = validateQrPayload({
    ...payload,
    style: { ...payload.style, logo: { ...payload.style.logo, enabled: true, src: 'https://example.test/logo.png' } },
  })
  assert.ok(invalid.error)
  const supportedUiStyle = {
    ...payload.style,
    cornerSquareStyle: 'classy-rounded',
    cornerSquareColor: '#1d4ed8',
    gradient: { ...payload.style.gradient, type: 'radial' },
  }
  assert.deepEqual(validateQrPayload({ ...payload, style: supportedUiStyle }).value.style, supportedUiStyle)
  assert.equal(
    validateQrPayload({ ...payload, style: payload.style }).value.style.cornerSquareColor,
    payload.style.fgColor,
  )
  assert.ok(validateQrPayload({ ...payload, style: { ...payload.style, cornerSquareColor: 'red' } }).error)
})

test('same-origin middleware accepts trusted-proxy HTTPS request format and rejects foreign origins', async () => {
  const makeRequest = (origin) => ({
    protocol: 'https',
    headers: {
      host: 'qr.example.test',
      origin,
      'x-forwarded-proto': 'https',
    },
    get(name) {
      return this.headers[name.toLowerCase()]
    },
  })
  const trusted = makeRequest('https://qr.example.test')
  assert.equal(requestOrigin(trusted), 'https://qr.example.test')
  let proceeded = false
  requireSameOrigin(trusted, {}, () => {
    proceeded = true
  })
  assert.equal(proceeded, true)

  const app = express()
  app.set('trust proxy', 1)
  app.post('/write', requireSameOrigin, (_req, res) => res.sendStatus(204))
  const server = createServer(app)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  const url = `http://127.0.0.1:${port}/write`
  try {
    const trustedResponse = await fetch(url, {
      method: 'POST',
      headers: {
        Origin: `https://127.0.0.1:${port}`,
        'X-Forwarded-Proto': 'https',
      },
    })
    assert.equal(trustedResponse.status, 204)
    const foreignResponse = await fetch(url, {
      method: 'POST',
      headers: {
        Origin: 'https://attacker.example.test',
        'X-Forwarded-Proto': 'https',
      },
    })
    assert.equal(foreignResponse.status, 403)
    assert.equal((await foreignResponse.json()).message, 'Origen de solicitud no válido')
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
})