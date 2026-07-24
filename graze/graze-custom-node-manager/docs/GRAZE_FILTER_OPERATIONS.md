# Filter Operations Guide

Complete reference for all Graze filter operations and syntax.

## Logical Operators

### and (All of these)
All conditions must be true
```json
{"and": [{...}, {...}], "metadata": {}}
```

### or (Any of these)
At least one condition must be true
```json
{"or": [{...}, {...}], "metadata": {}}
```

## Text Matching

### regex_matches (Regex - Contains)
Match single regex pattern (manual regex control)
```json
{"regex_matches": ["text", "\\bword\\b", true]}
```
**Parameters:** field, pattern, case_insensitive  
**case_insensitive:** true (default) | false (case sensitive)

### regex_negation_matches (Regex - Missing)
Negation match - excludes matching patterns
```json
{"regex_negation_matches": ["text", "\\bword\\b", true]}
```
**Parameters:** field, pattern, case_insensitive  
**case_insensitive:** true (default) | false (case sensitive)

### regex_any (Word List - Contains)
Match any pattern from list
```json
{"regex_any": ["text", ["cat", "dog"], true, false]}
```
**Parameters:** field, patterns, case_insensitive, multiline  
**case_insensitive:** true (default) | false (case sensitive)  
**multiline:** false (word list, auto \b) | true (regex mode)

### regex_none (Word List - Missing)
Match none of the patterns - excludes all
```json
{"regex_none": ["text", ["spam"], true, false]}
```
**Parameters:** field, patterns, case_insensitive, multiline  
**case_insensitive:** true (default) | false (case sensitive)  
**multiline:** false (word list, auto \b) | true (regex mode)

## Content Type

### embed_type
Filter by embed type
```json
{"embed_type": ["==", "video"]}
```
**Types:** video, image, image_group, link, post, gif

**ℹ️ Note:** "video" type has special behavior - it enables video feed UI mode. This cannot be toggled conditionally in custom nodes.

**⚠️ Note:** The "gif" type may be unreliable. Use attribute_compare with embed.presentation instead:
```json
{"attribute_compare": ["embed.presentation", "==", "gif"]}
```

### post_type
Filter by post type
```json
{"post_type": ["not_in", ["reply"]]}
```
**Types:** reply, quote

### entity_matches
Match hashtags, langs, domains, mentions
```json
{"entity_matches": ["langs", ["en", "es"]]}
```
**Entities:** langs, urls, domains, mentions, hashtags

### entity_excludes
Exclude hashtags, domains, mentions
```json
{"entity_excludes": ["domains", ["example.com"]]}
```
**Entities:** domains, mentions, hashtags, labels

## Social Graph

### social_graph
Check follower/following relationships
```json
{"social_graph": ["user.bsky.social", "in", "followers"]}
```

### list_member
Check list membership
```json
{"list_member": ["https://bsky.app/profile/.../lists/...", "in"]}
```

### starter_pack_member
Check starter pack membership
```json
{"starter_pack_member": ["https://bsky.app/starter-pack/...", "in"]}
```

### social_list
Explicit DID list
```json
{"social_list": [["did:plc:abc", "did:plc:def"], "in"]}
```

## Comparison

### attribute_compare
Compare post attributes to values
```json
{"attribute_compare": ["embed.video.size", ">=", "$MIN_SIZE"]}
```

### param_compare
Compare parameter values
```json
{"param_compare": ["$ENABLED", "==", true]}
```

## ML Models

### sentiment_analysis
Sentiment classification
```json
{"sentiment_analysis": ["Positive", ">=", 0.5]}
```
**Categories:** Positive, Negative, Neutral

### emotion_sentiment_analysis
Emotion detection (GoEmotions)
```json
{"emotion_sentiment_analysis": ["Joy", ">=", 0.5]}
```
**28 emotions:** Joy, Anger, Fear, Sadness, etc.

### toxicity_analysis
Toxicity detection
```json
{"toxicity_analysis": ["Toxic", "<=", 0.5]}
```
**Categories:** Toxic, Severe Toxicity, Obscene, Threat, Insult, Identity Hate

### topic_analysis
Topic classification
```json
{"topic_analysis": ["Gaming", ">=", 0.5]}
```
**20+ topics:** Gaming, Sports, Tech, News, etc.

### language_analysis
Advanced language detection
```json
{"language_analysis": ["Spanish", ">=", 0.5]}
```
**20+ languages supported**

### text_similarity
Semantic similarity using transformers
```json
{"text_similarity": ["text", {"anchor_text": "...", "model_name": "all-MiniLM-L6-v2"}, ">=", 0.3]}
```

### text_arbitrary
Custom text label classification
```json
{"text_arbitrary": ["scotland", ">=", 0.5]}
```

### image_nsfw
NSFW image detection
```json
{"image_nsfw": ["NSFW", "<=", 0.5]}
```
**Categories:** NSFW, SFW

### image_arbitrary
Custom image label classification (CLIP)
```json
{"image_arbitrary": ["scotland", ">=", 0.5, 0.0]}
```

## Special Operations

### each
Loop over list parameters (not a logic node)
```json
{"each": ["$LIST", {...}]}
```
**Use $PARAM_NAME_ITEM to reference current item**
