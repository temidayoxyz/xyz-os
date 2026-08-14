/**
 * Sidebar mode-switch hole: declared by this package (declaring is claiming);
 * ui-sidebar renders it between New Session and the workspace browser and
 * passes only its column state. Business data and actions arrive through the
 * registrant's own inject.
 */

import type { ModeTabsLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    'sidebar.modes': { kind: 'single'; scope: 'root'; owner: SidebarModesOwnerProps }
  }
  interface LocaleNamespaceMap {
    /** The mode switch's copy. */
    'sidebar.modes': ModeTabsLocaleKey
  }
}

/** Owner share of the mode-switch hole. */
export interface SidebarModesOwnerProps {
  /** Whether the sidebar renders wide content (false = 56px rail). */
  wide: boolean
}
