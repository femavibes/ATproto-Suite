/**
 * Modern Ozone report reasons (tools.ozone.report.defs) plus legacy
 * com.atproto.moderation.defs aliases that still appear on older clients.
 *
 * Authority-only reasons are never forwarded to community labelers — listed
 * for completeness but omitted from default UI / env generation.
 */

export const OZONE_REPORT_NS = "tools.ozone.report.defs";
export const LEGACY_REPORT_NS = "com.atproto.moderation.defs";

export type ReportReasonDef = {
  /** camelCase short id used in env: REPORT_REASON_<id> */
  id: string;
  /** Full NSID token on the event */
  nsid: string;
  label: string;
  category: string;
  /** Never reaches community labelers */
  authorityOnly?: boolean;
};

export const REPORT_REASON_CATEGORIES: { id: string; label: string }[] = [
  { id: "misleading", label: "Misleading" },
  { id: "harassment", label: "Harassment or hate" },
  { id: "sexual", label: "Sexual / adult" },
  { id: "violence", label: "Violence / physical harm" },
  { id: "selfharm", label: "Self-harm / dangerous" },
  { id: "child", label: "Child safety" },
  { id: "rule", label: "Network rules" },
  { id: "other", label: "Other / appeal" },
];

export const REPORT_REASONS: ReportReasonDef[] = [
  // Misleading
  { id: "misleadingBot", nsid: `${OZONE_REPORT_NS}#reasonMisleadingBot`, label: "Fake account or bot", category: "misleading" },
  { id: "misleadingImpersonation", nsid: `${OZONE_REPORT_NS}#reasonMisleadingImpersonation`, label: "Impersonation", category: "misleading" },
  { id: "misleadingSpam", nsid: `${OZONE_REPORT_NS}#reasonMisleadingSpam`, label: "Spam", category: "misleading" },
  { id: "misleadingScam", nsid: `${OZONE_REPORT_NS}#reasonMisleadingScam`, label: "Scam", category: "misleading" },
  { id: "misleadingElections", nsid: `${OZONE_REPORT_NS}#reasonMisleadingElections`, label: "Election misinfo", category: "misleading" },
  { id: "misleadingOther", nsid: `${OZONE_REPORT_NS}#reasonMisleadingOther`, label: "Other misleading", category: "misleading" },
  // Harassment
  { id: "harassmentTroll", nsid: `${OZONE_REPORT_NS}#reasonHarassmentTroll`, label: "Trolling", category: "harassment" },
  { id: "harassmentTargeted", nsid: `${OZONE_REPORT_NS}#reasonHarassmentTargeted`, label: "Targeted harassment", category: "harassment" },
  { id: "harassmentHateSpeech", nsid: `${OZONE_REPORT_NS}#reasonHarassmentHateSpeech`, label: "Hate speech", category: "harassment" },
  { id: "harassmentDoxxing", nsid: `${OZONE_REPORT_NS}#reasonHarassmentDoxxing`, label: "Doxxing", category: "harassment" },
  { id: "harassmentOther", nsid: `${OZONE_REPORT_NS}#reasonHarassmentOther`, label: "Other harassment", category: "harassment" },
  // Sexual
  { id: "sexualUnlabeled", nsid: `${OZONE_REPORT_NS}#reasonSexualUnlabeled`, label: "Unlabelled adult content", category: "sexual" },
  { id: "sexualNCII", nsid: `${OZONE_REPORT_NS}#reasonSexualNCII`, label: "Non-consensual intimate imagery", category: "sexual" },
  { id: "sexualDeepfake", nsid: `${OZONE_REPORT_NS}#reasonSexualDeepfake`, label: "Deepfake adult content", category: "sexual" },
  { id: "sexualAbuseContent", nsid: `${OZONE_REPORT_NS}#reasonSexualAbuseContent`, label: "Adult sexual abuse", category: "sexual" },
  { id: "sexualAnimal", nsid: `${OZONE_REPORT_NS}#reasonSexualAnimal`, label: "Animal sexual abuse", category: "sexual" },
  { id: "sexualOther", nsid: `${OZONE_REPORT_NS}#reasonSexualOther`, label: "Other sexual", category: "sexual" },
  // Violence
  { id: "violenceThreats", nsid: `${OZONE_REPORT_NS}#reasonViolenceThreats`, label: "Threats or incitement", category: "violence" },
  { id: "violenceGraphicContent", nsid: `${OZONE_REPORT_NS}#reasonViolenceGraphicContent`, label: "Graphic violence", category: "violence" },
  { id: "violenceGlorification", nsid: `${OZONE_REPORT_NS}#reasonViolenceGlorification`, label: "Glorification of violence", category: "violence" },
  { id: "violenceAnimal", nsid: `${OZONE_REPORT_NS}#reasonViolenceAnimal`, label: "Animal welfare", category: "violence" },
  { id: "violenceTrafficking", nsid: `${OZONE_REPORT_NS}#reasonViolenceTrafficking`, label: "Human trafficking", category: "violence" },
  { id: "violenceExtremistContent", nsid: `${OZONE_REPORT_NS}#reasonViolenceExtremistContent`, label: "Extremist content", category: "violence", authorityOnly: true },
  { id: "violenceOther", nsid: `${OZONE_REPORT_NS}#reasonViolenceOther`, label: "Other violent content", category: "violence" },
  // Self-harm
  { id: "selfHarmContent", nsid: `${OZONE_REPORT_NS}#reasonSelfHarmContent`, label: "Self-harm content", category: "selfharm" },
  { id: "selfHarmED", nsid: `${OZONE_REPORT_NS}#reasonSelfHarmED`, label: "Eating disorders", category: "selfharm" },
  { id: "selfHarmStunts", nsid: `${OZONE_REPORT_NS}#reasonSelfHarmStunts`, label: "Dangerous challenges", category: "selfharm" },
  { id: "selfHarmSubstances", nsid: `${OZONE_REPORT_NS}#reasonSelfHarmSubstances`, label: "Dangerous substances", category: "selfharm" },
  { id: "selfHarmOther", nsid: `${OZONE_REPORT_NS}#reasonSelfHarmOther`, label: "Other dangerous content", category: "selfharm" },
  // Child safety
  { id: "childSafetyPrivacy", nsid: `${OZONE_REPORT_NS}#reasonChildSafetyPrivacy`, label: "Minor privacy violation", category: "child" },
  { id: "childSafetyHarassment", nsid: `${OZONE_REPORT_NS}#reasonChildSafetyHarassment`, label: "Minor harassment / bullying", category: "child" },
  { id: "childSafetyCSAM", nsid: `${OZONE_REPORT_NS}#reasonChildSafetyCSAM`, label: "CSAM", category: "child", authorityOnly: true },
  { id: "childSafetyGroom", nsid: `${OZONE_REPORT_NS}#reasonChildSafetyGroom`, label: "Grooming", category: "child", authorityOnly: true },
  { id: "childSafetyOther", nsid: `${OZONE_REPORT_NS}#reasonChildSafetyOther`, label: "Other child safety", category: "child", authorityOnly: true },
  // Rules
  { id: "ruleSiteSecurity", nsid: `${OZONE_REPORT_NS}#reasonRuleSiteSecurity`, label: "Hacking / system attacks", category: "rule" },
  { id: "ruleProhibitedSales", nsid: `${OZONE_REPORT_NS}#reasonRuleProhibitedSales`, label: "Prohibited sales", category: "rule" },
  { id: "ruleBanEvasion", nsid: `${OZONE_REPORT_NS}#reasonRuleBanEvasion`, label: "Ban evasion", category: "rule" },
  { id: "ruleOther", nsid: `${OZONE_REPORT_NS}#reasonRuleOther`, label: "Other rule break", category: "rule" },
  // Other
  { id: "other", nsid: `${OZONE_REPORT_NS}#reasonOther`, label: "Other", category: "other" },
  { id: "appeal", nsid: `${OZONE_REPORT_NS}#reasonAppeal`, label: "Appeal", category: "other" },
];

/** Legacy reason → preferred modern equivalent (still accept both on ingest). */
export const LEGACY_REASON_TO_MODERN: Record<string, string> = {
  [`${LEGACY_REPORT_NS}#reasonSpam`]: `${OZONE_REPORT_NS}#reasonMisleadingSpam`,
  [`${LEGACY_REPORT_NS}#reasonViolation`]: `${OZONE_REPORT_NS}#reasonRuleOther`,
  [`${LEGACY_REPORT_NS}#reasonMisleading`]: `${OZONE_REPORT_NS}#reasonMisleadingOther`,
  [`${LEGACY_REPORT_NS}#reasonSexual`]: `${OZONE_REPORT_NS}#reasonSexualUnlabeled`,
  [`${LEGACY_REPORT_NS}#reasonRude`]: `${OZONE_REPORT_NS}#reasonHarassmentOther`,
  [`${LEGACY_REPORT_NS}#reasonOther`]: `${OZONE_REPORT_NS}#reasonOther`,
  [`${LEGACY_REPORT_NS}#reasonAppeal`]: `${OZONE_REPORT_NS}#reasonAppeal`,
};

/** Old env REPORT_TYPE_* → modern reason id */
export const LEGACY_ENV_TO_REASON_ID: Record<string, string> = {
  REPORT_TYPE_SPAM: "misleadingSpam",
  REPORT_TYPE_VIOLATION: "ruleOther",
  REPORT_TYPE_MISLEADING: "misleadingOther",
  REPORT_TYPE_SEXUAL: "sexualUnlabeled",
  REPORT_TYPE_RUDE: "harassmentOther",
  REPORT_TYPE_OTHER: "other",
};

function splitLabels(raw: string | undefined): string[] {
  return (raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Build nsid → labels map from process.env.
 * Prefers REPORT_REASON_<id>; falls back to legacy REPORT_TYPE_*.
 */
export function loadReportReasonLabelMap(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>
): Record<string, string[]> {
  const byId = new Map<string, string[]>();

  for (const def of REPORT_REASONS) {
    const modernKey = `REPORT_REASON_${def.id}`;
    const fromModern = splitLabels(env[modernKey]);
    if (fromModern.length) byId.set(def.id, fromModern);
  }

  for (const [envKey, reasonId] of Object.entries(LEGACY_ENV_TO_REASON_ID)) {
    const fromLegacy = splitLabels(env[envKey]);
    if (!fromLegacy.length) continue;
    const existing = byId.get(reasonId) || [];
    const merged = [...new Set([...existing, ...fromLegacy])];
    byId.set(reasonId, merged);
  }

  const out: Record<string, string[]> = {};
  for (const def of REPORT_REASONS) {
    const labels = byId.get(def.id);
    if (!labels?.length) continue;
    out[def.nsid] = labels;
    // Also accept legacy token if this id is a preferred migration target
    for (const [legacy, modern] of Object.entries(LEGACY_REASON_TO_MODERN)) {
      if (modern === def.nsid) out[legacy] = labels;
    }
  }
  return out;
}

export function labelsForReportReason(
  reportType: string | undefined,
  map: Record<string, string[]>
): string[] {
  if (!reportType) return [];
  if (map[reportType]?.length) return map[reportType];
  const modern = LEGACY_REASON_TO_MODERN[reportType];
  if (modern && map[modern]?.length) return map[modern];
  return [];
}
