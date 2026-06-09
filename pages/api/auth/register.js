import { supabaseAdmin }  from '../../../lib/supabase'
import { hashPassword, signToken, setAuthCookie } from '../../../lib/auth'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { name, email, password } = req.body

  if (!name || !email || !password) return res.status(400).json({ error: 'All fields required.' })
  if (password.length < 8)          return res.status(400).json({ error: 'Password must be at least 8 characters.' })

  // Check if email already exists
  const { data: existing } = await supabaseAdmin.from('users').select('id').eq('email', email.toLowerCase()).single()
  if (existing) return res.status(409).json({ error: 'An account with this email already exists.' })

  const hashed = await hashPassword(password)
  const { data: user, error } = await supabaseAdmin.from('users')
    .insert({ name, email: email.toLowerCase(), password: hashed })
    .select('id, email, name, role').single()

  if (error) return res.status(500).json({ error: 'Could not create account. Please try again.' })

  const token = signToken({ id: user.id, email: user.email, name: user.name, role: user.role })
  setAuthCookie(res, token)
  return res.status(200).json({ user: { id:user.id, email:user.email, name:user.name, role:user.role } })
}
