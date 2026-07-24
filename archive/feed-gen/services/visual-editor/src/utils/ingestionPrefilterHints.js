/**
 * Jetstream / ingestion prefilter hints derived from the graph.
 *
 * - Only walks from the root `start` node — not Manual Posts or future import modules —
 *   so jetstream indexing never depends on manually listed URIs.
 * - OR-safe flags: if true, ingestion must NOT drop posts solely for failing keyword/language gates.
 *
 * Mirror this contract in the Python worker; validate with shared fixtures.
 */

import { computeFeedScopedNodeIds, isConditionType } from './graphEvaluator'

/**
 * @param {Array} nodes
 * @param {Array} edges
 * @returns {{
 *   ok: boolean,
 *   reason?: string,
 *   jetstreamSeedId?: string,
 *   keywordStems: string[],
 *   languageCodes: string[],
 *   unsafeToDropForKeywordGate: boolean,
 *   unsafeToDropForLanguageGate: boolean,
 *   notes: string[],
 * }}
 */
export function extractJetstreamPrefilterHints(nodes, edges) {
  const notes = []

  const rootStart = nodes.find(
    (n) => n.type === 'start' && !n.data?.containerParent
  )
  if (!rootStart) {
    return {
      ok: false,
      reason: 'No root START node — jetstream scope undefined',
      keywordStems: [],
      languageCodes: [],
      unsafeToDropForKeywordGate: true,
      unsafeToDropForLanguageGate: true,
      notes,
    }
  }

  const scope = computeFeedScopedNodeIds(rootStart.id, nodes, edges)
  const condNodes = nodes.filter((n) => scope.has(n.id) && isConditionType(n.type))

  const keywordStems = new Set()
  let hasTextOrRegex = false
  for (const n of condNodes) {
    if (n.type === 'text') {
      hasTextOrRegex = true
      for (const kw of n.data?.keywords || []) {
        const value = typeof kw === 'string' ? kw : kw?.value
        const t = String(value || '').trim().toLowerCase()
        if (t) keywordStems.add(t)
      }
    }
    if (n.type === 'regex') {
      hasTextOrRegex = true
      const p = n.data?.pattern
      if (p && String(p).trim()) keywordStems.add(`regex:${String(p).slice(0, 64)}`)
    }
  }

  const languageCodes = new Set()
  let hasLanguageCondition = false
  for (const n of condNodes) {
    if (n.type !== 'language') continue
    hasLanguageCondition = true
    for (const lang of n.data?.languages || []) {
      const t = String(lang).trim().toLowerCase()
      if (t) languageCodes.add(t)
    }
  }

  const hasNonTextRegexCondition = condNodes.some(
    (n) => n.type !== 'text' && n.type !== 'regex'
  )

  // Keyword-only gate is unsafe unless every match must go through text/regex.
  const unsafeToDropForKeywordGate = !hasTextOrRegex || hasNonTextRegexCondition

  // Language gate is unsafe if there is no language node, or any non–(language|text|regex)
  // condition could admit posts without satisfying language (OR branches).
  const hasOnlyLanguageTextRegex = condNodes.every((n) =>
    ['language', 'text', 'regex'].includes(n.type)
  )
  const unsafeToDropForLanguageGate =
    !hasLanguageCondition || !hasOnlyLanguageTextRegex

  if (hasNonTextRegexCondition) {
    notes.push(
      'In-scope conditions include types other than text/regex; do not exclude jetstream posts using keyword stems alone.'
    )
  }
  if (unsafeToDropForLanguageGate && hasLanguageCondition) {
    notes.push(
      'Language nodes coexist with other condition types; language-only prefilter is not sufficient to drop posts safely.'
    )
  }
  if (hasTextOrRegex && !hasNonTextRegexCondition) {
    notes.push(
      'Only text/regex filters in scope — keyword union can safely narrow jetstream candidates.'
    )
  }

  return {
    ok: true,
    jetstreamSeedId: rootStart.id,
    keywordStems: [...keywordStems],
    languageCodes: [...languageCodes],
    unsafeToDropForKeywordGate,
    unsafeToDropForLanguageGate,
    notes,
  }
}
