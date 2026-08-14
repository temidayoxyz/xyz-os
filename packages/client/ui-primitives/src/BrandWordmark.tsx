// XYZ-OS brand wordmark: the custom logos, light and dark variants from
// apps/web/public/ (xyz-light.png / xyz-dark.png). CSS owns the swap — the
// dark-theme body attribute hides the light mark and reveals the dark one.
// The height rides the size prop; width keeps the logo's own ratio.

import type { IconProps } from './icons/props.ts'
import css from './BrandWordmark.module.css'

/**
 * Render the full brand wordmark.
 * @param props.size - height in px (default 24; width keeps the logo ratio).
 * @param props.className - extra class for layout placement.
 * @returns the wordmark (aria-hidden decorative brand art).
 */
export function BrandWordmark({ size = 24, className }: IconProps) {
  return (
    <span className={className} style={{ height: size }} aria-hidden="true">
      <img src="/xyz-light.png" alt="" className={css.light} style={{ height: size }} />
      <img src="/xyz-dark.png" alt="" className={css.dark} style={{ height: size }} />
    </span>
  )
}
