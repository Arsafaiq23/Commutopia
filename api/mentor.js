const MAX_BODY_LENGTH = 12_000
const DEFAULT_MODEL = 'gpt-5-mini'

const safeText = (value, max = 280) =>
  typeof value === 'string' ? value.replace(/[<>]/g, '').trim().slice(0, max) : ''

const strings = (value, max = 5) =>
  Array.isArray(value) ? value.map((item) => safeText(item)).filter(Boolean).slice(0, max) : []

const extractText = (response) => {
  if (typeof response.output_text === 'string') return response.output_text
  return response.output?.flatMap((item) => item.content ?? []).map((item) => typeof item.text === 'string' ? item.text : '').join('') ?? ''
}

const json = (response, status, body) => {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(body))
}

const readBody = async (request) => {
  if (typeof request.body === 'string') return JSON.parse(request.body)
  if (request.body && typeof request.body === 'object') return request.body

  return new Promise((resolve, reject) => {
    let raw = ''
    request.on('data', (chunk) => {
      raw += String(chunk)
      if (raw.length > MAX_BODY_LENGTH) reject(new Error('Request too large'))
    })
    request.on('end', () => {
      try { resolve(JSON.parse(raw)) } catch { reject(new Error('Invalid JSON')) }
    })
    request.on('error', reject)
  })
}

/** Same-origin Vercel Function. OPENAI_API_KEY never reaches the browser. */
export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return json(response, 405, { error: 'Method not allowed.' })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return json(response, 503, { error: 'Mentor belum dikonfigurasi.' })

  try {
    const input = await readBody(request)
    const facts = strings(input.facts)
    const practice = strings(input.allowedPractice, 4)
    const title = safeText(input.title)
    if (!facts.length || !title) return json(response, 400, { error: 'Invalid grounded mentor request.' })

    const instructions = 'Kamu adalah GPT Transit Mentor untuk Commutopia, aplikasi belajar transit Jabodetabek. Gunakan HANYA fakta yang diberikan. Jangan menghitung rute tercepat, jangan memvalidasi jawaban game, jangan menyebut jadwal/tarif/live-service, dan jangan menambahkan koneksi transit yang tidak ada. Tugasmu hanya mengajar pola jaringan, memberi insight, dan merekomendasikan SATU latihan dari daftar yang diizinkan. Balas Bahasa Indonesia dan JSON murni tanpa markdown dengan key recognition, insight, recommendation, practice. recognition maksimal 1 kalimat; insight maksimal 2 kalimat; recommendation maksimal 1 kalimat; practice harus sama persis dari daftar yang diizinkan.'
    const prompt = JSON.stringify({
      purpose: safeText(input.purpose, 40),
      title,
      outcome: safeText(input.outcome, 30),
      graphFacts: facts,
      learningSignals: input.attempts,
      allowedPractice: practice,
    })
    const upstream = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
        store: false,
        instructions,
        input: prompt,
        max_output_tokens: 260,
      }),
    })
    if (!upstream.ok) throw new Error(`OpenAI ${upstream.status}`)

    const parsed = JSON.parse(extractText(await upstream.json()).replace(/^```json\s*|\s*```$/g, ''))
    const fallbackPractice = practice[0] ?? 'Ulangi satu latihan PipeMap untuk memperkuat pola jalur.'
    return json(response, 200, {
      recognition: safeText(parsed.recognition),
      insight: safeText(parsed.insight),
      recommendation: safeText(parsed.recommendation),
      practice: practice.includes(safeText(parsed.practice)) ? safeText(parsed.practice) : fallbackPractice,
    })
  } catch {
    return json(response, 502, { error: 'Mentor tidak dapat menyusun insight saat ini.' })
  }
}
