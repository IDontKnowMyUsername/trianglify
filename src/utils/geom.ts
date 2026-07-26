import type { Point, Centroid } from '../types'

// Given an array of coordinates, find the centroid and return it as {x, y}.
// Works with any number of vertices (triangles, N-gons, etc.)
export const getCentroid = (d: Point[]): Centroid => {
  const n = d.length
  let x = 0
  let y = 0
  for (let i = 0; i < n; i++) {
    x += d[i]![0]
    y += d[i]![1]
  }
  return { x: x / n, y: y / n }
}

// Cell-grid density shared by every point generator: a padded grid with two
// extra cells on each side of the artboard. Every pointGeneration mode emits
// this same number of points so modes are interchangeable at a given
// cellSize. (Hexagon grids are the one exception: they use their own
// honeycomb row spacing in trianglify.ts, so their row count differs.)
export const getGridDensity = (width: number, height: number, cellSize: number): { colCount: number; rowCount: number; pointCount: number } => {
  const colCount = Math.floor(width / cellSize) + 4
  const rowCount = Math.floor(height / cellSize) + 4
  return { colCount, rowCount, pointCount: colCount * rowCount }
}
