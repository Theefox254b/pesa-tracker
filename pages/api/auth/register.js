import { supabaseAdmin } from '../../../lib/supabase'
import { hashPassword } from '../../../lib/auth'
import { rateLimit } from '../../../lib/rateLimit'

const checkLimit = rateLimit({ limit: 5, windowMs: 60 * 1000 })

// Blocked disposable email domains
const BLOCKED_DOMAINS = [
  'mailinator.com','guerrillamail.com','tempmail.com','throwaway.email',
  'yopmail.com','sharklasers.com','grr.la','spam4.me','trashmail.com',
  'dispostable.com','maildrop.cc','fakeinbox.com','mytemp.email',
  'temp-mail.org','getairmail.com','filzmail.com','airmail.cc',
  'spamgourmet.com','trashmail.at','discard.email','spamspot.com',
]

// Known real email providers — we ONLY allow these plus corporate/school domains
const TRUSTED_TLDS = ['com','org','net','edu','ac','co','go','gov','me','io','app']

function validateEmail(email) {
  // Must match strict email pattern
  const regex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/
  if (!regex.test(email)) return 'Please enter a valid email address.'

  const parts = email.split('@')
  const domain = parts[1]?.toLowerCase()
  const domainParts = domain?.split('.')
  const tld = domainParts?.[domainParts.length - 1]
  const sld = domainParts?.[domainParts.length - 2] // second level domain e.g. "gmail"

  // Block disposable domains
  if (BLOCKED_DOMAINS.includes(domain)) {
    return 'Disposable email addresses are not allowed. Please use a real email.'
  }

  // Local part (before @) must be at least 3 characters
  if (parts[0].length < 3) {
    return 'Email address is too short. Please enter your real email.'
  }

  // Domain must have at least 2 parts e.g. gmail.com
  if (!domainParts || domainParts.length < 2) {
    return 'Please enter a valid email address.'
  }

  // Second level domain must be at least 2 characters (blocks "a.com")
  if (!sld || sld.length < 2) {
    return 'Please enter a valid email address.'
  }

  // TLD must be in trusted list OR be a known country code (2 letters)
  if (!TRUSTED_TLDS.includes(tld) && tld?.length !== 2) {
    return 'Please enter a valid email address with a recognised domain.'
  }

  return null // valid
}

function validatePassword(password) {
  if (password.length < 8) return 'Password must be at least 8 characters.'
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter (e.g. A, B, C).'
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number.'
  return null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')

  if (!checkLimit(req, res)) return

  const { name, email, password } = req.body

  // Sanitize inputs
  const cleanName  = (name  || '').trim()
  const cleanEmail = (email || '').trim().toLowerCase()
  const cleanPass  = (password || '').trim()

  // Validate name
  if (cleanName.length < 2) {
    return res.status(400).json({ error: 'Please enter your full name (at least 2 characters).' })
  }
  if (!/^[a-zA-Z\s\-']+$/.test(cleanName)) {
    return res.status(400).json({ error: 'Name can only contain letters, spaces, hyphens and apostrophes.' })
  }

  // Validate email
  const emailError = validateEmail(cleanEmail)
  if (emailError) return res.status(400).json({ error: emailError })

  // Validate password
  const passError = validatePassword(cleanPass)
  if (passError) return res.status(400).json({ error: passError })

  // Check if email already exists
  const { data: existing } = await supabaseAdmin
    .from('users').select('id').eq('email', cleanEmail).single()
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists. Please sign in.' })
  }

  // Create user
  const hashed = await hashPassword(cleanPass)
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .insert({ name: cleanName, email: cleanEmail, password: hashed, role: 'user' })
    .select('id, email, name, role')
    .single()

  if (error) {
    console.error('Register error:', error)
    return res.status(500).json({ error: 'Could not create account. Please try again.' })
  }

  // Send verification email via Supabase
  try {
    await supabaseAdmin.auth.admin.generateLink({
      type: 'signup',
      email: cleanEmail,
      options: { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || ''}/app` }
    })
  } catch (e) {
    // Non-fatal — account still created
    console.warn('Could not send verification email:', e.message)
  }

  return res.status(200).json({
    message: 'Account created successfully! Please check your email inbox and click the verification link before signing in.'
  })
}
