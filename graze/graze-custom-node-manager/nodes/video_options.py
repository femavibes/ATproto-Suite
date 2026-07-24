"""
Video Options - Comprehensive video filtering with orientation, size, resolution, and dimension controls
"""

metadata = {
    "id": "video_options",
    "name": "Video Options - Vertical Video & Resolution",
    "description": "Did you make a fancy new video feed? Neat! But is it pulling in some nasty horizontal video? Use this to filter them out for majestic 9:16 goodness. You can also remove SD, HD, or UHD resolutions, allowing you to create a lo-fi video feed or a high-quality only feed. Filter by file size to target longer videos, set custom dimension limits for precise control, or exclude GIFs entirely.",
    "color": "purple",
    "version": "2.0.0",
    "author": "Custom Nodes System",
    "tags": ["video", "vertical", "resolution", "orientation"],
    "configurable": {}
}

def get_manifest(options=None):
    """Generate the filter manifest"""
    
    # Vertical resolutions (~9:16)
    vertical_resolutions = [
        "720 1280", "1080 1920", "1440 2560",  # Common vertical
        "480 854", "540 960", "768 1366", "900 1600"  # Additional vertical
    ]
    
    # Horizontal resolutions (~16:9)
    horizontal_resolutions = [
        "1280 720", "1920 1080", "2560 1440", "3840 2160",  # Common horizontal
        "854 480", "960 540", "1366 768", "1600 900"  # Additional horizontal
    ]
    
    # Square resolutions (~1:1)
    square_resolutions = [
        "720 720", "1080 1080", "1440 1440", "2160 2160",  # Perfect squares
        "480 480", "640 640", "800 800", "960 960"  # Additional squares
    ]
    
    # SD resolutions (width or height between 256-854)
    sd_resolutions = [
        "256 144", "320 180", "640 360", "720 405", "800 450", "854 480",
        "144 256", "180 320", "360 640", "405 720", "450 800", "480 854"
    ]
    
    # HD resolutions (width or height between 960-1920)
    hd_resolutions = [
        "960 540", "1024 576", "1280 720", "1366 768", "1600 900", "1920 1080",
        "540 960", "576 1024", "720 1280", "768 1366", "900 1600", "1080 1920"
    ]
    
    # UHD resolutions (width or height 2048+)
    uhd_resolutions = [
        "2048 1152", "2560 1440", "3200 1800", "3440 1935", "3840 2160", "4096 2304", "5120 2880", "7680 4320",
        "1152 2048", "1440 2560", "1800 3200", "1935 3440", "2160 3840", "2304 4096", "2880 5120", "4320 7680"
    ]
    
    return {
        "filter": {
            "and": [
                # ORIENTATION (OR logic)
                {
                    "or": [
                        {"param_compare": ["$REQUIRE_VERTICAL", "==", False]},
                        {"regex_any": ["embed.aspectRatio[*]", vertical_resolutions, True, False]}
                    ],
                    "metadata": {}
                },
                {
                    "or": [
                        {"param_compare": ["$REQUIRE_HORIZONTAL", "==", False]},
                        {"regex_any": ["embed.aspectRatio[*]", horizontal_resolutions, True, False]}
                    ],
                    "metadata": {}
                },
                {
                    "or": [
                        {"param_compare": ["$REQUIRE_SQUARE", "==", False]},
                        {"regex_any": ["embed.aspectRatio[*]", square_resolutions, True, False]}
                    ],
                    "metadata": {}
                },
                
                # FILE SIZE (AND logic)
                {
                    "or": [
                        {"param_compare": ["$REQUIRE_VERTICAL", "==", False]},
                        {"param_compare": ["$REQUIRE_HORIZONTAL", "==", False]},
                        {"param_compare": ["$REQUIRE_SQUARE", "==", False]},
                        {"attribute_compare": ["embed.video.size", ">=", "$SIZE_MINIMUM"]}
                    ],
                    "metadata": {}
                },
                {
                    "or": [
                        {"param_compare": ["$REQUIRE_VERTICAL", "==", False]},
                        {"param_compare": ["$REQUIRE_HORIZONTAL", "==", False]},
                        {"param_compare": ["$REQUIRE_SQUARE", "==", False]},
                        {"attribute_compare": ["embed.video.size", "<=", "$SIZE_MAXIMUM"]}
                    ],
                    "metadata": {}
                },
                
                # RESOLUTION QUALITY (AND logic)
                {
                    "or": [
                        {"param_compare": ["$REMOVE_SD", "==", False]},
                        {"regex_none": ["embed.aspectRatio[*]", sd_resolutions, True, False]}
                    ],
                    "metadata": {}
                },
                {
                    "or": [
                        {"param_compare": ["$REMOVE_HD", "==", False]},
                        {"regex_none": ["embed.aspectRatio[*]", hd_resolutions, True, False]}
                    ],
                    "metadata": {}
                },
                {
                    "or": [
                        {"param_compare": ["$REMOVE_UHD", "==", False]},
                        {"regex_none": ["embed.aspectRatio[*]", uhd_resolutions, True, False]}
                    ],
                    "metadata": {}
                },
                
                # CUSTOM DIMENSIONS (AND logic)
                {
                    "or": [
                        {"param_compare": ["$MIN_WIDTH", "==", 0]},
                        {"attribute_compare": ["embed.aspectRatio.width", ">=", "$MIN_WIDTH"]}
                    ],
                    "metadata": {}
                },
                {
                    "or": [
                        {"param_compare": ["$MAX_WIDTH", "==", 999999]},
                        {"attribute_compare": ["embed.aspectRatio.width", "<=", "$MAX_WIDTH"]}
                    ],
                    "metadata": {}
                },
                {
                    "or": [
                        {"param_compare": ["$MIN_HEIGHT", "==", 0]},
                        {"attribute_compare": ["embed.aspectRatio.height", ">=", "$MIN_HEIGHT"]}
                    ],
                    "metadata": {}
                },
                {
                    "or": [
                        {"param_compare": ["$MAX_HEIGHT", "==", 999999]},
                        {"attribute_compare": ["embed.aspectRatio.height", "<=", "$MAX_HEIGHT"]}
                    ],
                    "metadata": {}
                },
                
                # CONTENT TYPE
                {
                    "or": [
                        {"param_compare": ["$EXCLUDE_GIFS", "==", False]},
                        {"attribute_compare": ["embed.presentation", "!=", "gif"]}
                    ],
                    "metadata": {}
                }
            ],
            "metadata": {
                "color": "purple",
                "customNodeParameters": [
                    {
                        "name": "REQUIRE_VERTICAL",
                        "type": "toggle",
                        "description": "Only show portrait/vertical videos (~9:16 aspect ratio). Choose one orientation or leave all off for any orientation.",
                        "displayName": "Require Vertical Videos?",
                        "exampleValue": False,
                        "group": "orientation"
                    },
                    {
                        "name": "REQUIRE_HORIZONTAL",
                        "type": "toggle",
                        "description": "Only show landscape/horizontal videos (~16:9 aspect ratio). Choose one orientation or leave all off for any orientation.",
                        "displayName": "Require Horizontal Videos?",
                        "exampleValue": False,
                        "group": "orientation"
                    },
                    {
                        "name": "REQUIRE_SQUARE",
                        "type": "toggle",
                        "description": "Only show square videos (~1:1 aspect ratio). Choose one orientation or leave all off for any orientation.",
                        "displayName": "Require Square Videos?",
                        "exampleValue": False,
                        "group": "orientation"
                    },
                    {
                        "name": "SIZE_MINIMUM",
                        "type": "select",
                        "labels": ["No Minimum", "1MB+", "2MB+", "3MB+", "4MB+", "5MB+", "10MB+", "15MB+", "20MB+", "25MB+", "30MB+", "35MB+", "40MB+", "45MB+"],
                        "options": ["1", "1000000", "2000000", "3000000", "4000000", "5000000", "10000000", "15000000", "20000000", "25000000", "30000000", "35000000", "40000000", "45000000"],
                        "description": "Minimum video file size. Videos must be within this size range (both minimum and maximum apply).",
                        "displayName": "Minimum File Size:",
                        "exampleValue": "1",
                        "group": "file_size"
                    },
                    {
                        "name": "SIZE_MAXIMUM",
                        "type": "select",
                        "labels": ["5MB Limit", "10MB Limit", "15MB Limit", "20MB Limit", "25MB Limit", "30MB Limit", "35MB Limit", "40MB Limit", "45MB Limit", "No Limit"],
                        "options": ["5000000", "10000000", "15000000", "20000000", "25000000", "30000000", "35000000", "40000000", "45000000", "999999999999999999999"],
                        "description": "Maximum video file size. Videos must be within this size range (both minimum and maximum apply).",
                        "displayName": "Maximum File Size:",
                        "exampleValue": "999999999999999999999",
                        "group": "file_size"
                    },
                    {
                        "name": "REMOVE_SD",
                        "type": "toggle",
                        "description": "Exclude Standard Definition videos (256x144 through 854x480). All enabled quality filters apply together.",
                        "displayName": "Remove SD Quality?",
                        "exampleValue": False,
                        "group": "resolution_quality"
                    },
                    {
                        "name": "REMOVE_HD",
                        "type": "toggle",
                        "description": "Exclude High Definition videos (960x540 through 1920x1080). All enabled quality filters apply together.",
                        "displayName": "Remove HD Quality?",
                        "exampleValue": False,
                        "group": "resolution_quality"
                    },
                    {
                        "name": "REMOVE_UHD",
                        "type": "toggle",
                        "description": "Exclude Ultra High Definition videos (2048x1152 and above). All enabled quality filters apply together.",
                        "displayName": "Remove UHD Quality?",
                        "exampleValue": False,
                        "group": "resolution_quality"
                    },
                    {
                        "name": "MIN_WIDTH",
                        "type": "number",
                        "description": "Advanced: Minimum video width in pixels. Set to 0 to disable. All custom dimension values apply together with other filters.",
                        "displayName": "Minimum Width (pixels):",
                        "exampleValue": 0,
                        "group": "custom_dimensions"
                    },
                    {
                        "name": "MAX_WIDTH",
                        "type": "number",
                        "description": "Advanced: Maximum video width in pixels. Set to 999999 to disable. All custom dimension values apply together with other filters.",
                        "displayName": "Maximum Width (pixels):",
                        "exampleValue": 999999,
                        "group": "custom_dimensions"
                    },
                    {
                        "name": "MIN_HEIGHT",
                        "type": "number",
                        "description": "Advanced: Minimum video height in pixels. Set to 0 to disable. All custom dimension values apply together with other filters.",
                        "displayName": "Minimum Height (pixels):",
                        "exampleValue": 0,
                        "group": "custom_dimensions"
                    },
                    {
                        "name": "MAX_HEIGHT",
                        "type": "number",
                        "description": "Advanced: Maximum video height in pixels. Set to 999999 to disable. All custom dimension values apply together with other filters.",
                        "displayName": "Maximum Height (pixels):",
                        "exampleValue": 999999,
                        "group": "custom_dimensions"
                    },
                    {
                        "name": "EXCLUDE_GIFS",
                        "type": "toggle",
                        "description": "Exclude animated GIFs from results.",
                        "displayName": "Exclude GIFs?",
                        "exampleValue": True,
                        "group": "content_type"
                    }
                ],
                "customNodeParameterGroups": [
                    {
                        "id": "orientation",
                        "name": "Orientation",
                        "description": "Choose one orientation or leave all off for any orientation"
                    },
                    {
                        "id": "file_size",
                        "name": "File Size",
                        "description": "Videos must be within this size range"
                    },
                    {
                        "id": "resolution_quality",
                        "name": "Resolution Quality",
                        "description": "Remove videos in these quality ranges. Works with or without orientation filters to further refine results. All enabled filters apply."
                    },
                    {
                        "id": "custom_dimensions",
                        "name": "Custom Dimensions (Advanced)",
                        "description": "Set custom dimension limits for precise control. Works with or without orientation filters to further refine results. All values apply together with other filters."
                    },
                    {
                        "id": "content_type",
                        "name": "Content Type",
                        "description": "Filter out specific content types"
                    }
                ]
            }
        }
    }
