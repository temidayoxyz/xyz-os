---
name: design-qa
description: Mandatory visual quality-assurance loop for design work: render the artifact headlessly, critique it (visually when the model has vision, via pixel sampling when it does not), fix findings, re-render. Use this Skill for every HTML/CSS/SVG design artifact before delivering.
---

# Design QA loop

Every design artifact MUST pass through this loop before delivery. A design nobody looked at is not done. If the current model can read images, critique visually; if it cannot (the model may report "does not declare image input"), fall back to pixel sampling and DOM dumps — but never skip the loop.

## 1. Render

Locate Edge or Chrome, then render headless with a fresh temp profile (Chrome's crash reporter and IPC fail inside sandboxes without these flags):

```powershell
$browsers = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "$env:ProgramFiles(x86)\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe")
$browser = $browsers | Where-Object { Test-Path $_ } | Select-Object -First 1
$tmp = "<artifact-dir>\.chrome-tmp"
& $browser --headless=new --disable-gpu --no-first-run --disable-crash-reporter --user-data-dir="$tmp" --hide-scrollbars --window-size=1440,<tall-enough> --screenshot="<artifact-dir>\full.png" "file:///<artifact-dir>/index.html" 2>$null
```

If the render fails with mojo/crashpad access errors, retry once with a wider sandbox permission (danger-full-access) — justified for local visual QA — or render with `--virtual-time-budget=4000 --dump-dom` and inspect the DOM instead.

Render at least two viewports: desktop (1440 wide) and mobile (390 wide). Check the mobile shot for overflow and broken stacking.

## 2. Critique

Check every item; a finding must be fixed or deliberately waived:

- **Spacing scale** — paddings and gaps come from one scale (e.g., 4px multiples); no two nearly-but-not-equal gaps
- **Alignment grid** — every element left-aligns or centers on a shared edge; no 1–3px strays
- **Typography** — max two families (display + body); no more than three weights; line-height and letter-spacing set deliberately
- **Contrast** — text meets WCAG AA on its background; don't trust, sample the pixels
- **Color discipline** — accent used once or twice per view, not everywhere; grays are neutral, not tinted
- **States** — hover, focus-visible, active exist and are visible; keyboard focus is never removed
- **Motion** — one orchestrated moment beats scattered effects; `prefers-reduced-motion` is honored
- **Copy** — real content, no lorem ipsum, no fake stats, no invented brand facts

## 3. Vision-capable model

Read the screenshot and critique what you SEE: layout, hierarchy, whitespace, whether the signature element lands. If `read_image` fails because the model has no image input, do not pretend to look — switch to pixel sampling.

## 4. Pixel sampling (vision-less fallback)

Sample known coordinates to verify layout and colors programmatically:

```powershell
Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::FromFile("<artifact-dir>\full.png")
$samples = @(@{x=720;y=90;n="nav"}, @{x=400;y=480;n="hero-mid"}, @{x=90;y=760;n="cta"})
foreach ($s in $samples) {
  $p = $bmp.GetPixel($s.x, $s.y)
  "$($s.n): rgb($($p.R),$($p.G),$($p.B))"
}
```

Verify: background bands are where sections should be, accent pixels appear at the accent elements, no giant blank bands. Also dump the DOM (`--dump-dom`) and confirm the scripted behavior executed (classes applied, content present).

## 5. Iterate

Fix every confirmed finding, re-render, re-check. Deliver only after a clean pass. A "clean pass" still lists what was verified and how.
