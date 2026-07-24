"""
Spam Blocker - Block spam accounts and content based on bio patterns and post content
"""
import json
import os

metadata = {
    "id": "spam_blocker",
    "name": "Spam Blocker",
    "description": "Block spam accounts by scanning user bios and post content. Targets cryptobros, engagement farmers, adult content promoters, MLM schemes, and grifters.",
    "color": "yellow",
    "version": "1.0.0",
    "author": "Custom Nodes System",
    "tags": ["spam", "moderation", "bio", "scam"],
    "configurable": {},
    "manageable": True
}

def load_category(category):
    """Load spam category data"""
    data_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "spam_blocker", f"{category}.json")
    try:
        with open(data_path, "r") as f:
            return json.load(f)
    except:
        return {}

def build_bio_filter(terms, exceptions=None):
    """Build filter for bio scanning with exception support"""
    if not terms:
        return None
    
    if exceptions:
        # Allow if bio has exception terms, otherwise block if has spam terms
        return {
            "or": [
                {"regex_any": ["hydrated_metadata.user.description", exceptions, True, False]},  # has exceptions = allow
                {"regex_none": ["hydrated_metadata.user.description", terms, True, False]}  # no spam terms = allow
            ]
        }
    
    return {"regex_none": ["hydrated_metadata.user.description", terms, True, False]}

def build_post_filter(terms):
    """Build filter for post content"""
    if not terms:
        return None
    fields = ["text", "embed.external.title", "embed.external.description", "embed.alt", "embed.images[*].alt"]
    return {"or": [{"regex_none": [field, terms, True, False]} for field in fields]}

def build_hashtag_filter(hashtags):
    """Build filter for hashtags"""
    if not hashtags:
        return None
    formatted = [f"#{tag}" for tag in hashtags]
    return {"or": [
        {"regex_none": ["text", formatted, True, False]}
    ]}

def build_category_filter(category_name, category_data, toggle_prefix):
    """Build complete filter for a spam category with separate toggles"""
    checks = []
    
    bio_terms = category_data.get("bio_terms", [])
    bio_exceptions = category_data.get("bio_exceptions", [])
    post_terms = category_data.get("post_terms", [])
    hashtags = category_data.get("hashtags", [])
    
    if bio_terms:
        bio_filter = build_bio_filter(bio_terms, bio_exceptions if bio_exceptions else None)
        if bio_filter:
            checks.append({
                "or": [
                    {"param_compare": [f"${toggle_prefix}_BIO", "==", False]},
                    bio_filter
                ]
            })
    
    if post_terms:
        post_filter = build_post_filter(post_terms)
        if post_filter:
            checks.append({
                "or": [
                    {"param_compare": [f"${toggle_prefix}_POSTS", "==", False]},
                    post_filter
                ]
            })
    
    if hashtags:
        hashtag_filter = build_hashtag_filter(hashtags)
        if hashtag_filter:
            checks.append({
                "or": [
                    {"param_compare": [f"${toggle_prefix}_HASHTAGS", "==", False]},
                    hashtag_filter
                ]
            })
    
    if not checks:
        return None
    
    return {"and": checks}

def get_manifest(options=None):
    """Generate the filter manifest"""
    
    categories = {
        "BLOCK_CRYPTOBROS": ("cryptobros", "Cryptobros", "Crypto scammers and trading signal spammers"),
        "BLOCK_ENGAGEMENT_FARMERS": ("engagement_farmers", "Engagement Farmers", "Follow-for-follow and engagement bait accounts"),
        # "BLOCK_THIRST_TRAPS": ("thirst_traps", "Thirst Traps", "Adult content promoters and OnlyFans spam"),  # DISABLED
        "BLOCK_HUNS": ("huns", "MLM Huns", "MLM/pyramid scheme promoters and boss babes"),
        "BLOCK_MANOSPHERE_GRIFTERS": ("manosphere_grifters", "Manosphere Grifters", "Alpha male coaches, course sellers, and toxic masculinity hustlers"),
        "BLOCK_DROPSHITTERS": ("dropshitters", "Dropshitters", "Ecommerce spam and wholesale DM merchants"),
        "BLOCK_PRIZE_PIGS": ("prize_pigs", "Prize Pigs", "Fake giveaway and 'you won!' scammers"),
        "BLOCK_WOLF_OF_WALL_STREET_WANNABES": ("wolf_of_wall_street_wannabes", "Wolf of Wall Street Wannabes", "Forex/stock trading signal scammers and day trading gurus"),
        "BLOCK_HUSTLE_PORN": ("hustle_porn", "Hustle Porn", "Get rich quick and passive income fantasies"),
        "BLOCK_LINK_LEECHES": ("link_leeches", "Link Leeches", "Generic 'link in bio' and 'DM me' spammers")
    }
    
    filters = []
    params = [
        {"name": "WHITELIST_SPAM_BLOCKER", "type": "list", "description": "Exempt users from spam blocker restrictions.", "displayName": "Whitelist", "exampleValue": []}
    ]
    groups = []
    
    for toggle_prefix, (file_name, group_name, group_desc) in categories.items():
        category_data = load_category(file_name)
        category_filter = build_category_filter(file_name, category_data, toggle_prefix)
        
        if category_filter:
            filters.append(category_filter)
            
            # Add parameter group
            group_id = file_name
            groups.append({
                "id": group_id,
                "name": group_name,
                "description": group_desc
            })
            
            # Add toggles for bio, posts, hashtags
            if category_data.get("bio_terms"):
                params.append({
                    "name": f"{toggle_prefix}_BIO",
                    "type": "toggle",
                    "description": "Scan user bios for spam patterns",
                    "displayName": f"Block {group_name} (Bio)",
                    "exampleValue": False,
                    "group": group_id
                })
            
            if category_data.get("post_terms"):
                params.append({
                    "name": f"{toggle_prefix}_POSTS",
                    "type": "toggle",
                    "description": "Scan post content for spam patterns",
                    "displayName": f"Block {group_name} (Posts)",
                    "exampleValue": False,
                    "group": group_id
                })
            
            if category_data.get("hashtags"):
                params.append({
                    "name": f"{toggle_prefix}_HASHTAGS",
                    "type": "toggle",
                    "description": "Scan hashtags for spam patterns",
                    "displayName": f"Block {group_name} (Hashtags)",
                    "exampleValue": False,
                    "group": group_id
                })
    
    # Wrap all filters with whitelist check
    final_filter = {
        "or": [
            {"each": ["$WHITELIST_SPAM_BLOCKER", {"list_member": ["$WHITELIST_SPAM_BLOCKER_ITEM", "in"]}]},
            {"and": filters}
        ]
    }
    
    return {
        "filter": {
            "and": [final_filter],
            "metadata": {
                "color": "yellow",
                "customNodeParameters": params,
                "customNodeParameterGroups": groups
            }
        }
    }
