/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-deep-tariff`.
 * @module @deepseek-ai/dsh-deep-tariff/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-deep-tariff'

/** Cordis companion plugin name. */
export const name = 'deep-tariff-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: tariff snapshots are per-call outputs of a pure
 * function of wall time, an IANA zone, and a validated rate table. The
 * service holds no event stream or cross-plugin mutable data.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
