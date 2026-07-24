#!/usr/bin/env python3
import re

with open('nodes/options.py', 'r') as f:
    content = f.read()

# Find the LINK_ONLY filter block and add new filters after it
link_only_block = r'(\s+\{\s+"or":\s+\[\s+\{"param_compare":\s+\["\$LINK_ONLY",\s+"==",\s+False\]\},\s+\{"embed_type":\s+\["==",\s+"link"\]\}\s+\],\s+"metadata":\s+\{\}\s+\},)'

new_filters = r'''\1
                    {
                        "or": [
                            {"param_compare": ["$GIF_ONLY", "==", False]},
                            {"attribute_compare": ["embed.presentation", "==", "gif"]}
                        ],
                        "metadata": {}
                    },
                    {
                        "or": [
                            {"param_compare": ["$VIDEO_ONLY", "==", False]},
                            {"embed_type": ["==", "video"]}
                        ],
                        "metadata": {}
                    },
                    {
                        "or": [
                            {"param_compare": ["$TEXT_ONLY", "==", False]},
                            {"attribute_compare": ["embed", "==", None]}
                        ],
                        "metadata": {}
                    },'''

content = re.sub(link_only_block, new_filters, content, flags=re.DOTALL)

# Add parameters after LINK_ONLY parameter
link_param = r'(\{\s+"name":\s+"LINK_ONLY",\s+"displayName":\s+"Links Only",\s+"type":\s+"toggle",\s+"description":\s+"Only show posts with link cards \(great for news feeds\)\.",\s+"exampleValue":\s+False,\s+"group":\s+"content_types"\s+\},)'

new_params = r'''\1
                        {
                            "name": "GIF_ONLY",
                            "displayName": "GIFs Only",
                            "type": "toggle",
                            "description": "Only show posts with GIFs.",
                            "exampleValue": False,
                            "group": "content_types"
                        },
                        {
                            "name": "VIDEO_ONLY",
                            "displayName": "Videos Only",
                            "type": "toggle",
                            "description": "Only show posts with videos. WARNING: Enables video feed UI mode.",
                            "exampleValue": False,
                            "group": "content_types"
                        },
                        {
                            "name": "TEXT_ONLY",
                            "displayName": "Text Only",
                            "type": "toggle",
                            "description": "Only show text posts without any embeds (no images, videos, links, etc).",
                            "exampleValue": False,
                            "group": "content_types"
                        },'''

content = re.sub(link_param, new_params, content, flags=re.DOTALL)

with open('nodes/options.py', 'w') as f:
    f.write(content)

print("Added GIF Only, Video Only, and Text Only filters")
