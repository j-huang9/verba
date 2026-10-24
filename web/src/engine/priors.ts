// Conversation-aware ranking: the family's last question (from speech recognition) makes some
// phrases more likely, e.g. "Are you in pain?" lifts Yes, No and I'm in pain. Same math as
// rerank() in silentvoice.py; rules live in priors.json.
//
// Use it only for the confirm sheet: decide whether to speak from the lip reader's own
// guesses first (a question must never make the app say something on its own), then
//   const shown = rerank(guesses, lastQuestion)
import data from './priors.json' with { type: 'json' }
import type { Guess } from './types'

export interface PriorRule {
  name: string
  cue: string
  phrases: string[]
  examples: string[]
}

export interface Priors {
  version: number
  boost: number
  /** urgent phrases: lifted whenever any rule matches, so they are never pushed down */
  always: string[]
  rules: PriorRule[]
}

export const PRIORS: Priors = data

/** Rules whose cue matches the question. */
export function matchRules(question: string, priors: Priors = PRIORS): PriorRule[] {
  return priors.rules.filter((r) => new RegExp(r.cue, 'i').test(question))
}

/** Phrases the question makes more likely (empty if no rule matches). */
export function liftedPhrases(question: string, priors: Priors = PRIORS): Set<string> {
  const rules = matchRules(question, priors)
  return new Set(rules.length ? [...rules.flatMap((r) => r.phrases), ...priors.always] : [])
}

/**
 * Re-rank the lip reader's guesses given what the family just asked. Phrases named by any
 * matching rule (plus the urgent ones) get `boost` times their probability, then everything
 * is renormalized, so prob stays a probability for the confidence bar. With no question, or
 * no matching rule, the guesses come back unchanged.
 */
export function rerank(guesses: Guess[], question: string | null | undefined, priors: Priors = PRIORS): Guess[] {
  if (!question) return guesses
  const lifted = liftedPhrases(question, priors)
  if (!guesses.some((g) => lifted.has(g.phrase_id))) return guesses
  const w = guesses.map((g) => g.prob * (lifted.has(g.phrase_id) ? priors.boost : 1))
  const sum = w.reduce((a, v) => a + v, 0)
  return guesses.map((g, i) => ({ ...g, prob: w[i] / sum })).sort((a, b) => b.prob - a.prob)
}
