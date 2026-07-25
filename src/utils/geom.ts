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
