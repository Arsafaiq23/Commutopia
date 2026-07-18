import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

type MentorPayload = { purpose?: string; title?: string; outcome?: string; facts?: unknown; attempts?: unknown; allowedPractice?: unknown }
const safeText = (value: unknown, max = 280) => typeof value === 'string' ? value.replace(/[<>]/g, '').trim().slice(0, max) : ''
const strings = (value: unknown, max = 5) => Array.isArray(value) ? value.map((item) => safeText(item)).filter(Boolean).slice(0, max) : []
const extractText = (response: { output_text?: unknown; output?: Array<{ content?: Array<{ text?: unknown }> }> }) => {
  if (typeof response.output_text === 'string') return response.output_text
  return response.output?.flatMap((item) => item.content ?? []).map((item) => typeof item.text === 'string' ? item.text : '').join('') ?? ''
}
const mentorPlugin = (apiKey: string | undefined, model: string): Plugin => ({
  name: 'commutopia-mentor-api',
  configureServer(server) {
    server.middlewares.use('/api/mentor', async (request, response) => {
      if (request.method !== 'POST') { response.statusCode = 405; response.end(); return }
      if (!apiKey) { response.statusCode = 503; response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ error: 'Mentor belum dikonfigurasi.' })); return }
      let body = ''
      request.on('data', (chunk) => { if (body.length < 12000) body += chunk })
      request.on('end', async () => {
        try {
          const input = JSON.parse(body) as MentorPayload
          const facts = strings(input.facts)
          const practice = strings(input.allowedPractice, 4)
          if (!facts.length || !safeText(input.title)) throw new Error('Invalid grounded mentor request')
          const instructions = `Kamu adalah GPT Transit Mentor untuk Commutopia, aplikasi belajar transit Jabodetabek. Gunakan HANYA fakta yang diberikan. Jangan menghitung rute tercepat, jangan memvalidasi jawaban game, jangan menyebut jadwal/tarif/live-service, dan jangan menambahkan koneksi transit yang tidak ada. Tugasmu hanya mengajar pola jaringan, memberi insight, dan merekomendasikan SATU latihan dari daftar yang diizinkan. Balas Bahasa Indonesia dan JSON murni tanpa markdown dengan key recognition, insight, recommendation, practice. recognition maksimal 1 kalimat; insight maksimal 2 kalimat; recommendation maksimal 1 kalimat; practice harus sama persis dari daftar yang diizinkan.`
          const prompt = JSON.stringify({ purpose: safeText(input.purpose, 40), title: safeText(input.title), outcome: safeText(input.outcome, 30), graphFacts: facts, learningSignals: input.attempts, allowedPractice: practice })
          const upstream = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, store: false, instructions, input: prompt, max_output_tokens: 260 }) })
          if (!upstream.ok) throw new Error(`OpenAI ${upstream.status}`)
          const raw = await upstream.json() as { output_text?: unknown; output?: Array<{ content?: Array<{ text?: unknown }> }> }
          const text = extractText(raw).replace(/^```json\s*|\s*```$/g, '')
          const message = JSON.parse(text) as Record<string, unknown>
          const allowed = practice[0] ?? 'Ulangi satu latihan PipeMap untuk memperkuat pola jalur.'
          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify({ recognition: safeText(message.recognition), insight: safeText(message.insight), recommendation: safeText(message.recommendation), practice: practice.includes(safeText(message.practice)) ? safeText(message.practice) : allowed }))
        } catch {
          response.statusCode = 502
          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify({ error: 'Mentor tidak dapat menyusun insight saat ini.' }))
        }
      })
    })
  },
})

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return { plugins: [react(), mentorPlugin(env.OPENAI_API_KEY, env.OPENAI_MODEL || 'gpt-5-mini')], build: { target: 'es2022' } }
})
