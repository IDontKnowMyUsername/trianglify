import type { Point } from '../types'

/**
 * Bridson's algorithm for Poisson-disc sampling.
 * Generates points with a minimum distance constraint, producing uniform
 * triangle sizes with organic (non-grid) distribution.
 */
export default function poissonDisc(
  width: number,
  height: number,
  minDistance: number,
  variance: number,
  random: () => number
): Point[] {
  const k = 30 // max candidates per active sample
  const cellSize = minDistance / Math.SQRT2
  const pad = 2 * minDistance

  // sampling domain with padding for edge coverage
  const xMin = -pad
  const yMin = -pad
  const domainW = width + 2 * pad
  const domainH = height + 2 * pad

  const gridW = Math.ceil(domainW / cellSize)
  const gridH = Math.ceil(domainH / cellSize)
  const grid: (number | null)[] = new Array(gridW * gridH).fill(null)

  const points: Point[] = []
  const active: number[] = []

  const gridIndex = (x: number, y: number): number => {
    const col = Math.floor((x - xMin) / cellSize)
    const row = Math.floor((y - yMin) / cellSize)
    return row * gridW + col
  }

  const addPoint = (x: number, y: number): void => {
    const i = points.length
    points.push([x, y])
    active.push(i)
    grid[gridIndex(x, y)] = i
  }

  const isValid = (x: number, y: number): boolean => {
    if (x < xMin || x >= xMin + domainW || y < yMin || y >= yMin + domainH) {
      return false
    }

    const col = Math.floor((x - xMin) / cellSize)
    const row = Math.floor((y - yMin) / cellSize)
    const minCol = Math.max(0, col - 2)
    const maxCol = Math.min(gridW - 1, col + 2)
    const minRow = Math.max(0, row - 2)
    const maxRow = Math.min(gridH - 1, row + 2)

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const idx = grid[r * gridW + c]
        if (idx != null) {
          const dx = x - points[idx]![0]
          const dy = y - points[idx]![1]
          if (dx * dx + dy * dy < minDistance * minDistance) {
            return false
          }
        }
      }
    }
    return true
  }

  // seed with first point
  addPoint(
    xMin + random() * domainW,
    yMin + random() * domainH
  )

  while (active.length > 0) {
    const activeIdx = Math.floor(random() * active.length)
    const [px, py] = points[active[activeIdx]!]!
    let found = false

    for (let j = 0; j < k; j++) {
      const angle = random() * 2 * Math.PI
      const radius = minDistance + random() * minDistance
      const cx = px + radius * Math.cos(angle)
      const cy = py + radius * Math.sin(angle)

      if (isValid(cx, cy)) {
        addPoint(cx, cy)
        found = true
        break
      }
    }

    if (!found) {
      // remove from active list by swapping with last element
      active[activeIdx] = active[active.length - 1]!
      active.pop()
    }
  }

  // apply post-sampling jitter controlled by variance
  if (variance > 0) {
    const jitterAmount = minDistance * variance * 0.25
    for (let i = 0; i < points.length; i++) {
      points[i] = [
        points[i]![0] + (random() - 0.5) * jitterAmount,
        points[i]![1] + (random() - 0.5) * jitterAmount
      ]
    }
  }

  return points
}
