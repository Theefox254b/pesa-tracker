import { withAuth } from '../../../lib/auth'

export default withAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')

  const { messages, system } = req.body

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'AI service not configured. Please add GEMINI_API_KEY to environment variables.' })
  }

  try {
    // Convert to Gemini format — roles must be 'user' or 'model'
    // Also ensure messages alternate correctly (Gemini requires user/model alternation)
    const geminiMessages = []
    for (const m of messages) {
      const role = m.role === 'assistant' ? 'model' : 'user'
      // Skip consecutive same roles by merging
      const last = geminiMessages[geminiMessages.length - 1]
      if (last && last.role === role) {
        last.parts[0].text += '\n' + m.content
      } else {
        geminiMessages.push({ role, parts: [{ text: m.content }] })
      }
    }

    // Gemini requires first message to be from user
    if (geminiMessages.length === 0 || geminiMessages[0].role !== 'user') {
      geminiMessages.unshift({ role: 'user', parts: [{ text: 'Hello' }] })
    }

    const payload = {
      system_instruction: {
        parts: [{ text: system || 'You are a helpful Kenyan personal finance coach. Be direct and practical. Use Kenyan context.' }]
      },
      contents: geminiMessages,
      generationConfig: {
        maxOutputTokens: 800,
        temperature: 0.7,
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      ],
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    )

    const data = await response.json()

    if (!response.ok || data.error) {
      console.error('Gemini API error:', JSON.stringify(data.error || data))
      const msg = data.error?.message || 'Gemini API returned an error.'
      return res.status(502).json({ error: msg })
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) {
      console.error('No text in Gemini response:', JSON.stringify(data))
      return res.status(502).json({ error: 'AI returned an empty response. Please try again.' })
    }

    return res.status(200).json({ text })

  } catch (e) {
    console.error('AI chat exception:', e.message)
    return res.status(500).json({ error: 'Could not reach AI service. Check your GEMINI_API_KEY and network.' })
  }
})
