---
name: xyz-brand
description: XYZ-OS brand system for design work: the red, the logos, and the rules that keep output from looking like AI slop. Use this Skill whenever the design must be on-brand (XYZ-OS surfaces, personal projects) and as the anti-slop checklist for every design task.
---

# XYZ-OS brand system

The brand is personal and deliberate: **red on clean neutrals**. It is not a template, and it must never look like one.

## The red

- Brand accent: `#ff0000` — the one loud color. Use it once or twice per view: the signature element, the primary action, an underline. Never as a background wash, never as body text.
- Supporting ramp (when tints/shades are needed): 50 `#FEF2F2`, 100 `#FEE2E2`, 200 `#FECACA`, 300 `#FCA5A5`, 400 `#F87171`, 600 `#DC2626`, 700 `#B91C1C`, 800 `#991B1B`, 900 `#7F1D1D`
- Neutrals: true grays (no blue-tinted "AI gray"), near-black ink `#0A0A0A`, paper `#FAFAFA`
- In dark themes the red stays `#ff0000`; never swap it for pink or orange

## The logos

Logo assets live in `apps/web/public/` (served at `/`):

- `xyz-light.png` — wordmark for light backgrounds
- `xyz-dark.png` — wordmark for dark backgrounds
- `favicon.png` — the square mark (350×350)

Rules:
- **Never hand-draw the XYZ logo from memory.** Reference the asset files, or use a clean text wordmark ("XYZ-OS" in a strong sans).
- Same rule for any OTHER brand's logo: never invent a logo path for a real company. Use a text wordmark, or ask for the asset. A wobbly hand-drawn logo is the fastest way to look like AI slop.
- Do not restyle, recolor, outline, or animate the logo beyond a subtle entrance.

## Copy and voice

- English only. Plain, confident, active voice. No exclamation marks, no emoji in UI copy, no "unleash", "supercharge", "seamlessly", "elevate".
- Real content only: no lorem ipsum, no invented testimonials, no fake stats, no made-up benchmark numbers. If a fact is needed and unknown, say it plainly or omit the claim.

## Anti-slop checklist

Before delivering anything visual, confirm none of these:

1. Not the warm-cream + terracotta + big serif template
2. Not the near-black + single acid accent template (unless the brief demands it)
3. Not the hairline-rules broadsheet template
4. No purple-to-blue AI gradient anywhere
5. No card-grid-of-three as the first section
6. No numbered "01 / 02 / 03" markers unless the content is a real sequence
7. No fake logos, no generic "sparkle" icons, no robot/neural-net clip art
8. Typography carries personality — the display face is a choice, not Inter-by-default

## Typography

- Display: something with character, used with restraint (headlines only)
- Body: a quiet, highly readable face
- Mono: only for data, code, labels — never for paragraphs
- Load real fonts; don't rely on platform defaults for the display face
