import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { parse, serialize } from 'cookie'

const JWT_SECRET = process.env.JWT_SECRET
const COOKIE_NAME = 'pesa_token'

// ── Password helpers ──────────────────────────────────────────────────────────
export async function hashPassword(plain) {
  return bcrypt.hash(plain, 12)
}
export async function verifyPassword(plain, hashed) {
  return bcrypt.compare(plain, hashed)
}

// ── JWT helpers ───────────────────────────────────────────────────────────────
export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' })
}
export function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET) }
  catch { return null }
}

// ── Cookie helpers ────────────────────────────────────────────────────────────
export function setAuthCookie(res, token) {
  res.setHeader('Set-Cookie', serialize(COOKIE_NAME, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   60 * 60 * 24 * 30,   // 30 days
    path:     '/',
  }))
}
export function clearAuthCookie(res) {
  res.setHeader('Set-Cookie', serialize(COOKIE_NAME, '', { maxAge: -1, path: '/' }))
}

// ── Middleware — get authenticated user from request ─────────────────────────
export function getUser(req) {
  const cookies = parse(req.headers.cookie || '')
  const token   = cookies[COOKIE_NAME]
  if (!token) return null
  return verifyToken(token)
}

// ── Route guard — wrap API handlers that require auth ────────────────────────
export function withAuth(handler) {
  return async (req, res) => {
    const user = getUser(req)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })
    req.user = user
    return handler(req, res)
  }
}
