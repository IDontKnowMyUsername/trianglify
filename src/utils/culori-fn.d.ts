// Minimal type surface for the culori/fn entry — culori ships no TypeScript
// declarations, and declaring only what colorBackend.ts imports keeps the
// published trianglify.d.ts free of any culori type dependency.
declare module 'culori/fn' {
  /** A culori color object: a mode tag plus numeric channels. */
  interface CuloriColor {
    mode: string
    alpha?: number
    [channel: string]: string | number | undefined
  }

  /** Opaque color-space definition object accepted by useMode. */
  interface CuloriModeDefinition {
    mode: string
  }

  export function useMode(definition: CuloriModeDefinition): (color: unknown) => CuloriColor | undefined
  export function converter(mode: string): (color: CuloriColor | string | undefined) => CuloriColor | undefined
  export function interpolate(colors: (CuloriColor | string)[], mode?: string): (t: number) => CuloriColor
  export function formatCss(color: CuloriColor | string | undefined): string | undefined
  export function parse(color: string): CuloriColor | undefined

  export const modeRgb: CuloriModeDefinition
  export const modeLrgb: CuloriModeDefinition
  export const modeHsl: CuloriModeDefinition
  export const modeHsv: CuloriModeDefinition
  export const modeHsi: CuloriModeDefinition
  export const modeXyz65: CuloriModeDefinition
  export const modeLab65: CuloriModeDefinition
  export const modeLch65: CuloriModeDefinition
  export const modeOklab: CuloriModeDefinition
  export const modeOklch: CuloriModeDefinition
  export const modeP3: CuloriModeDefinition
}
