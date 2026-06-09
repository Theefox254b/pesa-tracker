import { withAuth } from '../../../lib/auth'
import { supabaseAdmin } from '../../../lib/supabase'

export default withAuth(async function handler(req, res) {
  const userId = req.user.id
  if (req.method === 'GET') {
    const { data } = await supabaseAdmin.from('investments').select('*').eq('user_id', userId).order('created_at', { ascending: false })
    return res.status(200).json({ investments: data || [] })
  }
  if (req.method === 'POST') {
    const { data, error } = await supabaseAdmin.from('investments').insert({ ...req.body, user_id: userId }).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json({ investment: data })
  }
  if (req.method === 'DELETE') {
    const { id } = req.query
    await supabaseAdmin.from('investments').delete().eq('id', id).eq('user_id', userId)
    return res.status(200).json({ ok: true })
  }
  res.status(405).end()
})
