"""
Master Term Search - Comprehensive term searching across all post text fields
"""

metadata = {
    "id": "master_term_search",
    "name": "Master Term Search",
    "description": "Search for terms across post text, embeds, alt-text, quotes, bios, and video transcriptions with case sensitivity and regex options.",
    "color": "green",
    "version": "2.0.0",
    "author": "Custom Nodes System",
    "tags": ["search", "text", "comprehensive"],
    "configurable": {}
}

def get_manifest(options=None):
    """Generate the filter manifest"""
    
    # Helper to generate 4-way conditional for a field
    def four_way(field, words_param="$WORDS"):
        return {
            "or": [
                {"and": [{"param_compare": ["$ENABLE_REGEX", "==", False]}, {"param_compare": ["$ENABLE_CASE_SENSITIVITY", "==", False]}, {"regex_any": [field, [words_param], True, False]}], "metadata": {}},
                {"and": [{"param_compare": ["$ENABLE_REGEX", "==", True]}, {"param_compare": ["$ENABLE_CASE_SENSITIVITY", "==", False]}, {"regex_any": [field, [words_param], True, True]}], "metadata": {}},
                {"and": [{"param_compare": ["$ENABLE_REGEX", "==", False]}, {"param_compare": ["$ENABLE_CASE_SENSITIVITY", "==", True]}, {"regex_any": [field, [words_param], False, False]}], "metadata": {}},
                {"and": [{"param_compare": ["$ENABLE_REGEX", "==", True]}, {"param_compare": ["$ENABLE_CASE_SENSITIVITY", "==", True]}, {"regex_any": [field, [words_param], False, True]}], "metadata": {}}
            ],
            "metadata": {}
        }
    
    return {
        "filter": {
            "or": [
                # TEXT
                {"and": [{"param_compare": ["$SEARCH_TEXT", "==", True]}, four_way("text")], "metadata": {}},
                
                # EMBED URLS
                {"and": [{"param_compare": ["$SEARCH_EMBED_URLS", "==", True]}, {"or": [four_way("embed.external.uri"), four_way("embed.media.external.uri")], "metadata": {}}], "metadata": {}},
                
                # EMBED TITLES
                {"and": [{"param_compare": ["$SEARCH_EMBED_TITLES", "==", True]}, {"or": [four_way("embed.external.title"), four_way("embed.media.external.title")], "metadata": {}}], "metadata": {}},
                
                # EMBED DESCRIPTIONS
                {"and": [{"param_compare": ["$SEARCH_EMBED_DESCRIPTIONS", "==", True]}, {"or": [four_way("embed.external.description"), four_way("embed.media.external.description")], "metadata": {}}], "metadata": {}},
                
                # ALT TEXT (combined image + video)
                {"and": [{"param_compare": ["$SEARCH_ALT_TEXT", "==", True]}, {"or": [four_way("embed.images[*].alt"), four_way("embed.media.images[*].alt"), four_way("embed.alt"), four_way("embed.media[*].alt")], "metadata": {}}], "metadata": {}},
                
                # QUOTES
                {"and": [{"param_compare": ["$SEARCH_QUOTES", "==", True]}, four_way("hydrated_metadata.quote_post.record.text")], "metadata": {}},
                
                # DISPLAY NAME
                {"and": [{"param_compare": ["$SEARCH_DISPLAY_NAME", "==", True]}, four_way("hydrated_metadata.user.display_name")], "metadata": {}},
                
                # BIO
                {"and": [{"param_compare": ["$SEARCH_BIO", "==", True]}, four_way("hydrated_metadata.user.description")], "metadata": {}},
                
                # VIDEO TRANSCRIPTION
                {"and": [{"param_compare": ["$SEARCH_VIDEO_TRANSCRIPTION", "==", True]}, four_way("inferences.video.audio_transcription.text")], "metadata": {}}
            ],
            "metadata": {
                "color": "green",
                "customNodeParameters": [
                    {
                        "name": "NAME",
                        "description": "Optional notes field for organization. This parameter doesn't affect filtering.",
                        "displayName": "Notes:",
                        "exampleValue": "Write whatever you want here"
                    },
                    {
                        "name": "WORDS",
                        "type": "list",
                        "description": "List of words or terms to search for. Matches if ANY term is found in enabled locations.",
                        "displayName": "Search Terms",
                        "exampleValue": ["example", "test"],
                        "group": "search_config"
                    },
                    {
                        "name": "SEARCH_TEXT",
                        "type": "toggle",
                        "description": "Search within post text. Searches: text",
                        "displayName": "Search Post Text?",
                        "exampleValue": True,
                        "group": "search_locations"
                    },
                    {
                        "name": "ENABLE_CASE_SENSITIVITY",
                        "type": "toggle",
                        "description": "When enabled, searches will be case-sensitive (e.g., 'Cat' won't match 'cat').",
                        "displayName": "Enable Case Sensitivity?",
                        "exampleValue": False,
                        "group": "search_config"
                    },
                    {
                        "name": "ENABLE_REGEX",
                        "type": "toggle",
                        "description": "When enabled, search terms will be treated as regex patterns instead of literal words.",
                        "displayName": "Enable Regex?",
                        "exampleValue": False,
                        "group": "search_config"
                    },
                    {
                        "name": "SEARCH_EMBED_URLS",
                        "type": "toggle",
                        "description": "Search within link card URLs. Searches: embed.external.uri, embed.media.external.uri",
                        "displayName": "Search Embed URLs?",
                        "exampleValue": False,
                        "group": "search_locations"
                    },
                    {
                        "name": "SEARCH_EMBED_TITLES",
                        "type": "toggle",
                        "description": "Search within link card titles. Searches: embed.external.title, embed.media.external.title",
                        "displayName": "Search Embed Titles?",
                        "exampleValue": False,
                        "group": "search_locations"
                    },
                    {
                        "name": "SEARCH_EMBED_DESCRIPTIONS",
                        "type": "toggle",
                        "description": "Search within link card descriptions. Searches: embed.external.description, embed.media.external.description",
                        "displayName": "Search Embed Descriptions?",
                        "exampleValue": False,
                        "group": "search_locations"
                    },
                    {
                        "name": "SEARCH_ALT_TEXT",
                        "type": "toggle",
                        "description": "Search within image and video alt-text. Searches: embed.images[*].alt, embed.media.images[*].alt, embed.alt, embed.media[*].alt",
                        "displayName": "Search Alt-Text?",
                        "exampleValue": False,
                        "group": "search_locations"
                    },
                    {
                        "name": "SEARCH_QUOTES",
                        "type": "toggle",
                        "description": "Search within quoted post text. Searches: hydrated_metadata.quote_post.record.text",
                        "displayName": "Search Quoted Posts?",
                        "exampleValue": False,
                        "group": "search_locations"
                    },
                    {
                        "name": "SEARCH_DISPLAY_NAME",
                        "type": "toggle",
                        "description": "Search within post author's display name. Searches: hydrated_metadata.user.display_name",
                        "displayName": "Search Display Names?",
                        "exampleValue": False,
                        "group": "search_locations"
                    },
                    {
                        "name": "SEARCH_BIO",
                        "type": "toggle",
                        "description": "Search within post author's bio. Searches: hydrated_metadata.user.description",
                        "displayName": "Search Bios?",
                        "exampleValue": False,
                        "group": "search_locations"
                    },
                    {
                        "name": "SEARCH_VIDEO_TRANSCRIPTION",
                        "type": "toggle",
                        "description": "Search within video audio transcriptions. Searches: inferences.video.audio_transcription.text",
                        "displayName": "Search Video Transcriptions?",
                        "exampleValue": False,
                        "group": "search_locations"
                    }
                ],
                "customNodeParameterGroups": [
                    {
                        "id": "search_config",
                        "name": "Search Configuration",
                        "description": "Configure how terms are matched"
                    },
                    {
                        "id": "search_locations",
                        "name": "Search Locations",
                        "description": "Choose where to search for terms"
                    }
                ]
            }
        }
    }
