/** Durable settings namespace for product-wide GUI onboarding facts. */
export const WELCOME_NOTICE_SETTINGS_NAMESPACE = 'ui-onboarding'

/** Field storing the last welcome notice version the user acknowledged. */
export const WELCOME_NOTICE_ACK_FIELD = 'welcomeNoticeVersion'

/**
 * Bump only when the notice changes materially and every user should see it
 * again. The acknowledgement is compared for exact equality.
 */
export const WELCOME_NOTICE_VERSION = '2026-08-13.1'

/** The complete editable internal-testing notice in both supported GUI locales. */
export const WELCOME_NOTICE_COPY = {
  zh: {
    title: '个人定制声明',
    body: 'XYZ-OS 是基于 DeepSeek Harness（MIT 协议）的个人定制版本：专属品牌、红色主题、三种模式（工作 / 代码 / 设计）。上游引擎仍在快速迭代，本定制版会定期同步更新。\n\n这是我的 OS。',
    continueLabel: '继续',
  },
  en: {
    title: 'Personal Build Notice',
    body: 'XYZ-OS is a personal build on top of DeepSeek Harness (MIT) — custom brand, red theme, and three modes (Work / Code / Design). The upstream engine is still evolving fast, so this build is kept in sync with it regularly.\n\nIt is my OS.',
    continueLabel: 'Continue',
  },
} as const
