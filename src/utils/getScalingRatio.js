export default function () {
  const devicePixelRatio = (typeof window !== 'undefined' && window.devicePixelRatio) || 1
  return devicePixelRatio
}
