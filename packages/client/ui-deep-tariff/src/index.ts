/**
 * DeepSeek tariff chip, node half. The host resolver lives in
 * `@deepseek-ai/dsh-deep-tariff`; this entry exists so the plugin appears in
 * the Loader tree. The browser half ships via `exports["./client"]`.
 */

/** Host plugin body — no host-side behavior for this UI plugin. */
export function apply(): void {}
