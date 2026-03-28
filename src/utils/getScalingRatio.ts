export default function (): number {
  const devicePixelRatio = (typeof window !== 'undefined' && window.devicePixelRatio) || 1
  return devicePixelRatio
}
