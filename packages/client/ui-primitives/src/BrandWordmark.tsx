// XYZ-OS brand wordmark (placeholder until the custom XYZ-OS logo lands).
// Same 182:24 canvas as the original DeepSeek wordmark so all layout stays
// identical. Ink rides currentColor; the badge text is knocked out in the
// inverted label color so the plate stays legible in both themes.
// Swap the svg body below for the real logo — nothing else needs to change.

import type { IconProps } from './icons/props.ts'

/**
 * Render the full brand wordmark.
 * @param props.size - height in px (default 24; width keeps the 182:24 ratio).
 * @param props.className - extra class for layout placement.
 * @returns the wordmark svg (aria-hidden decorative brand art).
 */
export function BrandWordmark({ size = 24, className }: IconProps) {
  return (
    <svg
      width={(size * 182) / 24}
      height={size}
      className={className}
      viewBox="0 0 182 24"
      fill="none"
      aria-hidden="true"
    >
      {/* XYZ badge — red plate (brand-500) with knocked-out initials */}
      <rect x="0" y="2" width="76" height="20" rx="4" fill="var(--dsw-static-deepseek-500)" />
      <text
        x="38"
        y="17"
        textAnchor="middle"
        fontFamily="system-ui, sans-serif"
        fontSize="13"
        fontWeight="800"
        fill="var(--dsw-alias-label-primary-inverted)"
      >
        XYZ
      </text>
      {/* OS suffix rides the current text color */}
      <text
        x="84"
        y="17"
        fontFamily="system-ui, sans-serif"
        fontSize="14"
        fontWeight="600"
        fill="currentColor"
      >
        · OS
      </text>
    </svg>
  )
}
