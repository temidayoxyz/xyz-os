/** Mode-tab strings. The tabs name the modes, not the presets behind them. */
export type ModeTabsLocaleKey = 'modes' | 'work' | 'code' | 'design'

/** XYZ-OS is English-only: both locale tables carry the same English copy. */
export const en: Record<ModeTabsLocaleKey, string> = {
  modes: 'Modes',
  work: 'Coworker',
  code: 'Coder',
  design: 'Designer',
}

export const zh: Record<ModeTabsLocaleKey, string> = en
