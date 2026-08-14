/** Mode-tab strings. The tabs name modes, not the presets behind them. */
export type ModeTabsLocaleKey = 'modes' | 'work' | 'code' | 'design'

/** XYZ-OS is English-only: both locale tables carry the same English copy. */
export const en: Record<ModeTabsLocaleKey, string> = {
  modes: 'Modes',
  work: 'Work',
  code: 'Code',
  design: 'Design',
}

export const zh: Record<ModeTabsLocaleKey, string> = en
