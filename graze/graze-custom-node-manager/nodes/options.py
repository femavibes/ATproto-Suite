"""
Options - Comprehensive custom node with membership, content, and social graph filters
"""

metadata = {
    "id": "options",
    "name": "Options",
    "description": "Comprehensive feed customization with membership, content types, accessibility, language, and social graph filters.",
    "color": "green",
    "version": "2.0.0",
    "author": "Custom Nodes System",
    "tags": ["membership", "content", "social", "language", "accessibility"],
    "configurable": {}
}

def get_manifest(options=None):
    """Generate the filter manifest"""
    return {
        "filter": {
                "and": [
                    # Membership filters - MUST MATCH requirements
                    {
                        "or": [
                            {"param_compare": ["$JOIN_FEED", "==", False]},
                            {"param_compare": ["$JOIN_FEED_MATCH", "==", "can"]},
                            {"metadata": None, "social_graph": ["$JOIN_FEED_HANDLE", "in", "followers"]}
                        ],
                        "metadata": {}
                    },
                    {
                        "or": [
                            {"param_compare": ["$USE_MEMBER_LISTS", "==", False]},
                            {"param_compare": ["$MEMBER_LISTS_MATCH", "==", "can"]},
                            {"each": ["$MEMBER_LISTS", {"list_member": ["$MEMBER_LISTS_ITEM", "in"]}]},
                            {"each": ["$MEMBER_LISTS", {"starter_pack_member": ["$MEMBER_LISTS_ITEM", "in"]}]}
                        ],
                        "metadata": {}
                    },
                    {
                        "or": [
                            {"param_compare": ["$USE_CURATOR", "==", False]},
                            {"param_compare": ["$CURATOR_MATCH", "==", "can"]},
                            {"metadata": None, "social_graph": ["$CURATOR_HANDLE", "in", "follows"]}
                        ],
                        "metadata": {}
                    },
                    # Membership filters - CAN MATCH requirements (at least one must pass)
                    {
                        "or": [
                            {
                                "and": [
                                    {"param_compare": ["$JOIN_FEED", "==", False]},
                                    {"param_compare": ["$USE_MEMBER_LISTS", "==", False]},
                                    {"param_compare": ["$USE_CURATOR", "==", False]}
                                ],
                                "metadata": {}
                            },
                            {
                                "and": [
                                    {"param_compare": ["$JOIN_FEED", "==", True]},
                                    {"param_compare": ["$JOIN_FEED_MATCH", "==", "must"]}
                                ],
                                "metadata": {}
                            },
                            {
                                "and": [
                                    {"param_compare": ["$USE_MEMBER_LISTS", "==", True]},
                                    {"param_compare": ["$MEMBER_LISTS_MATCH", "==", "must"]}
                                ],
                                "metadata": {}
                            },
                            {
                                "and": [
                                    {"param_compare": ["$USE_CURATOR", "==", True]},
                                    {"param_compare": ["$CURATOR_MATCH", "==", "must"]}
                                ],
                                "metadata": {}
                            },
                            {
                                "and": [
                                    {"param_compare": ["$JOIN_FEED", "==", True]},
                                    {"param_compare": ["$JOIN_FEED_MATCH", "==", "can"]},
                                    {"metadata": None, "social_graph": ["$JOIN_FEED_HANDLE", "in", "followers"]}
                                ],
                                "metadata": {}
                            },
                            {
                                "and": [
                                    {"param_compare": ["$USE_MEMBER_LISTS", "==", True]},
                                    {"param_compare": ["$MEMBER_LISTS_MATCH", "==", "can"]},
                                    {
                                        "or": [
                                            {"each": ["$MEMBER_LISTS", {"list_member": ["$MEMBER_LISTS_ITEM", "in"]}]},
                                            {"each": ["$MEMBER_LISTS", {"starter_pack_member": ["$MEMBER_LISTS_ITEM", "in"]}]}
                                        ],
                                        "metadata": {}
                                    }
                                ],
                                "metadata": {}
                            },
                            {
                                "and": [
                                    {"param_compare": ["$USE_CURATOR", "==", True]},
                                    {"param_compare": ["$CURATOR_MATCH", "==", "can"]},
                                    {"metadata": None, "social_graph": ["$CURATOR_HANDLE", "in", "follows"]}
                                ],
                                "metadata": {}
                            }
                        ],
                        "metadata": {"color": "yellow", "pattern": "dots"}
                    },
                    # Content type filters
                    {
                        "or": [
                            {"param_compare": ["$REPLIES_REMOVE", "==", False]},
                            {"post_type": ["not_in", ["reply"]]}
                        ],
                        "metadata": {"title": "REPLIES", "pattern": "cow"}
                    },
                    {
                        "or": [
                            {"param_compare": ["$QUOTES_REMOVE", "==", False]},
                            {"post_type": ["not_in", ["quote"]]}
                        ],
                        "metadata": {}
                    },
                    {
                        "or": [
                            {"param_compare": ["$IMAGE_ONLY", "==", False]},
                            {"embed_type": ["==", "image"]},
                            {"embed_type": ["==", "image_group"]}
                        ],
                        "metadata": {"color": "indigo", "pattern": "checkerboard"}
                    },
                    {
                        "or": [
                            {"param_compare": ["$LINK_ONLY", "==", False]},
                            {"embed_type": ["==", "link"]}
                        ],
                        "metadata": {}
                    },
                    {
                        "or": [
                            {"param_compare": ["$GIF_ONLY", "==", False]},
                            {"attribute_compare": ["embed.presentation", "==", "gif"]}
                        ],
                        "metadata": {}
                    },
                    {
                        "or": [
                            {"param_compare": ["$TEXT_ONLY", "==", False]},
                            {"attribute_compare": ["embed", "==", None]}
                        ],
                        "metadata": {}
                    },
                    # Alt text requirement
                    {
                        "or": [
                            {
                                "and": [
                                    {"embed_type": ["!=", "image"]},
                                    {"embed_type": ["!=", "image_group"]}
                                ],
                                "metadata": {}
                            },
                            {
                                "or": [
                                    {"param_compare": ["$REQUIRE_ALT_TEXT", "==", False]},
                                    {
                                        "and": [
                                            {
                                                "or": [
                                                    {"embed_type": ["==", "image_group"]},
                                                    {"embed_type": ["==", "image"]}
                                                ],
                                                "metadata": {}
                                            },
                                            {
                                                "or": [
                                                    {
                                                        "and": [
                                                            {"param_compare": ["$ALT_TEXT_MODE", "==", "either"]},
                                                            {
                                                                "or": [
                                                                    {"regex_any": ["embed.images[*].alt", ["[\\w\\s]{$ALT_TEXT_CHARS,}"], True, True]},
                                                                    {"regex_any": ["embed.images[*].alt", ["(?:\\w+(?:[\'\u2019\-]\\w+)?(?:\\s+|[.,;:!?\"\u201c\u201d]+)){$ALT_TEXT_WORDS,}"], True, True]}
                                                                ],
                                                                "metadata": {}
                                                            }
                                                        ],
                                                        "metadata": {}
                                                    },
                                                    {
                                                        "and": [
                                                            {"param_compare": ["$ALT_TEXT_MODE", "==", "both"]},
                                                            {"regex_any": ["embed.images[*].alt", ["[\\w\\s]{$ALT_TEXT_CHARS,}"], True, True]},
                                                            {"regex_any": ["embed.images[*].alt", ["(?:\\w+(?:[\'\u2019\-]\\w+)?(?:\\s+|[.,;:!?\"\u201c\u201d]+)){$ALT_TEXT_WORDS,}"], True, True]}
                                                        ],
                                                        "metadata": {}
                                                    }
                                                ],
                                                "metadata": {}
                                            }
                                        ],
                                        "metadata": {}
                                    },
                                    {
                                        "and": [
                                            {
                                                "or": [
                                                    {"embed_type": ["==", "image_group"]},
                                                    {"embed_type": ["==", "image"]}
                                                ],
                                                "metadata": {}
                                            },
                                            {
                                                "or": [
                                                    {
                                                        "and": [
                                                            {"param_compare": ["$ALT_TEXT_MODE", "==", "either"]},
                                                            {
                                                                "or": [
                                                                    {"regex_any": ["embed.media.images[*].alt", ["[\\w\\s]{$ALT_TEXT_CHARS,}"], True, False]},
                                                                    {"regex_any": ["embed.media.images[*].alt", ["(?:\\w+(?:[\'\u2019\-]\\w+)?(?:\\s+|[.,;:!?\"\u201c\u201d]+)){$ALT_TEXT_WORDS,}"], True, False]}
                                                                ],
                                                                "metadata": {}
                                                            }
                                                        ],
                                                        "metadata": {}
                                                    },
                                                    {
                                                        "and": [
                                                            {"param_compare": ["$ALT_TEXT_MODE", "==", "both"]},
                                                            {"regex_any": ["embed.media.images[*].alt", ["[\\w\\s]{$ALT_TEXT_CHARS,}"], True, False]},
                                                            {"regex_any": ["embed.media.images[*].alt", ["(?:\\w+(?:[\'\u2019\-]\\w+)?(?:\\s+|[.,;:!?\"\u201c\u201d]+)){$ALT_TEXT_WORDS,}"], True, False]}
                                                        ],
                                                        "metadata": {}
                                                    }
                                                ],
                                                "metadata": {}
                                            }
                                        ],
                                        "metadata": {}
                                    }
                                ],
                                "metadata": {}
                            }
                        ],
                        "metadata": {"color": "green", "pattern": "cow"}
                    },
                    # Language filter
                    {
                        "or": [
                            {"param_compare": ["$ENABLE_LANGUAGE_1", "==", False]},
                            {"attribute_compare": ["langs[*]", "==", "$LANGUAGE_1"]}
                        ],
                        "metadata": {}
                    },
                    {
                        "or": [
                            {"param_compare": ["$ENABLE_LANGUAGE_2", "==", False]},
                            {"attribute_compare": ["langs[*]", "==", "$LANGUAGE_2"]}
                        ],
                        "metadata": {}
                    },
                    {
                        "or": [
                            {"param_compare": ["$ENABLE_LANGUAGE_3", "==", False]},
                            {"attribute_compare": ["langs[*]", "==", "$LANGUAGE_3"]}
                        ],
                        "metadata": {"color": "blue", "pattern": "lines"}
                    },
                    # Social graph filters
                    {
                        "and": [
                            {
                                "or": [
                                    {"param_compare": ["$FOLLOWERS", "==", False]},
                                    {"metadata": None, "social_graph": ["$HANDLE", "in", "followers"]}
                                ],
                                "metadata": {"color": "purple", "title": "FOLLOWERS", "pattern": "lines"}
                            },
                            {
                                "or": [
                                    {"param_compare": ["$FOLLOWING", "==", False]},
                                    {"metadata": None, "social_graph": ["$HANDLE", "in", "follows"]}
                                ],
                                "metadata": {"title": "FOLLOWING", "pattern": "lines"}
                            },
                            {
                                "or": [
                                    {"param_compare": ["$MUTUALS", "==", False]},
                                    {
                                        "and": [
                                            {"metadata": None, "social_graph": ["$HANDLE", "in", "follows"]},
                                            {"metadata": None, "social_graph": ["$HANDLE", "in", "followers"]}
                                        ],
                                        "metadata": {}
                                    }
                                ],
                                "metadata": {"title": "MUTUALS", "pattern": "lines"}
                            }
                        ],
                        "metadata": {"color": "purple", "title": "SOCIAL GRAPH", "pattern": "dots"}
                    }
                ],
                "metadata": {
                    "color": "green",
                    "customNodeParameters": [
                        {
                            "name": "HANDLE",
                            "displayName": "Your Handle",
                            "description": "Your Bluesky handle (without @). Used for social graph filters.",
                            "exampleValue": "your_handle.bsky.social",
                            "group": "social_graph"
                        },
                        {
                            "name": "JOIN_FEED",
                            "displayName": "Enable Join Feed",
                            "type": "toggle",
                            "description": "Require users to follow a specific account.",
                            "exampleValue": False,
                            "group": "membership"
                        },
                        {
                            "name": "JOIN_FEED_MATCH",
                            "displayName": "Join Feed Match Mode",
                            "type": "select",
                            "labels": ["Can Match (OR)", "Must Match (AND)"],
                            "options": ["can", "must"],
                            "description": "Can Match: This OR another requirement. Must Match: This requirement is always required.",
                            "exampleValue": "can",
                            "group": "membership"
                        },
                        {
                            "name": "JOIN_FEED_HANDLE",
                            "displayName": "Join Feed Handle",
                            "description": "Handle users must follow (without @).",
                            "exampleValue": "membership.bsky.social",
                            "group": "membership"
                        },
                        {
                            "name": "USE_MEMBER_LISTS",
                            "displayName": "Enable Member Lists",
                            "type": "toggle",
                            "description": "Require users to be on a list or starter pack.",
                            "exampleValue": False,
                            "group": "membership"
                        },
                        {
                            "name": "MEMBER_LISTS_MATCH",
                            "displayName": "Member Lists Match Mode",
                            "type": "select",
                            "labels": ["Can Match (OR)", "Must Match (AND)"],
                            "options": ["can", "must"],
                            "description": "Can Match: This OR another requirement. Must Match: This requirement is always required.",
                            "exampleValue": "can",
                            "group": "membership"
                        },
                        {
                            "name": "MEMBER_LISTS",
                            "displayName": "Member Lists/Starter Packs",
                            "type": "list",
                            "description": "Add list or starter pack URLs. Users on ANY of these will be included.",
                            "exampleValue": ["https://bsky.app/profile/did:plc:example/lists/example"],
                            "group": "membership"
                        },
                        {
                            "name": "USE_CURATOR",
                            "displayName": "Enable Curator Follows",
                            "type": "toggle",
                            "description": "Allow posts from users followed by a curator account.",
                            "exampleValue": False,
                            "group": "membership"
                        },
                        {
                            "name": "CURATOR_MATCH",
                            "displayName": "Curator Match Mode",
                            "type": "select",
                            "labels": ["Can Match (OR)", "Must Match (AND)"],
                            "options": ["can", "must"],
                            "description": "Can Match: This OR another requirement. Must Match: This requirement is always required.",
                            "exampleValue": "can",
                            "group": "membership"
                        },
                        {
                            "name": "CURATOR_HANDLE",
                            "displayName": "Curator Handle",
                            "description": "Curator account handle (without @). Users followed by this account are allowed.",
                            "exampleValue": "curator.bsky.social",
                            "group": "membership"
                        },
                        {
                            "name": "REPLIES_REMOVE",
                            "displayName": "Remove Replies",
                            "type": "toggle",
                            "description": "Remove reply posts from feed (only show parent posts).",
                            "exampleValue": False,
                            "group": "content_types"
                        },
                        {
                            "name": "QUOTES_REMOVE",
                            "displayName": "Remove Quote Posts",
                            "type": "toggle",
                            "description": "Remove quote posts from feed.",
                            "exampleValue": False,
                            "group": "content_types"
                        },
                        {
                            "name": "IMAGE_ONLY",
                            "displayName": "Images Only",
                            "type": "toggle",
                            "description": "Only show posts with images.",
                            "exampleValue": False,
                            "group": "content_types"
                        },
                        {
                            "name": "LINK_ONLY",
                            "displayName": "Links Only",
                            "type": "toggle",
                            "description": "Only show posts with link cards (great for news feeds).",
                            "exampleValue": False,
                            "group": "content_types"
                        },
                        {
                            "name": "GIF_ONLY",
                            "displayName": "GIFs Only",
                            "type": "toggle",
                            "description": "Only show posts with GIFs.",
                            "exampleValue": False,
                            "group": "content_types"
                        },
                        {
                            "name": "VIDEO_NOT_SUPPORTED",
                            "displayName": "[Videos Only - Not Supported]",
                            "description": "Video filtering is not supported in custom nodes. The video embed type enables video feed UI mode which cannot be toggled conditionally. Create a dedicated video feed with an embed = video node to get true video feed support.",
                            "exampleValue": "Not Available -- See ℹ️ for more information",
                            "group": "content_types"
                        },
                        {
                            "name": "TEXT_ONLY",
                            "displayName": "Text Only",
                            "type": "toggle",
                            "description": "Only show text posts without any embeds (no images, videos, links, etc).",
                            "exampleValue": False,
                            "group": "content_types"
                        },
                        {
                            "name": "REQUIRE_ALT_TEXT",
                            "displayName": "Require Alt Text",
                            "type": "toggle",
                            "description": "Only show images with alt text descriptions.",
                            "exampleValue": False,
                            "group": "accessibility"
                        },
                        {
                            "name": "ALT_TEXT_MODE",
                            "displayName": "Alt Text Requirement Mode",
                            "type": "select",
                            "labels": ["Either requirement met", "Both requirements met"],
                            "options": ["either", "both"],
                            "description": "Choose whether alt text must meet character OR word minimum (either), or BOTH minimums.",
                            "exampleValue": "either",
                            "group": "accessibility"
                        },
                        {
                            "name": "ALT_TEXT_CHARS",
                            "displayName": "Minimum Characters",
                            "type": "number",
                            "description": "Minimum characters required in alt text.",
                            "exampleValue": 10,
                            "isPercentage": False,
                            "group": "accessibility"
                        },
                        {
                            "name": "ALT_TEXT_WORDS",
                            "displayName": "Minimum Words",
                            "type": "number",
                            "description": "Minimum words required in alt text. Handles contractions, hyphens, and punctuation correctly.",
                            "exampleValue": 3,
                            "isPercentage": False,
                            "group": "accessibility"
                        },
                        {
                            "name": "ENABLE_LANGUAGE_1",
                            "displayName": "Enable Language 1",
                            "type": "toggle",
                            "description": "Toggle to filter by first language.",
                            "exampleValue": False,
                            "group": "language"
                        },
                        {
                            "name": "LANGUAGE_1",
                            "displayName": "Language 1",
                            "type": "select",
                            "labels": ["English", "Spanish", "French", "German", "Portuguese", "Italian", "Dutch", "Polish", "Japanese", "Chinese", "Korean", "Arabic", "Russian", "Turkish", "Hindi", "Indonesian", "Thai", "Vietnamese", "Swedish", "Danish", "Norwegian", "Finnish", "Czech", "Hungarian", "Romanian", "Ukrainian", "Greek", "Hebrew", "Persian", "Urdu", "Bengali", "Tamil", "Telugu", "Marathi", "Gujarati", "Kannada", "Malayalam", "Punjabi", "Swahili", "Tagalog", "Malay", "Catalan", "Slovak", "Bulgarian", "Croatian", "Serbian", "Lithuanian", "Latvian", "Estonian", "Slovenian", "Icelandic"],
                            "options": ["en", "es", "fr", "de", "pt", "it", "nl", "pl", "ja", "zh", "ko", "ar", "ru", "tr", "hi", "id", "th", "vi", "sv", "da", "no", "fi", "cs", "hu", "ro", "uk", "el", "he", "fa", "ur", "bn", "ta", "te", "mr", "gu", "kn", "ml", "pa", "sw", "tl", "ms", "ca", "sk", "bg", "hr", "sr", "lt", "lv", "et", "sl", "is"],
                            "description": "Select language.",
                            "exampleValue": "en",
                            "group": "language"
                        },
                        {
                            "name": "ENABLE_LANGUAGE_2",
                            "displayName": "Enable Language 2",
                            "type": "toggle",
                            "description": "Toggle to filter by second language.",
                            "exampleValue": False,
                            "group": "language"
                        },
                        {
                            "name": "LANGUAGE_2",
                            "displayName": "Language 2",
                            "type": "select",
                            "labels": ["English", "Spanish", "French", "German", "Portuguese", "Italian", "Dutch", "Polish", "Japanese", "Chinese", "Korean", "Arabic", "Russian", "Turkish", "Hindi", "Indonesian", "Thai", "Vietnamese", "Swedish", "Danish", "Norwegian", "Finnish", "Czech", "Hungarian", "Romanian", "Ukrainian", "Greek", "Hebrew", "Persian", "Urdu", "Bengali", "Tamil", "Telugu", "Marathi", "Gujarati", "Kannada", "Malayalam", "Punjabi", "Swahili", "Tagalog", "Malay", "Catalan", "Slovak", "Bulgarian", "Croatian", "Serbian", "Lithuanian", "Latvian", "Estonian", "Slovenian", "Icelandic"],
                            "options": ["en", "es", "fr", "de", "pt", "it", "nl", "pl", "ja", "zh", "ko", "ar", "ru", "tr", "hi", "id", "th", "vi", "sv", "da", "no", "fi", "cs", "hu", "ro", "uk", "el", "he", "fa", "ur", "bn", "ta", "te", "mr", "gu", "kn", "ml", "pa", "sw", "tl", "ms", "ca", "sk", "bg", "hr", "sr", "lt", "lv", "et", "sl", "is"],
                            "description": "Select language.",
                            "exampleValue": "es",
                            "group": "language"
                        },
                        {
                            "name": "ENABLE_LANGUAGE_3",
                            "displayName": "Enable Language 3",
                            "type": "toggle",
                            "description": "Toggle to filter by third language.",
                            "exampleValue": False,
                            "group": "language"
                        },
                        {
                            "name": "LANGUAGE_3",
                            "displayName": "Language 3",
                            "type": "select",
                            "labels": ["English", "Spanish", "French", "German", "Portuguese", "Italian", "Dutch", "Polish", "Japanese", "Chinese", "Korean", "Arabic", "Russian", "Turkish", "Hindi", "Indonesian", "Thai", "Vietnamese", "Swedish", "Danish", "Norwegian", "Finnish", "Czech", "Hungarian", "Romanian", "Ukrainian", "Greek", "Hebrew", "Persian", "Urdu", "Bengali", "Tamil", "Telugu", "Marathi", "Gujarati", "Kannada", "Malayalam", "Punjabi", "Swahili", "Tagalog", "Malay", "Catalan", "Slovak", "Bulgarian", "Croatian", "Serbian", "Lithuanian", "Latvian", "Estonian", "Slovenian", "Icelandic"],
                            "options": ["en", "es", "fr", "de", "pt", "it", "nl", "pl", "ja", "zh", "ko", "ar", "ru", "tr", "hi", "id", "th", "vi", "sv", "da", "no", "fi", "cs", "hu", "ro", "uk", "el", "he", "fa", "ur", "bn", "ta", "te", "mr", "gu", "kn", "ml", "pa", "sw", "tl", "ms", "ca", "sk", "bg", "hr", "sr", "lt", "lv", "et", "sl", "is"],
                            "description": "Select language.",
                            "exampleValue": "fr",
                            "group": "language"
                        },
                        {
                            "name": "MUTUALS",
                            "displayName": "Mutuals Only",
                            "type": "toggle",
                            "description": "Only show posts from mutual follows. Recommended for personal feeds.",
                            "exampleValue": False,
                            "group": "social_graph"
                        },
                        {
                            "name": "FOLLOWERS",
                            "displayName": "Followers Only",
                            "type": "toggle",
                            "description": "Only show posts from your followers. Redundant if Mutuals is enabled.",
                            "exampleValue": False,
                            "group": "social_graph"
                        },
                        {
                            "name": "FOLLOWING",
                            "displayName": "Following Only",
                            "type": "toggle",
                            "description": "Only show posts from accounts you follow. Redundant if Mutuals is enabled.",
                            "exampleValue": True,
                            "group": "social_graph"
                        }
                    ],
                    "customNodeParameterGroups": [
                        {
                            "id": "membership",
                            "name": "Membership",
                            "description": "Control who can post to your feed. Each requirement has a Match Mode: 'Can Match' means at least one Can Match requirement must be met (OR logic). 'Must Match' means that specific requirement is always required (AND logic). Examples: All set to Can Match = any one requirement. One Must Match + two Can Match = the Must Match requirement AND at least one Can Match. Two Must Match = effectively all three requirements must be met."
                        },
                        {
                            "id": "content_types",
                            "name": "Content Types",
                            "description": "Filter by post types and embedded content"
                        },
                        {
                            "id": "accessibility",
                            "name": "Accessibility",
                            "description": "Require alt text descriptions for images"
                        },
                        {
                            "id": "language",
                            "name": "Language",
                            "description": "Filter posts by language"
                        },
                        {
                            "id": "social_graph",
                            "name": "Social Graph",
                            "description": "Filter by your social connections (followers, following, mutuals)"
                        }
                    ]
                }
            }
    }
