import { renderRagaData } from './demoTape'

self.onmessage = (e: MessageEvent) => {
  const { L, R } = renderRagaData(e.data)
  ;(self as unknown as Worker).postMessage({ L, R, seed: e.data.seed }, [L.buffer, R.buffer])
}
