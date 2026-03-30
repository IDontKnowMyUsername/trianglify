import type { Point, Shape } from '../types'

/**
 * Generate vertices of a regular polygon centered at a point.
 * @param center - center [x, y] of the polygon
 * @param sides - number of sides
 * @param circumradius - distance from center to each vertex
 * @param rotationOffset - rotation in radians (default: flat-top orientation)
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
 * Get the number of sides for a given shape.
 * Returns null for shapes that don't use polygon vertices (triangle uses
 * Delaunay, circle uses radius-based rendering).
 */
export function getSidesForShape(shape: Shape): number | null {
  switch (shape) {
    case 'pentagon': return 5
    case 'hexagon': return 6
    case 'heptagon': return 7
    case 'octagon': return 8
    case 'triangle':
    case 'circle':
    default:
      return null
  }
}
