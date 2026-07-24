"""
Ad & Affiliate Link Blocker - Block ads, affiliate spam, and promotional content
"""
import json
import os

metadata = {
    "id": "adblocker",
    "name": "Ad & Affiliate Link Blocker",
    "description": "Block ads, affiliate links, and promotional spam. Manage brands, domains, and ad phrases via settings.",
    "color": "yellow",
    "version": "1.0.0",
    "author": "Custom Nodes System",
    "tags": ["ads", "affiliate", "spam", "moderation"],
    "configurable": {},
    "manageable": True
}

def load_category(category):
    """Load data from a category JSON file"""
    data_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "adblocker", f"{category}.json")
    try:
        with open(data_path, "r") as f:
            return json.load(f)
    except:
        return {}

def build_text_filters(terms, case_sensitive=False):
    """Build filter for terms across text fields"""
    if not terms:
        return []
    fields = ["text", "embed.external.title", "embed.external.description", "embed.media.external.title", "embed.media.external.description"]
    return [{"or": [{"regex_none": [field, terms, not case_sensitive, False]} for field in fields]}]

def build_hashtag_filter(hashtags):
    """Build filter for hashtags"""
    if not hashtags:
        return []
    # Format hashtags with # prefix
    formatted = [f"#{tag}" for tag in hashtags]
    return [{"or": [
        {"regex_none": ["text", formatted, True, False]},
        {"regex_none": ["reply", formatted, True, False]}
    ]}]

def build_affiliate_filter(brand_data, brand_name, tiny_url_shorteners, whitelist_param):
    """Build affiliate link detection filter for a brand"""
    domains = brand_data.get("domains", [])
    tags = brand_data.get("affiliate_tags", [])
    keywords = brand_data.get("keywords", [])
    
    if not domains:
        return None
    
    tag_pattern = "|".join(tags) if tags else ""
    keyword_pattern = "|".join(keywords) if keywords else ""
    
    checks = []
    
    # Direct affiliate link check
    if tag_pattern:
        checks.append({
            "or": [
                {"param_compare": [f"$BLOCK_{brand_name.upper()}_AFFILIATE_LINKS", "==", False]},
                {"entity_excludes": ["domains", domains]},
                {"and": [
                    {"regex_negation_matches": ["facets[*].features[*].uri", tag_pattern, True]},
                    {"regex_negation_matches": ["embed.record.uri", tag_pattern, True]}
                ]}
            ]
        })
    
    # Tiny URL + keyword check
    if keywords and tiny_url_shorteners:
        checks.append({
            "or": [
                {"param_compare": [f"$BLOCK_{brand_name.upper()}_WITH_TINY_URLS", "==", False]},
                {"regex_negation_matches": ["text", keyword_pattern, True]},
                {"entity_excludes": ["domains", tiny_url_shorteners]}
            ]
        })
    
    # Wrap with single whitelist check
    if checks:
        return {
            "or": [
                {"each": [whitelist_param, {"list_member": [f"${whitelist_param}_ITEM", "in"]}]},
                {"and": checks}
            ]
        }
    return None

def get_manifest(options=None):
    """Generate the filter manifest"""
    
    # Load all categories
    universal = load_category("universal")
    ad_hashtags = load_category("ad_hashtags")
    ad_phrases = load_category("ad_phrases")
    amazon = load_category("amazon")
    ebay = load_category("ebay")
    walmart = load_category("walmart")
    bestbuy = load_category("bestbuy")
    target = load_category("target")
    aliexpress = load_category("aliexpress")
    apple = load_category("apple")
    travel = load_category("travel")
    rakuten = load_category("rakuten")
    clickbank = load_category("clickbank")
    
    tiny_url_shorteners = universal.get("tiny_url_shorteners", [])
    affiliate_domains = universal.get("affiliate_domains", [])
    
    filters = []
    
    # Universal affiliate domains
    if affiliate_domains:
        filters.append({
            "or": [
                {"param_compare": ["$BLOCK_UNIVERSAL_AFFILIATE_LINKS", "==", False]},
                {"entity_excludes": ["domains", affiliate_domains]}
            ]
        })
    
    # Ad phrases + hashtags (combined whitelist check)
    ad_checks = []
    if ad_phrases.get("phrases"):
        ad_checks.append({
            "or": [
                {"param_compare": ["$BLOCK_ADS", "==", False]},
                {"and": build_text_filters(ad_phrases.get("phrases", []))}
            ]
        })
    if ad_hashtags.get("hashtags"):
        ad_checks.append({
            "or": [
                {"param_compare": ["$BLOCK_HASHTAG_ADS", "==", False]},
                {"and": build_hashtag_filter(ad_hashtags.get("hashtags", []))}
            ]
        })
    if ad_checks:
        filters.append({
            "or": [
                {"each": ["$WHITELIST_AD_BLOCKER", {"list_member": ["$WHITELIST_AD_BLOCKER_ITEM", "in"]}]},
                {"and": ad_checks}
            ]
        })
    
    # Brand affiliate filters
    brands = [
        ("amazon", amazon),
        ("ebay", ebay),
        ("walmart", walmart),
        ("bestbuy", bestbuy),
        ("target", target),
        ("aliexpress", aliexpress),
        ("apple", apple),
        ("travel", travel),
        ("rakuten", rakuten),
        ("clickbank", clickbank)
    ]
    
    for brand_name, brand_data in brands:
        brand_filter = build_affiliate_filter(brand_data, brand_name, tiny_url_shorteners, "$WHITELIST_AFFILIATE")
        if brand_filter:
            filters.append(brand_filter)
    
    return {
        "filter": {
            "and": filters,
            "metadata": {
                "color": "yellow",
                "customNodeParameters": [
                    {"name": "WHITELIST_AD_BLOCKER", "type": "list", "description": "Exempt users from ad blocker restrictions.", "displayName": "Whitelist: Ad Blocker", "exampleValue": []},
                    {"name": "WHITELIST_AFFILIATE", "type": "list", "description": "Exempt users from affiliate link restrictions.", "displayName": "Whitelist: Affiliate Links", "exampleValue": []},
                    {"name": "BLOCK_UNIVERSAL_AFFILIATE_LINKS", "type": "toggle", "description": "Block universal affiliate shorteners (geni.us, urlgeni.us, etc.)", "displayName": "Block Universal Affiliate Links", "exampleValue": False, "group": "general"},
                    {"name": "BLOCK_ADS", "type": "toggle", "description": "Block posts with ad language (BUY NOW, 50% OFF, etc.)", "displayName": "Block Generic Ad Phrases", "exampleValue": False, "group": "general"},
                    {"name": "BLOCK_HASHTAG_ADS", "type": "toggle", "description": "Block posts with ad hashtags (#ad, #sponsored, etc.)", "displayName": "Block Ad Hashtags", "exampleValue": False, "group": "general"},
                    {"name": "BLOCK_AMAZON_AFFILIATE_LINKS", "type": "toggle", "description": "Block Amazon affiliate links", "displayName": "Block Amazon Affiliate Links", "exampleValue": False, "group": "amazon"},
                    {"name": "BLOCK_AMAZON_WITH_TINY_URLS", "type": "toggle", "description": "Block posts mentioning Amazon with tiny URLs (less precise)", "displayName": "Block Amazon + Tiny URLs", "exampleValue": False, "group": "amazon"},
                    {"name": "BLOCK_EBAY_AFFILIATE_LINKS", "type": "toggle", "description": "Block eBay affiliate links", "displayName": "Block eBay Affiliate Links", "exampleValue": False, "group": "ebay"},
                    {"name": "BLOCK_EBAY_WITH_TINY_URLS", "type": "toggle", "description": "Block posts mentioning eBay with tiny URLs (less precise)", "displayName": "Block eBay + Tiny URLs", "exampleValue": False, "group": "ebay"},
                    {"name": "BLOCK_WALMART_AFFILIATE_LINKS", "type": "toggle", "description": "Block Walmart affiliate links", "displayName": "Block Walmart Affiliate Links", "exampleValue": False, "group": "walmart"},
                    {"name": "BLOCK_WALMART_WITH_TINY_URLS", "type": "toggle", "description": "Block posts mentioning Walmart with tiny URLs (less precise)", "displayName": "Block Walmart + Tiny URLs", "exampleValue": False, "group": "walmart"},
                    {"name": "BLOCK_BESTBUY_AFFILIATE_LINKS", "type": "toggle", "description": "Block BestBuy affiliate links", "displayName": "Block BestBuy Affiliate Links", "exampleValue": False, "group": "bestbuy"},
                    {"name": "BLOCK_BESTBUY_WITH_TINY_URLS", "type": "toggle", "description": "Block posts mentioning BestBuy with tiny URLs (less precise)", "displayName": "Block BestBuy + Tiny URLs", "exampleValue": False, "group": "bestbuy"},
                    {"name": "BLOCK_TARGET_AFFILIATE_LINKS", "type": "toggle", "description": "Block Target affiliate links", "displayName": "Block Target Affiliate Links", "exampleValue": False, "group": "target"},
                    {"name": "BLOCK_TARGET_WITH_TINY_URLS", "type": "toggle", "description": "Block posts mentioning Target with tiny URLs (less precise)", "displayName": "Block Target + Tiny URLs", "exampleValue": False, "group": "target"},
                    {"name": "BLOCK_ALIEXPRESS_AFFILIATE_LINKS", "type": "toggle", "description": "Block AliExpress affiliate links", "displayName": "Block AliExpress Affiliate Links", "exampleValue": True, "group": "aliexpress"},
                    {"name": "BLOCK_ALIEXPRESS_WITH_TINY_URLS", "type": "toggle", "description": "Block posts mentioning AliExpress with tiny URLs (less precise)", "displayName": "Block AliExpress + Tiny URLs", "exampleValue": True, "group": "aliexpress"},
                    {"name": "BLOCK_APPLE_AFFILIATE_LINKS", "type": "toggle", "description": "Block Apple affiliate links", "displayName": "Block Apple Affiliate Links", "exampleValue": True, "group": "apple"},
                    {"name": "BLOCK_APPLE_WITH_TINY_URLS", "type": "toggle", "description": "Block posts mentioning Apple with tiny URLs (less precise)", "displayName": "Block Apple + Tiny URLs", "exampleValue": True, "group": "apple"},
                    {"name": "BLOCK_TRAVEL_AFFILIATE_LINKS", "type": "toggle", "description": "Block travel site affiliate links", "displayName": "Block Travel Affiliate Links", "exampleValue": True, "group": "travel"},
                    {"name": "BLOCK_TRAVEL_WITH_TINY_URLS", "type": "toggle", "description": "Block posts mentioning travel sites with tiny URLs (less precise)", "displayName": "Block Travel + Tiny URLs", "exampleValue": True, "group": "travel"},
                    {"name": "BLOCK_RAKUTEN_AFFILIATE_LINKS", "type": "toggle", "description": "Block Rakuten affiliate links", "displayName": "Block Rakuten Affiliate Links", "exampleValue": True, "group": "rakuten"},
                    {"name": "BLOCK_RAKUTEN_WITH_TINY_URLS", "type": "toggle", "description": "Block posts mentioning Rakuten with tiny URLs (less precise)", "displayName": "Block Rakuten + Tiny URLs", "exampleValue": True, "group": "rakuten"},
                    {"name": "BLOCK_CLICKBANK_AFFILIATE_LINKS", "type": "toggle", "description": "Block ClickBank links", "displayName": "Block ClickBank Links", "exampleValue": True, "group": "clickbank"}
                ],
                "customNodeParameterGroups": [
                    {"id": "general", "name": "General Settings", "description": "Universal ad blocking and whitelists"},
                    {"id": "amazon", "name": "Amazon", "description": "Amazon affiliate link detection"},
                    {"id": "ebay", "name": "eBay", "description": "eBay affiliate link detection"},
                    {"id": "walmart", "name": "Walmart", "description": "Walmart affiliate link detection"},
                    {"id": "bestbuy", "name": "BestBuy", "description": "BestBuy affiliate link detection"},
                    {"id": "target", "name": "Target", "description": "Target affiliate link detection"},
                    {"id": "aliexpress", "name": "AliExpress", "description": "AliExpress affiliate link detection"},
                    {"id": "apple", "name": "Apple", "description": "Apple affiliate link detection"},
                    {"id": "travel", "name": "Travel", "description": "Travel site affiliate link detection"},
                    {"id": "rakuten", "name": "Rakuten", "description": "Rakuten affiliate link detection"},
                    {"id": "clickbank", "name": "ClickBank", "description": "ClickBank link detection"}
                ]
            }
        }
    }
