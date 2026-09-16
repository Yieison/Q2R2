const HOST_PATTERN = /^(?:[a-z0-9.-]+|\[[a-f0-9:]+\])(?::\d{1,5})?$/i

export function requestOrigin(req) {
  const host = req.get('host')
  if (!host || host.length > 255 || !HOST_PATTERN.test(host)) return null
  try {
    return new URL(`${req.protocol}://${host}`).origin
  } catch {
    return null
  }
}

export function requireSameOrigin(req, res, next) {
  const expected = requestOrigin(req)
  const origin = req.get('origin')
  if (!expected || !origin || origin !== expected) {
    return res.status(403).json({ message: 'Origen de solicitud no válido' })
  }
  next()
}