import type { Point } from '../types'

const PHI = (1 + Math.sqrt(5)) / 2
const GOLDEN_ANGLE = 2 * Math.PI / (PHI * PHI)

/**
 * Fibonacci sphere point generation with orthographic 2D projection.
 * Distributes points evenly on a sphere surface, then projects
 * onto the canvas plane.
 */
export default function sphere(
  width: number,
  height: number,
  cellSize: number,
  variance: number,
  random: () => number
): Point[] {
  const pad = 2 * cellSize
  const cx = width / 2
  const cy = height / 2

  // Target point count: match density of grid algorithm
  const targetCount = (Math.floor(width / cellSize) + 4) * (Math.floor(height / cellSize) + 4)

  // Sphere radius: fits the padded canvas area
  const radiusX = cx + pad
  const radiusY = cy + pad

  const jitterAmount = cellSize * variance * 0.25
  const points: Point[] = []

  for (let i = 0; i < targetCount; i++) {
    // Fibonacci sphere sampling: uniform distribution on sphere
    const theta = Math.acos(1 - 2 * (i + 0.5) / targetCount)
    const phi = GOLDEN_ANGLE * i

    // 3D coordinates on unit sphere
    const sx = Math.sin(theta) * Math.cos(phi)
    const sy = Math.cos(theta)
    // sz = Math.sin(theta) * Math.sin(phi) — dropped for orthographic projection

    // Orthographic projection: map [-1, 1] to canvas
    let x = cx + sx * radiusX
    let y = cy + sy * radiusY

    if (variance > 0) {
      x += (random() - 0.5) * jitterAmount
      y += (random() - 0.5) * jitterAmount
    }

    points.push([x, y])
  }

  return points
}
