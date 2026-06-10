/**
 * Simple in-memory rate limiter
 * Limits requests per IP to prevent brute force attacks
 */
const store = new Map()

export function rateLimit({ limit = 5, windowMs = 60 * 1000 } = {}) {
  return function check(req, res) {
    const ip =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      'unknown'

    const now = Date.now()
    const key = `${ip}:${req.url}`

    if (!store.has(key)) {
      store.set(key, { count: 1, start: now })
      return true
    }

    const entry = store.get(key)

    // Reset window if expired
    if (now - entry.start > windowMs) {
      store.set(key, { count: 1, start: now })
      return true
    }

    entry.count++

    if (entry.count > limit) {
      res.setHeader('Retry-After', Math.ceil((entry.start + windowMs - now) / 1000))
      res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' })
      return false
    }

    return true
  }
}

// Clean up old entries every 5 minutes to avoid memory leaks
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (now - entry.start > 5 * 60 * 1000) store.delete(key)
  }
}, 5 * 60 * 1000)
