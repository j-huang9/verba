// TypeScript port of the feature pipeline in silentvoice.py. MUST stay identical to the
// Python (normalize / resample / features); golden.test.ts checks it against a fixture
// that `python silentvoice.py train` writes. Change both sides in the same commit.

// MediaPipe face-mesh indices: outer lip loop (20) then inner loop (20), then the
// reference points (left eye outer, right eye outer, nose tip, chin).
export const LIPS = [
  61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185,
  78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191,
]
export const REF = [33, 263, 1, 152]
export const TRACKED = [...LIPS, ...REF]
export const N_LIPS = LIPS.length
const I_EYE_L = N_LIPS
const I_EYE_R = N_LIPS + 1
const I_NOSE = N_LIPS + 2
export const SEQ_LEN = 24
export const MIN_FRAMES = 8

/** One tracked frame: TRACKED.length (x, y) pairs in 0..1 image coords, flattened. */
export type RawFrame = Float64Array
/** One normalized frame: N_LIPS (x, y) pairs in the head-stable frame, flattened. */
export type NormFrame = Float64Array

/** Origin at the nose tip, x-axis along the eye line, unit = eye-corner distance. */
export function normalize(p: ArrayLike<number>, w: number, h: number): NormFrame {
  const ar = w / h
  const ex = (p[2 * I_EYE_R] - p[2 * I_EYE_L]) * ar
  const ey = p[2 * I_EYE_R + 1] - p[2 * I_EYE_L + 1]
  const scale = Math.hypot(ex, ey)
  const ang = Math.atan2(ey, ex)
  const c = Math.cos(-ang)
  const s = Math.sin(-ang)
  const nx = p[2 * I_NOSE] * ar
  const ny = p[2 * I_NOSE + 1]
  const out = new Float64Array(N_LIPS * 2)
  for (let i = 0; i < N_LIPS; i++) {
    const dx = p[2 * i] * ar - nx
    const dy = p[2 * i + 1] - ny
    out[2 * i] = (c * dx - s * dy) / scale
    out[2 * i + 1] = (s * dx + c * dy) / scale
  }
  return out
}

export function resample(seq: NormFrame[], n = SEQ_LEN): NormFrame[] {
  const last = seq.length - 1
  return Array.from({ length: n }, (_, k) => {
    const idx = (k * last) / (n - 1)
    const lo = Math.floor(idx)
    const hi = Math.min(lo + 1, last)
    const f = idx - lo
    const a = seq[lo]
    const b = seq[hi]
    const out = new Float64Array(a.length)
    for (let j = 0; j < a.length; j++) out[j] = a[j] * (1 - f) + b[j] * f
    return out
  })
}

/** Normalized take -> feature vector: [motion around mean shape, velocity * 4, mean shape]. */
export function features(seq: NormFrame[]): Float64Array {
  const x = resample(seq)
  const T = x.length
  const D = x[0].length
  const mean = new Float64Array(D)
  for (const f of x) for (let j = 0; j < D; j++) mean[j] += f[j] / T
  const out = new Float64Array(T * D + (T - 1) * D + D)
  let o = 0
  for (const f of x) for (let j = 0; j < D; j++) out[o++] = f[j] - mean[j]
  for (let t = 1; t < T; t++) for (let j = 0; j < D; j++) out[o++] = (x[t][j] - x[t - 1][j]) * 4
  for (let j = 0; j < D; j++) out[o++] = mean[j]
  return out
}

/** Mean absolute per-coordinate change between two normalized frames (mouth motion). */
export function motion(a: NormFrame, b: NormFrame): number {
  let sum = 0
  for (let j = 0; j < a.length; j++) sum += Math.abs(a[j] - b[j])
  return sum / a.length
}
