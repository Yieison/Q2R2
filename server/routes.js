import { createServer } from 'http'
import { setupAuth } from './auth.js'
import { storage } from './storage.js'
import { getQrKeyring } from './qr-crypto.js'
import { validateQrPayload } from './qr-validation.js'
import { createRateLimit } from './rate-limit.js'
import { requireSameOrigin, requestOrigin } from './origin.js'
import {
  SUPPORT_AMOUNTS_COP,
  SUPPORT_CURRENCY,
  buildCheckoutUrl,
  buildIntegritySignature,
  createSupportReference,
  fetchWompiTransaction,
  getWompiConfig,
  isValidSupportAmount,
  isWompiConfigured,
  verifySupportReference,
} from './wompi.js'

function requireAuth(req, res, next) {
  if (!req.isAuthenticated()) return res.status(401).json({ message: 'No autenticado' })
  next()
}

function parseId(value) {
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

function appRedirectUrl(req) {
  const origin = requestOrigin(req)
  if (!origin) throw new Error('Invalid host')
  return `${origin}/apoyo/resultado`
}

const qrWriteLimit = createRateLimit({
  windowMs: 60_000,
  max: 60,
  key: (req) => `qr:${req.user?.id || req.ip}`,
})
const qrReadLimit = createRateLimit({
  windowMs: 60_000,
  max: 120,
  key: (req) => `qr-read:${req.user?.id || req.ip}`,
})
const supportLimit = createRateLimit({ windowMs: 15 * 60_000, max: 10 })

export function registerRoutes(app) {
  // Fails closed during startup if the session-derived encryption key cannot be made.
  getQrKeyring()
  setupAuth(app)

  app.get('/api/support', (_req, res) => {
    res.json({
      available: isWompiConfigured(),
      currency: SUPPORT_CURRENCY,
      amounts: SUPPORT_AMOUNTS_COP,
    })
  })

  app.post('/api/support/checkout', requireSameOrigin, supportLimit, (req, res, next) => {
    try {
      if (!isWompiConfigured()) {
        return res.status(503).json({ message: 'Los aportes no están configurados.' })
      }
      const amountCop = req.body?.amountCop
      if (!isValidSupportAmount(amountCop)) {
        return res.status(400).json({ message: 'Monto de aporte no válido' })
      }
      const cfg = getWompiConfig()
      const reference = createSupportReference(cfg.integritySecret)
      const amountInCents = amountCop * 100
      const checkoutUrl = buildCheckoutUrl({
        publicKey: cfg.publicKey,
        amountInCents,
        reference,
        signature: buildIntegritySignature({
          reference,
          amountInCents,
          currency: SUPPORT_CURRENCY,
          integritySecret: cfg.integritySecret,
        }),
        redirectUrl: appRedirectUrl(req),
        currency: SUPPORT_CURRENCY,
      })
      res.json({ checkoutUrl })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/support/result', supportLimit, async (req, res, next) => {
    try {
      if (!isWompiConfigured()) {
        return res.status(503).json({ message: 'Los aportes no están configurados.' })
      }
      const id = typeof req.query.id === 'string' ? req.query.id : ''
      if (!id) return res.status(400).json({ message: 'Falta el id de la transacción' })
      const transaction = await fetchWompiTransaction(id)
      const cfg = getWompiConfig()
      const reference = transaction?.reference
      const amountInCents = transaction?.amount_in_cents
      if (
        !verifySupportReference(reference, cfg.integritySecret) ||
        transaction?.currency !== SUPPORT_CURRENCY ||
        !Number.isInteger(amountInCents) ||
        !isValidSupportAmount(amountInCents / 100)
      ) {
        return res.status(404).json({ message: 'Aporte no encontrado' })
      }
      const status = ['PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR'].includes(transaction.status)
        ? transaction.status
        : 'UNKNOWN'
      res.json({ status, amountCop: amountInCents / 100, currency: SUPPORT_CURRENCY })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/qrcodes', requireAuth, qrReadLimit, async (req, res, next) => {
    try {
      res.json(await storage.getQrCodes(req.user.id))
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/qrcodes', requireAuth, requireSameOrigin, qrWriteLimit, async (req, res, next) => {
    try {
      const checked = validateQrPayload(req.body)
      if (checked.error) return res.status(400).json({ message: checked.error })
      res.status(201).json(await storage.createQrCode(req.user.id, checked.value))
    } catch (error) {
      next(error)
    }
  })

  app.put('/api/qrcodes/:id', requireAuth, requireSameOrigin, qrWriteLimit, async (req, res, next) => {
    try {
      const id = parseId(req.params.id)
      if (!id) return res.status(400).json({ message: 'ID inválido' })
      const checked = validateQrPayload(req.body)
      if (checked.error) return res.status(400).json({ message: checked.error })
      const updated = await storage.updateQrCode(id, req.user.id, checked.value)
      if (!updated) return res.status(404).json({ message: 'QR no encontrado' })
      res.json(updated)
    } catch (error) {
      next(error)
    }
  })

  app.delete('/api/qrcodes/:id', requireAuth, requireSameOrigin, qrWriteLimit, async (req, res, next) => {
    try {
      const id = parseId(req.params.id)
      if (!id) return res.status(400).json({ message: 'ID inválido' })
      if (!(await storage.deleteQrCode(id, req.user.id))) {
        return res.status(404).json({ message: 'QR no encontrado' })
      }
      res.sendStatus(204)
    } catch (error) {
      next(error)
    }
  })

  return createServer(app)
}