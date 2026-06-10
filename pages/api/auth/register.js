import { supabaseAdmin } from '../../../lib/supabase'
import { hashPassword } from '../../../lib/auth'

// Disposable email domains to block
const BLOCKED_DOMAINS = [
  'mailinator.com','guerrillamail.com','tempmail.com','throwaway.email',
  'yopmail.com','sharklasers.com','guerrillamailblock.com','grr.la',
  'spam4.me','trashmail.com','dispostable.com','maildrop.cc',
  'fakeinbox.com','spamgourmet.com','mytemp.email','temp-mail.org',
]

function isValidEmail(email) {
  // Must match real email pattern
  const regex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/
  if (!regex.test(email)) return false
  // Block disposable domains
  const domain = email.split('@')[1]?.toLowerCase()
  if (BLOCKED_DOMAINS.includes(domain)) return false
  // Must have a real TLD (not just numbers)
  const tld = domain?.split('.').pop()
  if (!tld || tld.length < 2 || /^\d+$/.test(tld)) return false
  return true
}

function isStrongPassword(password) {
  if (password.length < 8) return 'Password must be at least 8 characters.'
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.'
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number.'
  return null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')

  const { name, email, password } = req.body

  // Input validation
  if (!name?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ error: 'All fields are required.' })
  }
  if (name.trim().length < 2) {
    return res.status(400).json({ error: 'Please enter your full name.' })
  }
  if (!isValidEmail(email.trim())) {
    return res.status(400).json({ error: 'Please enter a valid email address. Disposable emails are not allowed.' })
  }
  const pwError = isStrongPassword(password)
  if (pwError) return res.status(400).json({ error: pwError })

  // Check existing
  const { data: existing } = await supabaseAdmin
    .from('users').select('id').eq('email', email.toLowerCase().trim()).single()
  if (existing) return res.status(409).json({ error: 'An account with this email already exists.' })

  // Send verification email via Supabase Auth
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: email.toLowerCase().trim(),
    password,
    email_confirm: false, // requires email verification
    user_metadata: { name: name.trim() },
  })

  if (authError) {
    console.error('Auth error:', authError)
    return res.status(500).json({ error: 'Could not create account. Please try again.' })
  }

  // Also store in our users table
  const hashed = await hashPassword(password)
  await supabaseAdmin.from('users').insert({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password: hashed,
    role: 'user',
  })

  // Don't auto-login — require email verification first
  return res.status(200).json({
    message: 'Account created! Please check your email and click the verification link before signing in.'
  })
}
