metadata = {
    "id": "engagement_ratio",
    "name": "Engagement & Ratio Filter",
    "description": "Filter by parent post engagement and follower/following ratio to surface quality content and accounts",
    "color": "blue",
    "version": "1.0.0",
    "author": "Custom Nodes System",
    "tags": ["engagement", "quality", "ratio"]
}

def get_manifest(options=None):
    return {
        "filter": {
            "and": [
                {
                    "or": [
                        {"param_compare": ["$MIN_PARENT_LIKES", "==", 0]},
                        {"attribute_compare": ["hydrated_metadata.parent_post.like_count", ">=", "$MIN_PARENT_LIKES"]}
                    ]
                },
                {
                    "or": [
                        {"param_compare": ["$MAX_FOLLOWING_RATIO", "==", 0]},
                        {"attribute_compare": ["hydrated_metadata.user.follows_count", "<=", "$MAX_FOLLOWING_CALC"]}
                    ]
                }
            ],
            "metadata": {
                "color": "blue",
                "customNodeParameters": [
                    {"name": "MIN_PARENT_LIKES", "type": "number", "displayName": "Min Parent Post Likes", "description": "For replies/quotes, require parent post to have at least this many likes (0 = disabled)", "exampleValue": 0},
                    {"name": "MAX_FOLLOWING_RATIO", "type": "number", "displayName": "Max Following/Follower Ratio", "description": "Block accounts following more than X times their followers (0 = disabled, 5 = following < 5x followers)", "exampleValue": 0}
                ]
            }
        }
    }
