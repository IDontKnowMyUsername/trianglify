import type { Point, Shape, TilingShape } from '../types'

/**
 * The shapes rendered as one regular N-gon per grid point. Everything else
 * builds its geometry elsewhere: triangle via Delaunay, circle via
 * radius-based rendering (approximated as a 24-gon only for gap
 * computation), tilings via their own generators.
 */
export type RegularPolygonShape = Exclude<Shape, TilingShape | 'triangle' | 'circle'>

// Validity map for Shape values, shared by option validation
// (trianglify.ts) and Pattern.fromData (pattern.ts). A Record<union, true>
// rather than an array: the type forces compile-time completeness, so
// adding a Shape member without updating this map is a type error.
export const validShapes: Record<Shape, true> = Object.freeze({ triangle: true, pentagon: true, 'pentagon-cairo': true, 'pentagon-convex': true, 'pentagon-nonconvex': true, hexagon: true, heptagon: true, octagon: true, circle: true })

/**
 * Generate vertices of a regular polygon centered at a point.
 * @param center - center [x, y] of the polygon
 * @param sides - number of sides
 * @param circumradius - distance from center to each vertex
 * @param rotationOffset - rotation in radians (default: vertex-at-top, i.e.
 *   "pointy-top" orientation — the first vertex sits directly above center)
 * @returns array of [x, y] vertices in winding order
 */
export function generateRegularPolygon(
  center: Point,
  sides: number,
  circumradius: number,
  rotationOffset = -Math.PI / 2
): Point[] {
  const [cx, cy] = center
  const angleStep = (2 * Math.PI) / sides
  const vertices: Point[] = []

  for (let i = 0; i < sides; i++) {
    const angle = rotationOffset + i * angleStep
    vertices.push([
      cx + circumradius * Math.cos(angle),
      cy + circumradius * Math.sin(angle)
    ])
  }

  return vertices
}

/**
 * Get the number of sides for a regular-polygon shape.
 *
 * The switch is deliberately exhaustive with no default: adding a
 * RegularPolygonShape member without handling it here is a compile error
 * (noImplicitReturns).
 */
export function getSidesForShape(shape: RegularPolygonShape): number {
  switch (shape) {
    case 'pentagon': return 5
    case 'hexagon': return 6
    case 'heptagon': return 7
    case 'octagon': return 8
  }
}
