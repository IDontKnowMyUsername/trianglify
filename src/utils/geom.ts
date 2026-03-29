import type { Point, Centroid } from '../types'

// Given three coordinates representing a triangle, find the centroid
// of the triangle and return it as an {x, y} object
export const getCentroid = (d: [Point, Point, Point]): Centroid => {
  return {
    x: (d[0][0] + d[1][0] + d[2][0]) / 3,
    y: (d[0][1] + d[1][1] + d[2][1]) / 3
  }
}

export const getTopmostVertexIndex = (vertexIndices: number[], points: Point[]): number => (
  // vertexIndices are produced by Delaunator and guaranteed within bounds of points
  vertexIndices.reduce(
    (topmost, i) => (points[i]![1] < points[topmost]![1] ? i : topmost),
    vertexIndices[0]!
  )
)
