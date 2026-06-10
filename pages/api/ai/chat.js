import { withAuth } from '../../../lib/auth'

export default withAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { messages, system } = req.body
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not set in Vercel environment variables.' })
  }

  try {
    const geminiMessages = []
    for (const m of (messages || [])) {
      const role = m.role === 'assistant' ? 'model' : 'user'
      const text = (m.content || '').trim()
      if (!text) continue
      const last = geminiMessages[geminiMessages.length - 1]
      if (last && last.role === role) {
        last.parts[0].text += '\n' + text
      } else {
        geminiMessages.push({ role, parts: [{ text }] })
      }
    }

    if (!geminiMessages.length || geminiMessages[0].role !== 'user') {
      geminiMessages.unshift({ role: 'user', parts: [{ text: 'Hello' }] })
    }

    const systemPrompt = system || `You are "The Accountant" — a sharp, caring personal finance coach for Kenyan professionals built into Pesa Tracker. Be direct, warm and practical. Use Kenyan context: Ksh, M-Pesa, matatu, SACCO, chama. When spending is excessive, ask ONE probing question like "Which of these expenses could you live without this month?". Max 3 sentences per reply. Never call yourself anything other than The Accountant.`

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: geminiMessages,
          generationConfig: { maxOutputTokens: 800, temperature: 0.7 },
        }),
      }
    )

    const data = await response.json()

    if (!response.ok || data.error) {
      const msg = data.error?.message || 'Gemini error'
      console.error('Gemini error:', msg)
      return res.status(502).json({ error: `The Accountant is unavailable: ${msg}` })
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) return res.status(502).json({ error: 'The Accountant returned an empty response.' })

    return res.status(200).json({ text })

  } catch (e) {
    console.error('AI error:', e.message)
    return res.status(500).json({ error: 'Could not reach The Accountant: ' + e.message })
  }
})
