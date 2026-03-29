import type { Point } from '../types'

/**
 * Mitchell's best-candidate algorithm for point sampling.
 * For each new sample, generates k random candidates and picks the one
 * farthest from all existing samples. The candidate count (k) is controlled
 * by the variance parameter.
 */
export default function bestCandidate(
  width: number,
  height: number,
  cellSize: number,
  variance: number,
  random: () => number
): Point[] {
  const pad = 2 * cellSize
  const xMin = -pad
  const yMin = -pad
  const domainW = width + 2 * pad
  const domainH = height + 2 * pad

  // match grid point count: (floor(w/cellSize) + 4) * (floor(h/cellSize) + 4)
  const targetCount = (Math.floor(width / cellSize) + 4) * (Math.floor(height / cellSize) + 4)

  // variance maps to candidate count: low variance = many candidates (uniform),
  // high variance = few candidates (random)
  const numCandidates = Math.max(1, Math.round(30 * (1 - variance) + 1 * variance))

  // spatial grid for fast nearest-neighbor lookup
  const gridCellSize = cellSize
  const gridW = Math.ceil(domainW / gridCellSize)
  const gridH = Math.ceil(domainH / gridCellSize)
  const grid: (number[] | null)[] = new Array(gridW * gridH).fill(null)

  const points: Point[] = []

  const addToGrid = (index: number): void => {
    const [x, y] = points[index]!
    const col = Math.floor((x - xMin) / gridCellSize)
    const row = Math.floor((y - yMin) / gridCellSize)
    const gi = row * gridW + col
    if (grid[gi] === null) {
      grid[gi] = [index]
    } else {
      grid[gi]!.push(index)
    }
  }

  const nearestDistSq = (x: number, y: number): number => {
    const col = Math.floor((x - xMin) / gridCellSize)
    const row = Math.floor((y - yMin) / gridCellSize)

    // search radius: check cells within ~2 cells for nearby points
    const searchRadius = 2
    let minDistSq = Infinity

    const minCol = Math.max(0, col - searchRadius)
    const maxCol = Math.min(gridW - 1, col + searchRadius)
    const minRow = Math.max(0, row - searchRadius)
    const maxRow = Math.min(gridH - 1, row + searchRadius)

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

  // place first point randomly
  const firstPoint: Point = [
    xMin + random() * domainW,
    yMin + random() * domainH
  ]
  points.push(firstPoint)
  addToGrid(0)

  // generate remaining points
  for (let n = 1; n < targetCount; n++) {
    let bestX = 0
    let bestY = 0
    let bestDistSq = -1

    for (let c = 0; c < numCandidates; c++) {
      const cx = xMin + random() * domainW
      const cy = yMin + random() * domainH
      const distSq = nearestDistSq(cx, cy)

      if (distSq > bestDistSq) {
        bestDistSq = distSq
        bestX = cx
        bestY = cy
      }
    }

    points.push([bestX, bestY])
    addToGrid(n)
  }

  return points
}
