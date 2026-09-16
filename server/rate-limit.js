export function createRateLimit({ windowMs, max, key = (req) => req.ip || 'unknown' }) {
  const attempts = new Map()

  return (req, res, next) => {
    const now = Date.now()
    const identity = String(key(req)).slice(0, 200)
    const previous = attempts.get(identity)
    const entry = !previous || previous.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : previous
    entry.count += 1
    attempts.set(identity, entry)
    if (attempts.size > 10_000) {
      for (const [candidate, value] of attempts) {
        if (value.resetAt <= now || attempts.size > 9_000) attempts.delete(candidate)
      }
    }
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)))
      return res.status(429).json({ message: 'Demasiados intentos. Inténtalo más tarde.' })
    }
    next()
  }
}