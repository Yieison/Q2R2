import express from 'express'
import { registerRoutes } from './routes.js'
import { storage } from './storage.js'
import { setupVite, serveStatic, setupSeoFiles } from './vite.js'

const app = express()

app.use((req, res, next) => {
  const host = req.headers.host || ''
  if (host.startsWith('www.')) {
    const nonWww = host.slice(4)
    return res.redirect(301, `${req.protocol}://${nonWww}${req.originalUrl}`)
  }
  next()
})

app.use(express.json({ limit: '300kb' }))
app.use(express.urlencoded({ extended: false, limit: '300kb' }))

app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store')
  next()
})

const isProduction = process.env.NODE_ENV === 'production'

async function main() {
  const server = registerRoutes(app)

  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500
    const safeStatus = status >= 400 && status < 500 ? status : 500
    res.status(safeStatus).json({
      message: safeStatus === 413 ? 'La solicitud es demasiado grande' : 'Error interno del servidor',
    })
  })

  const migration = await storage.migrateAllQrCodes()
  console.info(`QR protection migration completed: ${migration.migrated} records migrated.`)

  setupSeoFiles(app)
  if (isProduction) {
    serveStatic(app)
  } else {
    await setupVite(app, server)
  }

  const port = Number(process.env.PORT) || 5000
  server.listen(port, '0.0.0.0', () => {
    console.log(`Servidor escuchando en el puerto ${port}`)
  })
}

main().catch((err) => {
  const message = err?.message === 'SESSION_SECRET must be a strong secret of at least 32 bytes' ||
    err?.message === 'QR_ENCRYPTION_KEY must be exactly 64 hexadecimal characters'
    ? err.message
    : 'No se pudo iniciar el servidor de forma segura.'
  console.error(`Error de inicio: ${message}`)
  process.exit(1)
})
