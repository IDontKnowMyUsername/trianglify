import { isBrowser } from './env'

export default function (): number {
  return (isBrowser && window.devicePixelRatio) || 1
}
