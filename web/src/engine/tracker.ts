// MediaPipe Face Landmarker running in the browser (WASM, GPU when available).
// Assets are served from /mediapipe (copied/downloaded by scripts/setup-mediapipe.mjs).
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import { TRACKED } from './features'

export interface TrackerFrame {
  /** TRACKED.length (x, y) pairs in 0..1 image coords */
  points: Float64Array
  blink: number
  w: number
  h: number
}

export interface Tracker {
  process: (video: HTMLVideoElement) => TrackerFrame | null
  close: () => void
}

export async function createTracker(): Promise<Tracker> {
  const fileset = await FilesetResolver.forVisionTasks('/mediapipe/wasm')
  const options = (delegate: 'GPU' | 'CPU') => ({
    baseOptions: { modelAssetPath: '/mediapipe/face_landmarker.task', delegate },
    runningMode: 'VIDEO' as const,
    numFaces: 1,
    outputFaceBlendshapes: true,
  })
  let landmarker: FaceLandmarker
  try {
    landmarker = await FaceLandmarker.createFromOptions(fileset, options('GPU'))
  } catch {
    landmarker = await FaceLandmarker.createFromOptions(fileset, options('CPU'))
  }

  let lastTs = 0
  return {
    process(video) {
      const ts = Math.max(performance.now(), lastTs + 1) // must strictly increase
      lastTs = ts
      const res = landmarker.detectForVideo(video, ts)
      const face = res.faceLandmarks[0]
      if (!face) return null
      const points = new Float64Array(TRACKED.length * 2)
      TRACKED.forEach((idx, i) => {
        points[2 * i] = face[idx].x
        points[2 * i + 1] = face[idx].y
      })
      const cats = res.faceBlendshapes[0]?.categories ?? []
      const score = (name: string) => cats.find((c) => c.categoryName === name)?.score ?? 0
      return {
        points,
        blink: (score('eyeBlinkLeft') + score('eyeBlinkRight')) / 2,
        w: video.videoWidth,
        h: video.videoHeight,
      }
    },
    close: () => landmarker.close(),
  }
}
