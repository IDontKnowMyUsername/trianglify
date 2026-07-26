import { getGridDensity } from './geom'
import type { Point } from '../types'

const PHI = (1 + Math.sqrt(5)) / 2

/**
 * Fermat's spiral (sunflower pattern) point generation.
 * Places points at increasing radii with a fixed divergence angle,
 * producing an area-filling spiral distribution.
 */
export default function spiral(
  width: number,
  height: number,
  cellSize: number,
  variance: number,
  random: () => number,
  direction: 'cw' | 'ccw',
  ratio: number | 'golden'
): Point[] {
  const pad = 2 * cellSize
  const cx = width / 2
  const cy = height / 2

  // Divergence angle: for golden ratio, use the golden angle
  // For arbitrary ratio r, use 2*PI / (r*r)
  const r = ratio === 'golden' ? PHI : ratio
  const divergenceAngle = (2 * Math.PI) / (r * r)
  const dirSign = direction === 'cw' ? -1 : 1

  // Target point count: match density of the grid algorithm
  const targetCount = getGridDensity(width, height, cellSize).pointCount

  // Scale factor: the outermost point should reach the corner of the padded area
  const maxRadius = Math.sqrt((cx + pad) ** 2 + (cy + pad) ** 2)
  // For Fermat spiral: radius_n = scale * sqrt(n)
  // maxRadius = scale * sqrt(targetCount - 1)
  const scale = maxRadius / Math.sqrt(Math.max(1, targetCount - 1))

  const jitterAmount = cellSize * variance * 0.25
  const points: Point[] = []

  for (let i = 0; i < targetCount; i++) {
    const angle = i * divergenceAngle * dirSign
    const radius = scale * Math.sqrt(i)
    let x = cx + radius * Math.cos(angle)
    let y = cy + radius * Math.sin(angle)

    if (variance > 0) {
      x += (random() - 0.5) * jitterAmount
      y += (random() - 0.5) * jitterAmount
    }

    points.push([x, y])
  }

  return points
}
