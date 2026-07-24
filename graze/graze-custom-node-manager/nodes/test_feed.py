"""
Test Feed - Include known spammers, NSFW posters, and advertisers to test your filters
"""
import json
import os

metadata = {
    "id": "test_feed",
    "name": "Moderation Tester",
    "description": "Include lists of known spammers, NSFW posters, and advertisers to test your custom node filters.",
    "color": "brown",
    "version": "1.0.0",
    "author": "Custom Nodes System",
    "tags": ["testing", "debug"],
    "configurable": {},
    "manageable": True
}

def load_test_lists(category):
    """Load test lists for a category"""
    data_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "test_feed", f"{category}.json")
    try:
        with open(data_path, "r") as f:
            return json.load(f).get("lists", [])
    except:
        return []

def get_manifest(options=None):
    """Generate the filter manifest"""
    
    nsfw_lists = load_test_lists("nsfw")
    ads_lists = load_test_lists("ads")
    spam_lists = load_test_lists("spam")
    bots_lists = load_test_lists("bots")
    
    filters = []
    
    # NSFW lists filter
    if nsfw_lists:
        filters.append({
            "or": [
                {"param_compare": ["$INCLUDE_NSFW_LISTS", "==", False]},
                {"or": [{"list_member": [list_uri, "in"]} for list_uri in nsfw_lists]}
            ]
        })
    
    # Ads lists filter
    if ads_lists:
        filters.append({
            "or": [
                {"param_compare": ["$INCLUDE_ADS_LISTS", "==", False]},
                {"or": [{"list_member": [list_uri, "in"]} for list_uri in ads_lists]}
            ]
        })
    
    # Spam lists filter
    if spam_lists:
        filters.append({
            "or": [
                {"param_compare": ["$INCLUDE_SPAM_LISTS", "==", False]},
                {"or": [{"list_member": [list_uri, "in"]} for list_uri in spam_lists]}
            ]
        })
    
    # Bots lists filter
    if bots_lists:
        filters.append({
            "or": [
                {"param_compare": ["$INCLUDE_BOTS_LISTS", "==", False]},
                {"or": [{"list_member": [list_uri, "in"]} for list_uri in bots_lists]}
            ]
        })
    
    params = [
        {
            "name": "INCLUDE_NSFW_LISTS",
            "type": "toggle",
            "description": f"Include {len(nsfw_lists)} NSFW user lists to test NSFW filters",
            "displayName": "Include NSFW Test Lists",
            "exampleValue": False
        },
        {
            "name": "INCLUDE_ADS_LISTS",
            "type": "toggle",
            "description": f"Include {len(ads_lists)} advertiser lists to test ad filters",
            "displayName": "Include Ads Test Lists",
            "exampleValue": False
        },
        {
            "name": "INCLUDE_SPAM_LISTS",
            "type": "toggle",
            "description": f"Include {len(spam_lists)} spam user lists to test spam filters",
            "displayName": "Include Spam Test Lists",
            "exampleValue": False
        },
        {
            "name": "INCLUDE_BOTS_LISTS",
            "type": "toggle",
            "description": f"Include {len(bots_lists)} bot account lists to test bot filters",
            "displayName": "Include Bot Test Lists",
            "exampleValue": False
        }
    ]
    
    return {
        "filter": {
            "and": filters if filters else [{"param_compare": ["$INCLUDE_NSFW_LISTS", "==", True]}],
            "metadata": {
                "color": "brown",
                "customNodeParameters": params
            }
        }
    }
