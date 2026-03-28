export default function (ctx) {
  const devicePixelRatio = (typeof window !== 'undefined' && window.devicePixelRatio) || 1
  return devicePixelRatio
}
