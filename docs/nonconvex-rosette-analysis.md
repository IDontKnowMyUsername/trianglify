# Non-Convex Rosette Tiling — Exact Solution

Geometry of the 12-fold non-convex pentagon rosette tiling implemented in
`src/utils/tilings.ts` (`generateNonconvexTiling`) and rendered by
`examples/nonconvex-tiling.html`. Solved exactly on 2026-07-24: the rosette
tiles the plane with **no gaps and no overlaps**, with all parameters in
closed form. Verified to machine precision (max vertex-to-edge deviation
9×10⁻¹⁶ · BC; 12 × pentagon area ≡ lattice unit-cell area, difference
exactly zero in floating point).

## The Pentagon

Vertices in order B → C → D → E → A, with B at the rosette center.

### Interior angles (exact)

| Vertex | Angle | Role                                   |
|--------|-------|----------------------------------------|
| B      | 30°   | rosette center: 12 × 30 = 360          |
| C      | 60°   | long-arm tip                           |
| D      | 120°  | shoulder bend                          |
| E      | 240°  | reflex — the indent that interlocks    |
| A      | 90°   | short-arm tip                          |
| sum    | 540°  |                                        |

### Edge directions (exact, base petal)

| Edge  | Direction |
|-------|-----------|
| B → C | 15°       |
| C → D | 135°      |
| D → E | 195°      |
| E → A | 135°      |
| A → B | 225°      |

The shoulders C→D and E→A are parallel (both 135°), and D→E is antiparallel
to B→C (195° = 15° + 180°). All directions lie on the 15° grid — this is
what makes the exact solve linear (see Method).

### Edge lengths (exact, normalized to BC = 1)

| Edge  | Exact       | Numeric    |
|-------|-------------|------------|
| B → C | 1           | 1.000000   |
| C → D | 1/4         | 0.250000   |
| D → E | 1/4         | 0.250000   |
| E → A | 1/8         | 0.125000   |
| A → B | 3√3∕8       | 0.649519   |

Derived ratios: shoulderRatio = EA/CD = **1/2**; BC/AB = 8∕(3√3) = 8√3∕9 ≈
**1.5396** (not the golden ratio, despite the visual resemblance).
Pentagon area = 13√3∕128 · BC².

### Closure derivation

With ρ = AB/BC and the directions above, the polygon closure
C→D→E→A must satisfy

```
(CD + EA)·e(135°) + DE·e(195°) = A − C,   where e(195°) = −e(15°)
```

which resolves to

```
CD + EA = ρ/√3          DE = 1 − 2ρ/√3
```

Substituting ρ = 3√3∕8 gives CD + EA = 3/8 and DE = 1/4; the ratio
EA/CD = 1/2 then splits the shoulder sum into CD = 1/4, EA = 1/8.

## The Rosette and Lattice

A rosette is 12 petals around B, alternating base and mirrored copies at 30°
steps. Rosette centers sit on a **hexagonal lattice**:

```
u = C − rot(E, 120°)        |u| = √39∕4 · BC ≈ 1.56125 · BC
v = rot(u, 60°)
```

The E-anchor is the load-bearing choice: it places each rosette's C-tip
(which carries 120° of material from its two petals) exactly inside a
neighbor's reflex E vertex (240°), closing that vertex figure at 360°.
Hexagonality of the lattice was *derived*, not assumed — solving with both
lattice vectors free yields v = rot(u, 60°) on its own.

In `tilings.ts`, `rBC = 4·cellSize/√39` so the lattice pitch |u| equals
`cellSize` exactly.

## Vertex Figures

Every vertex of the tiling closes at 360°:

| Location            | Figure                            | Sum          |
|---------------------|-----------------------------------|--------------|
| rosette center B    | 12 × 30                           | 360          |
| C-tip in reflex E   | 60 + 60 + 240                     | 360          |
| D meetings          | 120 + 120 + 120, or 120 + 240     | 360          |
| short-arm tip A     | 90 + 90 + straight neighbor edge  | 180 + 180    |

Both D figures occur in the tiling: some D corners meet as triples across
three rosettes, others nest in leftover reflex E's. The A-tip is a
**T-junction**: the two home petals contribute 180° and a neighbor's edge
runs straight past. (In the reference image this reads as "4 petals meeting
at the short tip" — visually right, structurally a T-junction.)

## Why Earlier Versions Had Gaps

1. **Wrong lattice anchor.** The original lattice `u = C − rot(A, 120°)`
   forced C-tips onto A-tips — an angle-impossible figure
   (120 + 90 + 90 = 300 ≠ 360). The empirical corrections
   (`latticeScale 0.98`, 4.15° rotation, ±15 px shifts) were minimizing an
   error that provably cannot reach zero, which is why small diamond gaps
   always remained.

2. **Wrong-topology optimizer solutions.** An earlier version of this doc
   recorded an unconstrained Nelder-Mead result (C = 53°, A = 97°,
   BC/AB = 1.90) from a since-deleted solver script. That is a valid
   tiling of a *different* pentagon that does not match the reference
   image's topology. Black-box gap minimization both drifts topology and
   cannot certify exactness; it is superseded by the linear method below.

## Method

Because all edge directions are fixed multiples of 15°, every vertex
position is **linear** in the unknowns (edge lengths ρ, CD, EA, DE and
lattice vectors u, v). The tiling's interlock conditions — pairs of
vertices from adjacent rosettes that must coincide — are therefore linear
equations. The solve:

1. Enumerate angle-compatible vertex pairings near the almost-tiling
   geometry (A↔A, C↔E, E↔C/D, D↔D/E), ~2,500 assignments.
2. Solve each as an overdetermined least-squares system (closure + 2
   equations per pairing, 8 unknowns).
3. Exactly one assignment yields residual ≈ 0 with valid geometry.
4. Verify globally: every vertex of all 12 petals lies on a neighbor edge
   (9×10⁻¹⁶), and 12 × pentagon area equals |u × v| exactly.

Reference-image measurements vs. the exact solution, for the record:

| Quantity      | Measured (hand-tuned) | Exact          |
|---------------|-----------------------|----------------|
| AB/BC         | 0.638                 | 3√3/8 ≈ 0.6495 |
| EA/CD         | 0.543                 | 1/2            |
| BC/AB         | 1.568 ("≈ golden")    | 8√3/9 ≈ 1.5396 |

The eyeballed values were within 2–4% of the ideals.

## Implementation (`tilings.ts`)

```
rBC           = 4 · cellSize / √39         // lattice pitch |u| = cellSize
rAB           = rBC · 3√3/8
shoulderRatio = 1/2
C = B + rBC · e(15°)                        A = B + rAB · e(45°)
D = C + CD · e(135°)                        E = D + DE · e(195°)
u = C − rot(E, 120°)                        v = rot(u, 60°)
```

The closure solve in the code derives CD, EA, DE from ρ and shoulderRatio;
with the exact constants these come out to rBC/4, rBC/8, rBC/4. Adjacent
pentagons' coincident vertices are merged by `deduplicateVertices`
(spatial hash, ε = 10⁻⁴), so the rendered mesh is genuinely shared —
vertex count ≈ 0.375 × (5 × pentagon count).
