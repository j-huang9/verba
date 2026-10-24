# Conversation-aware ranking: spec for Computer C

The family member's question (from `webkitSpeechRecognition`) re-orders the "Did you mean this?"
sheet. "Are you in pain?" lifts Yes, No and I'm in pain. Everything A owns is done:
`web/src/engine/priors.json` (rules) and `web/src/engine/priors.ts` (`rerank`), checked by `npm run test:engine`.

## How to use it (the one rule that matters)

```ts
import { rerank } from './engine/priors'

const guesses = predict(model, features(segment))       // lip reader only
if (guesses[0].prob >= model.threshold) speak(guesses[0])  // decide to speak BEFORE re-ranking
else showConfirmSheet(rerank(guesses, lastQuestion))       // question only re-orders the sheet
```

A question must never make the app speak by itself. `rerank` returns the same `Guess[]` shape,
sorted, with renormalized `prob`, so ConfidenceBar and the sheet work unchanged.

- `lastQuestion`: the final transcript from speech recognition, ideally only if heard in the
  ~20 s before Listen. Pass `null` when there's none; then `rerank` returns the guesses unchanged.
- If no rule matches (e.g. "Good morning"), the guesses come back unchanged too.
- Optional UI: show the heard question small above the sheet ("Heard: Are you in pain?").

## Results (core8, 4 people held out in turn; `python silentvoice.py priors --set core8`)

| On the confirm sheet | First guess | Top 3 | Urgent phrases in top 3 |
|---|---|---|---|
| No question | 52% | 80% | 72% |
| Relevant question ("Are you in pain?" → patient says I'm in pain) | **62%** | **86%** | 80% |
| Unrelated question (patient says something else) | 44% | 77% | 81% |

Safeguards: boost is a gentle 2×, urgent phrases (I can't breathe, I'm in pain, …) are lifted by
every question so they're never pushed down, and speaking stays lips-only (12% of takes, right 79%).

## Editing the rules

B or anyone can add cues in `priors.json`: a regex `cue`, the `phrases` it lifts, and `examples`.
Then run `python silentvoice.py priors` (checks ids and that each example matches) and
`python silentvoice.py train` + `npm run test:engine` (re-checks TS against Python).
