import passport from 'passport'
import { Strategy as LocalStrategy } from 'passport-local'
import session from 'express-session'
import { scrypt, randomBytes, timingSafeEqual } from 'crypto'
import { promisify } from 'util'
import { storage } from './storage.js'
import { createRateLimit } from './rate-limit.js'
import { requireSameOrigin } from './origin.js'

const scryptAsync = promisify(scrypt)
const USERNAME_PATTERN = /^[A-Za-z0-9._-]+$/

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const buf = await scryptAsync(password, salt, 64)
  return `${buf.toString('hex')}.${salt}`
}

async function comparePasswords(supplied, stored) {
  if (typeof supplied !== 'string' || typeof stored !== 'string') return false
  const [hashed, salt] = stored.split('.')
  if (!/^[a-f0-9]{128}$/i.test(hashed || '') || !/^[a-f0-9]{32}$/i.test(salt || '')) return false
  const hashedBuf = Buffer.from(hashed, 'hex')
  const suppliedBuf = await scryptAsync(supplied, salt, 64)
  return hashedBuf.length === suppliedBuf.length && timingSafeEqual(hashedBuf, suppliedBuf)
}

export function sanitizeUser(user) {
  if (!user) return user
  return {
    id: user.id,
    username: user.username,
    createdAt: user.createdAt,
  }
}

export function validateAuthInput(body, { registering = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Credenciales no válidas' }
  }
  if (typeof body.username !== 'string' || typeof body.password !== 'string') {
    return { error: 'Credenciales no válidas' }
  }
  const username = body.username.trim()
  const password = body.password
  if (username.length < 3 || username.length > 50 || byteLength(username) > 50) {
    return { error: 'El usuario debe tener entre 3 y 50 caracteres' }
  }
  if (registering && !USERNAME_PATTERN.test(username)) {
    return { error: 'El usuario contiene caracteres no válidos' }
  }
  if (password.length < (registering ? 8 : 1) || password.length > 128 || byteLength(password) > 128) {
    return { error: registering ? 'La contraseña debe tener entre 8 y 128 caracteres' : 'Credenciales no válidas' }
  }
  return { value: { username, password } }
}

function byteLength(value) {
  return Buffer.byteLength(value, 'utf8')
}

const registerLimit = createRateLimit({ windowMs: 15 * 60_000, max: 5 })
const loginLimit = createRateLimit({
  windowMs: 15 * 60_000,
  max: 10,
  key: (req) => `login:${req.ip}:${typeof req.body?.username === 'string' ? req.body.username.slice(0, 50) : ''}`,
})

function parseTrustProxy(value) {
  if (value === undefined || value === '') return 1
  if (value === 'false') return false
  if (value === 'true') return true
  return /^\d+$/.test(value) ? Number(value) : value
}

export function setupAuth(app) {
  const isProduction = process.env.NODE_ENV === 'production'
  const sessionSecret = process.env.SESSION_SECRET
  if (typeof sessionSecret !== 'string' || Buffer.byteLength(sessionSecret, 'utf8') < 32) {
    throw new Error('SESSION_SECRET must be a strong secret of at least 32 bytes')
  }

  app.set('trust proxy', parseTrustProxy(process.env.TRUST_PROXY))
  app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 30,
    },
  }))
  app.use(passport.initialize())
  app.use(passport.session())

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        if (typeof username !== 'string' || typeof password !== 'string') return done(null, false)
        const user = await storage.getUserByUsername(username)
        if (!user || !(await comparePasswords(password, user.password))) return done(null, false)
        return done(null, user)
      } catch (error) {
        return done(error)
      }
    }),
  )

  passport.serializeUser((user, done) => done(null, user.id))
  passport.deserializeUser(async (id, done) => {
    try {
      done(null, await storage.getUser(id))
    } catch (error) {
      done(error)
    }
  })

  app.post('/api/register', requireSameOrigin, registerLimit, async (req, res, next) => {
    try {
      const checked = validateAuthInput(req.body, { registering: true })
      if (checked.error) return res.status(400).json({ message: checked.error })
      const { username, password } = checked.value
      if (await storage.getUserByUsername(username)) {
        return res.status(409).json({ message: 'No se pudo crear la cuenta' })
      }
      const user = await storage.createUser({ username, password: await hashPassword(password) })
      req.login(user, (error) => {
        if (error) return next(error)
        res.status(201).json(sanitizeUser(user))
      })
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/login', requireSameOrigin, loginLimit, (req, res, next) => {
    const checked = validateAuthInput(req.body)
    if (checked.error) return res.status(400).json({ message: checked.error })
    req.body.username = checked.value.username
    passport.authenticate('local', (error, user) => {
      if (error) return next(error)
      if (!user) return res.status(401).json({ message: 'Usuario o contraseña incorrectos' })
      req.login(user, (loginError) => {
        if (loginError) return next(loginError)
        res.status(200).json(sanitizeUser(user))
      })
    })(req, res, next)
  })

  app.post('/api/logout', requireSameOrigin, (req, res, next) => {
    req.logout((error) => {
      if (error) return next(error)
      req.session.destroy((destroyError) => {
        if (destroyError) return next(destroyError)
        res.clearCookie('connect.sid')
        res.sendStatus(200)
      })
    })
  })

  app.get('/api/user', (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401)
    res.json(sanitizeUser(req.user))
  })
}