export interface User {
  id: number;
  did: string;
  handle: string;
  bsky_password?: string;
  password_type?: 'app' | 'basic';
  user_decrypt_url?: string;
  subscription_tier: 'none' | 'free' | 'paid' | 'premium';
  is_admin: boolean;
  backfill_count: number;
  backfill_count_25?: number;
  backfill_count_50?: number;
  backfill_count_100?: number;
  backfill_reset_date: Date;
  last_sync_at?: Date;
  global_ban_list?: string;
  avatar?: string;
  display_name?: string;
  zero_trust_mode?: boolean;
  zero_trust_proxy_url?: string;
  zero_trust_api_key?: string;
  zero_trust_status?: 'inactive' | 'pending' | 'active' | 'offline';
  created_at: Date;
  updated_at: Date;
}

export interface Feed {
  id: number;
  user_id: number;
  feed_id: string;
  feed_name: string;
  feed_display_name?: string;
  feed_slug?: string;
  feed_url?: string;
  bluesky_feed_name?: string;
  
  // Legacy opt-ins (will be deprecated)
  opt_in_spam: boolean;
  opt_in_misleading: boolean;
  opt_in_sexual: boolean;
  opt_in_harassment: boolean;
  opt_in_illegal: boolean;
  opt_in_other: boolean;
  
  // New hierarchical opt-ins (30 subcategories)
  // misleading (6 types)
  opt_in_misleading_spam: boolean;
  opt_in_misleading_scam: boolean;
  opt_in_misleading_bot: boolean;
  opt_in_misleading_impersonation: boolean;
  opt_in_misleading_elections: boolean;
  opt_in_misleading_other: boolean;
  
  // harassment (5 types)
  opt_in_harassment_troll: boolean;
  opt_in_harassment_targeted: boolean;
  opt_in_harassment_hate_speech: boolean;
  opt_in_harassment_doxxing: boolean;
  opt_in_harassment_other: boolean;
  
  // violence (6 types)
  opt_in_violence_animal: boolean;
  opt_in_violence_threats: boolean;
  opt_in_violence_graphic_content: boolean;
  opt_in_violence_glorification: boolean;
  opt_in_violence_trafficking: boolean;
  opt_in_violence_other: boolean;
  
  // sexual (6 types)
  opt_in_sexual_unlabeled: boolean;
  opt_in_sexual_abuse_content: boolean;
  opt_in_sexual_ncii: boolean;
  opt_in_sexual_deepfake: boolean;
  opt_in_sexual_animal: boolean;
  opt_in_sexual_other: boolean;
  
  // child-safety (2 types)
  opt_in_child_safety_privacy: boolean;
  opt_in_child_safety_harassment: boolean;
  
  // self-harm (5 types)
  opt_in_self_harm_content: boolean;
  opt_in_self_harm_ed: boolean;
  opt_in_self_harm_stunts: boolean;
  opt_in_self_harm_substances: boolean;
  opt_in_self_harm_other: boolean;
  
  // rule (4 types)
  opt_in_rule_site_security: boolean;
  opt_in_rule_prohibited_sales: boolean;
  opt_in_rule_ban_evasion: boolean;
  opt_in_rule_other: boolean;
  
  // Legacy thresholds
  threshold_spam: number;
  threshold_misleading: number;
  threshold_sexual: number;
  threshold_harassment: number;
  threshold_illegal: number;
  threshold_other: number;
  
  // New main category thresholds (8 categories)
  threshold_violence: number;
  threshold_child_safety: number;
  threshold_self_harm: number;
  threshold_rule: number;
  
  // Subcategory threshold overrides (NULL = use main category)
  // misleading subcategory thresholds
  threshold_misleading_spam?: number;
  threshold_misleading_scam?: number;
  threshold_misleading_bot?: number;
  threshold_misleading_impersonation?: number;
  threshold_misleading_elections?: number;
  threshold_misleading_other?: number;
  
  // harassment subcategory thresholds
  threshold_harassment_troll?: number;
  threshold_harassment_targeted?: number;
  threshold_harassment_hate_speech?: number;
  threshold_harassment_doxxing?: number;
  threshold_harassment_other?: number;
  
  // violence subcategory thresholds
  threshold_violence_animal?: number;
  threshold_violence_threats?: number;
  threshold_violence_graphic_content?: number;
  threshold_violence_glorification?: number;
  threshold_violence_trafficking?: number;
  threshold_violence_other?: number;
  
  // sexual subcategory thresholds
  threshold_sexual_unlabeled?: number;
  threshold_sexual_abuse_content?: number;
  threshold_sexual_ncii?: number;
  threshold_sexual_deepfake?: number;
  threshold_sexual_animal?: number;
  threshold_sexual_other?: number;
  
  // child-safety subcategory thresholds
  threshold_child_safety_privacy?: number;
  threshold_child_safety_harassment?: number;
  
  // self-harm subcategory thresholds
  threshold_self_harm_content?: number;
  threshold_self_harm_ed?: number;
  threshold_self_harm_stunts?: number;
  threshold_self_harm_substances?: number;
  threshold_self_harm_other?: number;
  
  // rule subcategory thresholds
  threshold_rule_site_security?: number;
  threshold_rule_prohibited_sales?: number;
  threshold_rule_ban_evasion?: number;
  threshold_rule_other?: number;
  
  // other subcategory threshold
  threshold_other_main?: number;
  
  cross_type_percentage: number;
  global_ban_list?: string;
  feed_ban_list?: string;
  created_at: Date;
}

export interface PostReport {
  id: number;
  post_uri: string;
  report_type: string;
  reporter_did: string;
  reported_at: Date;
}

export interface ModerationAction {
  post_uri?: string;
  account_did?: string;
  action: string;
  feed_id?: string;
  moderator_did: string;
  reason?: string;
  target_handle?: string;
}

export interface ReportCommand {
  action: 'remove' | 'add';
  target: 'post' | 'account' | 'auto';
  feeds: string[] | 'all';
  labels?: string[];
}

// New multi-user command interfaces
export interface MultiUserCommand {
  reporterDid: string;
  action: 'remove' | 'label' | 'block-user';
  scope: 'all-my-feeds' | 'specific-feeds';
  feedIds?: string[];
  customLabel?: string;
  reason?: string;
}

export interface CommandCandidate {
  text: string;
  confidence: number;
  parsedAction: string | null;
  parsedScope: string | null;
  parsedFeeds: string[] | null;
}

export interface ValidatedCommand {
  action: 'remove' | 'ban' | 'label';
  feedIds: string[];
  customLabel?: string;
  reason?: string;
}

export interface CommandExecution {
  id: number;
  reporter_did: string;
  post_uri: string;
  command_type: string;
  command_text: string;
  affected_feeds: string[];
  execution_status: 'success' | 'failed' | 'unauthorized';
  error_message?: string;
  created_at: Date;
}

export interface ZeroTrustProxyAuth {
  sessionCookie?: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface ZeroTrustOperation {
  id: number;
  user_id: number;
  operation_type: 'graze_remove' | 'graze_restore' | 'list_add' | 'list_remove';
  operation_data: any;
  retry_count: number;
  max_retries: number;
  next_retry_at?: Date;
  created_at: Date;
  expires_at: Date;
}