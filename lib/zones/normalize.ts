export function toNorm(px: number, stageDim: number): number {
  return px / stageDim
}

export function toPx(norm: number, stageDim: number): number {
  return norm * stageDim
}

export function pointsToNorm(points: { x: number; y: number }[], w: number, h: number) {
  return points.map((p) => ({ x: toNorm(p.x, w), y: toNorm(p.y, h) }))
}

export function pointsToPx(points: { x: number; y: number }[], w: number, h: number) {
  return points.map((p) => ({ x: toPx(p.x, w), y: toPx(p.y, h) }))
}
