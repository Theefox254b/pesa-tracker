import { withAuth } from '../../../lib/auth'
import { supabaseAdmin } from '../../../lib/supabase'

export default withAuth(async function handler(req, res) {
  const userId = req.user.id
  if (req.method === 'GET') {
    const { data } = await supabaseAdmin.from('budgets').select('*').eq('user_id', userId).single()
    return res.status(200).json({ budget: data || null })
  }
  if (req.method === 'POST') {
    const payload = { ...req.body, user_id: userId, updated_at: new Date().toISOString() }
    const { data, error } = await supabaseAdmin.from('budgets')
      .upsert(payload, { onConflict: 'user_id' }).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ budget: data })
  }
  res.status(405).end()
})
