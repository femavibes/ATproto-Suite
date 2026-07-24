#!/usr/bin/env python3
import re

with open('nodes/options.py', 'r') as f:
    content = f.read()

# Our improved regex pattern
new_pattern = r'(?:\\w+(?:[\'\\u2019\\-]\\w+)?(?:\\s+|[.,;:!?\\"\\u201c\\u201d]+)){$ALT_TEXT_WORDS,}'

# Replace all 4 occurrences of the complex conditional blocks
# Pattern 1: embed.images[*].alt with True, True
old1 = r'\{\s*"or":\s*\[\s*\{"and":\s*\[\{"param_compare":\s*\["\$ALT_TEXT_WORDS",\s*"==",\s*1\]\},\s*\{"regex_any":\s*\["embed\.images\[\*\]\.alt",\s*\["\\\\S\+"\],\s*True,\s*True\]\}\]\},.*?\{"and":\s*\[\{"param_compare":\s*\["\$ALT_TEXT_WORDS",\s*">",\s*5\]\},\s*\{"regex_any":\s*\["embed\.images\[\*\]\.alt",\s*\["\\\\S\+\(\\\\s\+\\\\S\+\)\{5,\}"\],\s*True,\s*True\]\}\]\}\s*\],\s*"metadata":\s*\{\}\s*\}'
new1 = '{"regex_any": ["embed.images[*].alt", ["' + new_pattern + '"], True, True]}'

# Pattern 2: embed.media.images[*].alt with True, False
old2 = r'\{\s*"or":\s*\[\s*\{"and":\s*\[\{"param_compare":\s*\["\$ALT_TEXT_WORDS",\s*"==",\s*1\]\},\s*\{"regex_any":\s*\["embed\.media\.images\[\*\]\.alt",\s*\["\\\\S\+"\],\s*True,\s*False\]\}\]\},.*?\{"and":\s*\[\{"param_compare":\s*\["\$ALT_TEXT_WORDS",\s*">",\s*5\]\},\s*\{"regex_any":\s*\["embed\.media\.images\[\*\]\.alt",\s*\["\\\\S\+\(\\\\s\+\\\\S\+\)\{5,\}"\],\s*True,\s*False\]\}\]\}\s*\],\s*"metadata":\s*\{\}\s*\}'
new2 = '{"regex_any": ["embed.media.images[*].alt", ["' + new_pattern + '"], True, False]}'

content = re.sub(old1, new1, content, flags=re.DOTALL)
content = re.sub(old2, new2, content, flags=re.DOTALL)

# Update description
content = content.replace(
    '"description": "Minimum words required in alt text. Supports 1-5 words precisely, 6+ uses 6+ word pattern."',
    '"description": "Minimum words required in alt text. Handles contractions, hyphens, and punctuation correctly."'
)

with open('nodes/options.py', 'w') as f:
    f.write(content)

print("Successfully updated options.py")
