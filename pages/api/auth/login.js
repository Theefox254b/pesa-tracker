import { supabaseAdmin } from '../../../lib/supabase'
import { verifyPassword, signToken, setAuthCookie } from '../../../lib/auth'
import { rateLimit } from '../../../lib/rateLimit'

const checkLimit = rateLimit({ limit: 10, windowMs: 60 * 1000 }) // 10 attempts per minute per IP

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')

  // Rate limit check
  if (!checkLimit(req, res)) return

  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email and password required.' })

  const { data: user } = await supabaseAdmin
    .from('users').select('*').eq('email', email.toLowerCase().trim()).single()

  // Use same error message for both invalid email and wrong password
  // This prevents user enumeration attacks
  if (!user) return res.status(401).json({ error: 'Invalid email or password.' })

  const valid = await verifyPassword(password, user.password)
  if (!valid) return res.status(401).json({ error: 'Invalid email or password.' })

  const token = signToken({ id:user.id, email:user.email, name:user.name, role:user.role })
  setAuthCookie(res, token)
  return res.status(200).json({ user: { id:user.id, email:user.email, name:user.name, role:user.role } })
}
