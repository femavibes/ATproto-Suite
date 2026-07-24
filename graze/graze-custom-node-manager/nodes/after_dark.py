"""
After Dark Time Filter
Filters posts created between 10pm-4am UTC
"""

metadata = {
    "id": "after_dark",
    "name": "After Dark Time Filter",
    "description": "Filter posts by time of day (10pm-4am UTC). Perfect for 'after dark' feeds or late-night content.",
    "color": "purple",
    "version": "1.0.0",
    "author": "AI Assistant",
    "tags": ["time", "filter", "utility"],
    "configurable": {
        "title": {
            "type": "text",
            "label": "Node Title",
            "default": "After Dark Time Filter",
            "required": True
        },
        "description": {
            "type": "textarea",
            "label": "Node Description",
            "default": "Filter posts by time of day (10pm-4am UTC). Toggle on to enable time filtering.",
            "required": True
        }
    }
}

def get_manifest(options=None):
    """Generate the filter manifest"""
    return {
        "filter": {
            "or": [
                {
                    "param_compare": ["$ENABLE_TIME_FILTER", "==", False]
                },
                {
                    "or": [
                        {"regex_matches": ["createdAt", "T(22|23):", True]},
                        {"regex_matches": ["createdAt", "T(00|01|02|03):", True]}
                    ],
                    "metadata": {}
                }
            ],
            "metadata": {
                "color": "purple",
                "customNodeParameters": [
                    {
                        "name": "ENABLE_TIME_FILTER",
                        "type": "toggle",
                        "displayName": "Enable After Dark Filter (10pm-4am UTC)",
                        "description": "Toggle to only show posts created between 10pm and 4am UTC. Great for 'after dark' feeds or late-night content.",
                        "exampleValue": True
                    }
                ]
            }
        }
    }
