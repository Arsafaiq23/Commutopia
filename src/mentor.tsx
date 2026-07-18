import { useEffect, useState } from 'react'

export type MentorPurpose = 'explain_why' | 'coach' | 'station'

export interface MentorRequest {
  purpose: MentorPurpose
  title: string
  outcome?: 'completed' | 'retry'
  facts: string[]
  attempts?: { total: number; correct: number; transferMistakes: number }
  allowedPractice?: string[]
}

export interface MentorMessage {
  recognition: string
  insight: string
  recommendation: string
  practice: string
  source: 'ai' | 'fallback'
}

const trim = (value: unknown, fallback: string) => typeof value === 'string' && value.trim().length > 1 ? value.trim().slice(0, 300) : fallback

export function mentorFallback(request: MentorRequest): MentorMessage {
  const fact = request.facts[0] ?? 'Peta ini hanya menunjukkan koneksi transit yang sudah terverifikasi.'
  const practice = request.allowedPractice?.[0] ?? 'Ulangi satu latihan PipeMap untuk memperkuat pola jalur.'
  if (request.purpose === 'station') return { recognition: `Kamu sedang mempelajari ${request.title}.`, insight: fact, recommendation: 'Baca warna, urutan stop, dan koneksi yang ditampilkan sebelum berpindah moda.', practice, source: 'fallback' }
  if (request.purpose === 'coach') {
    const attempts = request.attempts ?? { total: 0, correct: 0, transferMistakes: 0 }
    const recognition = attempts.total ? `Kamu sudah mencoba ${attempts.total} challenge dengan ${attempts.correct} jawaban tepat.` : 'Kamu baru memulai membangun intuisi transit.'
    const recommendation = attempts.transferMistakes > 0 ? 'Fokus dulu pada hub dan transfer terverifikasi sebelum mengambil rute yang lebih panjang.' : 'Lanjutkan ke pola multi-moda agar kamu semakin cepat mengenali hub.'
    return { recognition, insight: fact, recommendation, practice, source: 'fallback' }
  }
  return { recognition: request.outcome === 'completed' ? 'Rute kamu tersambung—bagus!' : 'Belum tersambung, tetapi pola rutenya bisa dipelajari.', insight: fact, recommendation: 'Gunakan hub dan transfer terverifikasi sebagai petunjuk, bukan tebakan nama stasiun.', practice, source: 'fallback' }
}

export async function askTransitMentor(request: MentorRequest): Promise<MentorMessage> {
  const fallback = mentorFallback(request)
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 6500)
  try {
    const response = await fetch('/api/mentor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request), signal: controller.signal })
    if (!response.ok) throw new Error('Mentor service unavailable')
    const data = await response.json() as Partial<MentorMessage>
    return { recognition: trim(data.recognition, fallback.recognition), insight: trim(data.insight, fallback.insight), recommendation: trim(data.recommendation, fallback.recommendation), practice: trim(data.practice, fallback.practice), source: 'ai' }
  } catch {
    return fallback
  } finally {
    window.clearTimeout(timeout)
  }
}

export function TransitMentorCard({ request, compact = false }: { request: MentorRequest; compact?: boolean }) {
  const [message, setMessage] = useState<MentorMessage>(() => mentorFallback(request))
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    setLoading(true)
    askTransitMentor(request).then((next) => { if (active) { setMessage(next); setLoading(false) } })
    return () => { active = false }
  }, [request.purpose, request.title, request.outcome, request.facts.join('|'), request.attempts?.total, request.attempts?.correct, request.attempts?.transferMistakes, request.allowedPractice?.join('|')])
  return <article className={`ai-mentor-card ${compact ? 'compact' : ''}`} aria-live="polite">
    <span className="eyebrow">✦ GPT TRANSIT MENTOR {loading ? '· MENYIAPKAN INSIGHT' : message.source === 'ai' ? '· PERSONAL' : '· BERBASIS GRAPH'}</span>
    <h3>{message.recognition}</h3>
    <p>{message.insight}</p>
    {!compact && <><div className="mentor-recommendation"><b>Langkah berikutnya</b><span>{message.recommendation}</span></div><div className="mentor-practice"><b>Latihan yang cocok</b><span>{message.practice}</span></div></>}
  </article>
}
