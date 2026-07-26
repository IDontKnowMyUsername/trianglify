import { getGridDensity } from './geom'
import type { Point } from '../types'

/**
 * Bridson's algorithm for Poisson-disc sampling.
 * Generates points with a minimum-distance constraint, producing uniform
 * triangle sizes with organic (non-grid) distribution.
 *
 * The minimum distance is derived from the shared grid-density contract
 * (getGridDensity) so that every pointGeneration mode emits the same number
 * of points at a given cellSize. Bridson's emergent yield lands slightly
 * under that target by construction; the shortfall is topped up with
 * best-candidate samples, so the minimum-distance guarantee is approximate
 * for the last few percent of points (and, as noted below, once variance
 * jitter is applied).
 */
export default function poissonDisc(
  width: number,
  height: number,
  cellSize: number,
  variance: number,
  random: () => number
): Point[] {
  const k = 30 // max candidates per active sample
  const pad = 2 * cellSize

  // sampling domain with padding for edge coverage
  const xMin = -pad
  const yMin = -pad
  const domainW = width + 2 * pad
  const domainH = height + 2 * pad

  // match the grid layout's point count
  const targetCount = getGridDensity(width, height, cellSize).pointCount

  // Bridson saturates at ~0.68 points per minDistance² of domain area (the
  // random-sequential-adsorption limit); deriving the radius with 0.70
  // undershoots the target by ~3% so the best-candidate top-up below fills
  // the gap instead of points being trimmed
  const minDistance = Math.sqrt(0.7 * domainW * domainH / targetCount)
  const gridCellSize = minDistance / Math.SQRT2

  const gridW = Math.ceil(domainW / gridCellSize)
  const gridH = Math.ceil(domainH / gridCellSize)
  // bucket lists: Bridson places at most one point per cell, but the top-up
  // phase can drop a second point into an occupied cell
  const grid = new Array<number[] | null>(gridW * gridH).fill(null)

  const points: Point[] = []
  const active: number[] = []

  const addPoint = (x: number, y: number): void => {
    const i = points.length
    points.push([x, y])
    active.push(i)
    const col = Math.floor((x - xMin) / gridCellSize)
    const row = Math.floor((y - yMin) / gridCellSize)
    const gi = row * gridW + col
    const cell = grid[gi]
    if (cell == null) {
      grid[gi] = [i]
    } else {
      cell.push(i)
    }
  }

  const nearestDistSq = (x: number, y: number, searchRadius: number): number => {
    const col = Math.floor((x - xMin) / gridCellSize)
    const row = Math.floor((y - yMin) / gridCellSize)
    const minCol = Math.max(0, col - searchRadius)
    const maxCol = Math.min(gridW - 1, col + searchRadius)
    const minRow = Math.max(0, row - searchRadius)
    const maxRow = Math.min(gridH - 1, row + searchRadius)

    let minDistSq = Infinity
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const cell = grid[r * gridW + c]
        if (cell != null) {
          for (let i = 0; i < cell.length; i++) {
            const [px, py] = points[cell[i]!]!
            const dx = x - px
            const dy = y - py
            const distSq = dx * dx + dy * dy
            if (distSq < minDistSq) {
              minDistSq = distSq
            }
          }
        }
      }
    }
    return minDistSq
  }

  const isValid = (x: number, y: number): boolean => {
    if (x < xMin || x >= xMin + domainW || y < yMin || y >= yMin + domainH) {
      return false
    }
    // ±2 cells covers the minDistance neighborhood at cellSize = r/√2
    return nearestDistSq(x, y, 2) >= minDistance * minDistance
  }

  // seed with first point
  addPoint(
    xMin + random() * domainW,
    yMin + random() * domainH
  )

  while (active.length > 0 && points.length < targetCount) {
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

  // top up any shortfall from Bridson's emergent yield: best-candidate
  // insertion (keep the candidate farthest from its nearest neighbor)
  // preserves the blue-noise character while hitting the exact count
  const topUpCandidates = 10
  while (points.length < targetCount) {
    let bestX = 0
    let bestY = 0
    let bestDistSq = -1

    for (let c = 0; c < topUpCandidates; c++) {
      const cx = xMin + random() * domainW
      const cy = yMin + random() * domainH
      // ±3 cells ≈ 2.1 × minDistance — after saturation the nearest
      // neighbor is closer than that; an empty neighborhood (Infinity)
      // means the candidate sits in a large hole and should win outright
      const distSq = nearestDistSq(cx, cy, 3)
      if (distSq > bestDistSq) {
        bestDistSq = distSq
        bestX = cx
        bestY = cy
      }
    }
    addPoint(bestX, bestY)
  }

  // apply post-sampling jitter controlled by variance — note this can push
  // point pairs slightly below the minDistance the sampler just enforced,
  // so the output is only strictly Poisson-disc at variance 0
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
