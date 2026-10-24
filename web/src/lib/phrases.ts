import data from '../../../phrases.json'

export interface Phrase {
  id: string
  text: string
  category: string
  urgent: boolean
}

export const PHRASES: Phrase[] = data.phrases
export const PHRASE_BY_ID: Record<string, Phrase> = Object.fromEntries(PHRASES.map((p) => [p.id, p]))
