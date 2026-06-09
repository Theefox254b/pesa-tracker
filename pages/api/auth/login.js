import { supabaseAdmin } from '../../../lib/supabase'
import { verifyPassword, signToken, setAuthCookie } from '../../../lib/auth'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email and password required.' })

  const { data: user } = await supabaseAdmin.from('users').select('*').eq('email', email.toLowerCase()).single()
  if (!user) return res.status(401).json({ error: 'Invalid email or password.' })

  const valid = await verifyPassword(password, user.password)
  if (!valid) return res.status(401).json({ error: 'Invalid email or password.' })

  const token = signToken({ id:user.id, email:user.email, name:user.name, role:user.role })
  setAuthCookie(res, token)
  return res.status(200).json({ user: { id:user.id, email:user.email, name:user.name, role:user.role } })
}
