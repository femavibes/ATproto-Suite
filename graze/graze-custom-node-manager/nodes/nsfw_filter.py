"""
NSFW Content Filter - Block NSFW content by category
"""
import json
import os

metadata = {
    "id": "nsfw_filter",
    "name": "NSFW Content Filter",
    "description": "Block NSFW content by category. Configure categories and terms in settings.",
    "color": "yellow",
    "version": "2.0.0",
    "author": "Custom Nodes System",
    "tags": ["nsfw", "filter", "moderation"],
    "configurable": {},
    "manageable": True
}

def load_category(category):
    """Load terms from a category JSON file"""
    data_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "nsfw", f"{category}.json")
    try:
        with open(data_path, "r") as f:
            return json.load(f)
    except:
        return {}

def build_term_filters(terms):
    """Build filters for terms across multiple text fields"""
    if not terms:
        return []
    fields = [
        "text",
        "embed.images[*].alt",
        "embed.alt",
        "embed.external.title",
        "embed.external.description",
        "embed.media.images[*].alt",
        "embed.media.external.title",
        "embed.media.external.description",
        "hydrated_metadata.quote_post.record.text",
        "inferences.video.audio_transcription.text"
    ]
    return [{"regex_none": [field, terms, True, False]} for field in fields]

def get_manifest(options=None):
    """Generate the filter manifest"""
    
    # Load all categories
    creator_sites = load_category("creator_sites")
    xxx_sites = load_category("xxx_sites")
    shop_sites = load_category("shop_sites")
    general_terms = load_category("general_terms")
    creator_terms = load_category("creator_terms")
    ai_terms = load_category("ai_terms")
    art_terms = load_category("art_terms")
    misc_terms = load_category("misc_terms")
    straight_terms = load_category("straight_terms")
    gay_terms = load_category("gay_terms")
    lesbian_terms = load_category("lesbian_terms")
    bisexual_terms = load_category("bisexual_terms")
    trans_terms = load_category("trans_terms")
    domination_terms = load_category("domination_terms")
    fetish_terms = load_category("fetish_terms")
    cuckold_terms = load_category("cuckold_terms")
    interracial_terms = load_category("interracial_terms")
    feet_terms = load_category("feet_terms")
    latex_terms = load_category("latex_terms")
    roleplay_terms = load_category("roleplay_terms")
    anime_gaming_terms = load_category("anime_gaming_terms")
    hentai_terms = load_category("hentai_terms")
    furry_terms = load_category("furry_terms")
    cosplay_terms = load_category("cosplay_terms")
    softcore_terms = load_category("softcore_terms")
    boobs_terms = load_category("boobs_terms")
    ass_terms = load_category("ass_terms")
    vagina_terms = load_category("vagina_terms")
    penis_terms = load_category("penis_terms")
    bbw_terms = load_category("bbw_terms")
    curvy_terms = load_category("curvy_terms")
    mature_terms = load_category("mature_terms")
    milf_terms = load_category("milf_terms")
    young_adult_terms = load_category("young_adult_terms")
    oral_terms = load_category("oral_terms")
    anal_terms = load_category("anal_terms")
    group_terms = load_category("group_terms")
    solo_terms = load_category("solo_terms")
    pregnancy_terms = load_category("pregnancy_terms")
    cam_terms = load_category("cam_terms")
    sexwork_terms = load_category("sexwork_terms")
    nudity_nonsexual_terms = load_category("nudity_nonsexual_terms")
    
    filters = []
    
    # Block All NSFW
    filters.append({
        "or": [
            {"param_compare": ["$BLOCK_ALL_NSFW", "==", False]},
            {"and": []}
        ]
    })

    # Creator Sites
    if creator_sites.get("terms") or creator_sites.get("hashtags") or creator_sites.get("domains"):
        filter_parts = []
        if creator_sites.get("domains"):
            filter_parts.append({"entity_excludes": ["domains", creator_sites.get("domains", [])]})
        if creator_sites.get("terms"):
            filter_parts.extend(build_term_filters(creator_sites.get("terms", [])))
        if creator_sites.get("hashtags"):
            filter_parts.append({"entity_excludes": ["hashtags", creator_sites.get("hashtags", [])]})
        filters.append({
            "or": [
                {"param_compare": ["$BLOCK_CREATOR_SITES", "==", False]},
                {"and": filter_parts}
            ]
        })

    # General XXX Sites
    if xxx_sites.get("terms") or xxx_sites.get("hashtags") or xxx_sites.get("domains"):
        filter_parts = []
        if xxx_sites.get("domains"):
            filter_parts.append({"entity_excludes": ["domains", xxx_sites.get("domains", [])]})
        if xxx_sites.get("terms"):
            filter_parts.extend(build_term_filters(xxx_sites.get("terms", [])))
        if xxx_sites.get("hashtags"):
            filter_parts.append({"entity_excludes": ["hashtags", xxx_sites.get("hashtags", [])]})
        filters.append({
            "or": [
                {"param_compare": ["$BLOCK_XXX_SITES", "==", False]},
                {"and": filter_parts}
            ]
        })

    # NSFW Shop Sites
    if shop_sites.get("terms") or shop_sites.get("hashtags") or shop_sites.get("domains"):
        filter_parts = []
        if shop_sites.get("domains"):
            filter_parts.append({"entity_excludes": ["domains", shop_sites.get("domains", [])]})
        if shop_sites.get("terms"):
            filter_parts.extend(build_term_filters(shop_sites.get("terms", [])))
        if shop_sites.get("hashtags"):
            filter_parts.append({"entity_excludes": ["hashtags", shop_sites.get("hashtags", [])]})
        filters.append({
            "or": [
                {"param_compare": ["$BLOCK_SHOP_SITES", "==", False]},
                {"and": filter_parts}
            ]
        })

    # General NSFW Terms
    if general_terms.get("terms") or general_terms.get("hashtags") or general_terms.get("domains"):
        filter_parts = []
        if general_terms.get("domains"):
            filter_parts.append({"entity_excludes": ["domains", general_terms.get("domains", [])]})
        if general_terms.get("terms"):
            filter_parts.extend(build_term_filters(general_terms.get("terms", [])))
        if general_terms.get("hashtags"):
            filter_parts.append({"entity_excludes": ["hashtags", general_terms.get("hashtags", [])]})
        filters.append({
            "or": [
                {"param_compare": ["$BLOCK_GENERAL_TERMS", "==", False]},
                {"and": filter_parts}
            ]
        })

    # Creator Terms
    if creator_terms.get("terms") or creator_terms.get("hashtags") or creator_terms.get("domains"):
        filter_parts = []
        if creator_terms.get("domains"):
            filter_parts.append({"entity_excludes": ["domains", creator_terms.get("domains", [])]})
        if creator_terms.get("terms"):
            filter_parts.extend(build_term_filters(creator_terms.get("terms", [])))
        if creator_terms.get("hashtags"):
            filter_parts.append({"entity_excludes": ["hashtags", creator_terms.get("hashtags", [])]})
        filters.append({
            "or": [
                {"param_compare": ["$BLOCK_CREATOR_TERMS", "==", False]},
                {"and": filter_parts}
            ]
        })

    # AI Terms
    if ai_terms.get("terms") or ai_terms.get("hashtags") or ai_terms.get("domains"):
        filter_parts = []
        if ai_terms.get("domains"):
            filter_parts.append({"entity_excludes": ["domains", ai_terms.get("domains", [])]})
        if ai_terms.get("terms"):
            filter_parts.extend(build_term_filters(ai_terms.get("terms", [])))
        if ai_terms.get("hashtags"):
            filter_parts.append({"entity_excludes": ["hashtags", ai_terms.get("hashtags", [])]})
        filters.append({
            "or": [
                {"param_compare": ["$BLOCK_AI_TERMS", "==", False]},
                {"and": filter_parts}
            ]
        })

    # NSFW Art Terms
    if art_terms.get("terms") or art_terms.get("hashtags") or art_terms.get("domains"):
        filter_parts = []
        if art_terms.get("domains"):
            filter_parts.append({"entity_excludes": ["domains", art_terms.get("domains", [])]})
        if art_terms.get("terms"):
            filter_parts.extend(build_term_filters(art_terms.get("terms", [])))
        if art_terms.get("hashtags"):
            filter_parts.append({"entity_excludes": ["hashtags", art_terms.get("hashtags", [])]})
        filters.append({
            "or": [
                {"param_compare": ["$BLOCK_ART_TERMS", "==", False]},
                {"and": filter_parts}
            ]
        })

    # Misc Terms
    if misc_terms.get("terms") or misc_terms.get("hashtags") or misc_terms.get("domains"):
        filter_parts = []
        if misc_terms.get("domains"):
            filter_parts.append({"entity_excludes": ["domains", misc_terms.get("domains", [])]})
        if misc_terms.get("terms"):
            filter_parts.extend(build_term_filters(misc_terms.get("terms", [])))
        if misc_terms.get("hashtags"):
            filter_parts.append({"entity_excludes": ["hashtags", misc_terms.get("hashtags", [])]})
        filters.append({
            "or": [
                {"param_compare": ["$BLOCK_MISC_TERMS", "==", False]},
                {"and": filter_parts}
            ]
        })

    # Straight Terms
    if straight_terms.get("terms") or straight_terms.get("hashtags") or straight_terms.get("domains"):
        filter_parts = []
        if straight_terms.get("domains"):
            filter_parts.append({"entity_excludes": ["domains", straight_terms.get("domains", [])]})
        if straight_terms.get("terms"):
            filter_parts.extend(build_term_filters(straight_terms.get("terms", [])))
        if straight_terms.get("hashtags"):
            filter_parts.append({"entity_excludes": ["hashtags", straight_terms.get("hashtags", [])]})
        filters.append({
            "or": [
                {"param_compare": ["$BLOCK_STRAIGHT_TERMS", "==", False]},
                {"and": filter_parts}
            ]
        })

    # Gay Terms
    if gay_terms.get("terms") or gay_terms.get("hashtags") or gay_terms.get("domains"):
        filter_parts = []
        if gay_terms.get("domains"):
            filter_parts.append({"entity_excludes": ["domains", gay_terms.get("domains", [])]})
        if gay_terms.get("terms"):
            filter_parts.extend(build_term_filters(gay_terms.get("terms", [])))
        if gay_terms.get("hashtags"):
            filter_parts.append({"entity_excludes": ["hashtags", gay_terms.get("hashtags", [])]})
        filters.append({
            "or": [
                {"param_compare": ["$BLOCK_GAY_TERMS", "==", False]},
                {"and": filter_parts}
            ]
        })

    # Lesbian/WLW Terms
    if lesbian_terms.get("terms") or lesbian_terms.get("hashtags") or lesbian_terms.get("domains"):
        filter_parts = []
        if lesbian_terms.get("domains"):
            filter_parts.append({"entity_excludes": ["domains", lesbian_terms.get("domains", [])]})
        if lesbian_terms.get("terms"):
            filter_parts.extend(build_term_filters(lesbian_terms.get("terms", [])))
        if lesbian_terms.get("hashtags"):
            filter_parts.append({"entity_excludes": ["hashtags", lesbian_terms.get("hashtags", [])]})
        filters.append({
            "or": [
                {"param_compare": ["$BLOCK_LESBIAN_TERMS", "==", False]},
                {"and": filter_parts}
            ]
        })

    # Bisexual Terms
    if bisexual_terms.get("terms") or bisexual_terms.get("hashtags") or bisexual_terms.get("domains"):
        filter_parts = []
        if bisexual_terms.get("domains"):
            filter_parts.append({"entity_excludes": ["domains", bisexual_terms.get("domains", [])]})
        if bisexual_terms.get("terms"):
            filter_parts.extend(build_term_filters(bisexual_terms.get("terms", [])))
        if bisexual_terms.get("hashtags"):
            filter_parts.append({"entity_excludes": ["hashtags", bisexual_terms.get("hashtags", [])]})
        filters.append({
            "or": [
                {"param_compare": ["$BLOCK_BISEXUAL_TERMS", "==", False]},
                {"and": filter_parts}
            ]
        })

    # Trans Terms
    if trans_terms.get("terms") or trans_terms.get("hashtags") or trans_terms.get("domains"):
        filter_parts = []
        if trans_terms.get("domains"):
            filter_parts.append({"entity_excludes": ["domains", trans_terms.get("domains", [])]})
        if trans_terms.get("terms"):
            filter_parts.extend(build_term_filters(trans_terms.get("terms", [])))
        if trans_terms.get("hashtags"):
            filter_parts.append({"entity_excludes": ["hashtags", trans_terms.get("hashtags", [])]})
        filters.append({
            "or": [
                {"param_compare": ["$BLOCK_TRANS_TERMS", "==", False]},
                {"and": filter_parts}
            ]
        })

    # Domination Terms
    if domination_terms.get("terms") or domination_terms.get("hashtags") or domination_terms.get("domains"):
        filter_parts = []
        if domination_terms.get("domains"):
            filter_parts.append({"entity_excludes": ["domains", domination_terms.get("domains", [])]})
        if domination_terms.get("terms"):
            filter_parts.extend(build_term_filters(domination_terms.get("terms", [])))
        if domination_terms.get("hashtags"):
            filter_parts.append({"entity_excludes": ["hashtags", domination_terms.get("hashtags", [])]})
        filters.append({
            "or": [
                {"param_compare": ["$BLOCK_DOMINATION_TERMS", "==", False]},
                {"and": filter_parts}
            ]
        })

    # Fetish Terms
    if fetish_terms.get("terms") or fetish_terms.get("hashtags") or fetish_terms.get("domains"):
        filter_parts = []
        if fetish_terms.get("domains"):
            filter_parts.append({"entity_excludes": ["domains", fetish_terms.get("domains", [])]})
        if fetish_terms.get("terms"):
            filter_parts.extend(build_term_filters(fetish_terms.get("terms", [])))
        if fetish_terms.get("hashtags"):
            filter_parts.append({"entity_excludes": ["hashtags", fetish_terms.get("hashtags", [])]})
        filters.append({
            "or": [
                {"param_compare": ["$BLOCK_FETISH_TERMS", "==", False]},
                {"and": filter_parts}
            ]
        })

    # Cuckold Terms
    if cuckold_terms.get("terms") or cuckold_terms.get("hashtags") or cuckold_terms.get("domains"):
        filter_parts = []
        if cuckold_terms.get("domains"):
            filter_parts.append({"entity_excludes": ["domains", cuckold_terms.get("domains", [])]})
        if cuckold_terms.get("terms"):
            filter_parts.extend(build_term_filters(cuckold_terms.get("terms", [])))
        if cuckold_terms.get("hashtags"):
            filter_parts.append({"entity_excludes": ["hashtags", cuckold_terms.get("hashtags", [])]})
        filters.append({
            "or": [
                {"param_compare": ["$BLOCK_CUCKOLD_TERMS", "==", False]},
                {"and": filter_parts}
            ]
        })

    # Interracial Terms
    if interracial_terms.get("terms") or interracial_terms.get("hashtags") or interracial_terms.get("domains"):
        filter_parts = []
        if interracial_terms.get("domains"):
            filter_parts.append({"entity_excludes": ["domains", interracial_terms.get("domains", [])]})
        if interracial_terms.get("terms"):
            filter_parts.extend(build_term_filters(interracial_terms.get("terms", [])))
        if interracial_terms.get("hashtags"):
            filter_parts.append({"entity_excludes": ["hashtags", interracial_terms.get("hashtags", [])]})
        filters.append({
            "or": [
                {"param_compare": ["$BLOCK_INTERRACIAL_TERMS", "==", False]},
                {"and": filter_parts}
            ]
        })

    # Feet Terms
    if feet_terms.get("terms") or feet_terms.get("hashtags") or feet_terms.get("domains"):
        filter_parts = []
        if feet_terms.get("domains"):
            filter_parts.append({"entity_excludes": ["domains", feet_terms.get("domains", [])]})
        if feet_terms.get("terms"):
            filter_parts.extend(build_term_filters(feet_terms.get("terms", [])))
        if feet_terms.get("hashtags"):
            filter_parts.append({"entity_excludes": ["hashtags", feet_terms.get("hashtags", [])]})
        filters.append({
            "or": [
                {"param_compare": ["$BLOCK_FEET_TERMS", "==", False]},
                {"and": filter_parts}
            ]
        })

    # Latex/Leather/Rubber Terms
    if latex_terms.get("terms") or latex_terms.get("hashtags") or latex_terms.get("domains"):
        filter_parts = []
        if latex_terms.get("domains"):
            filter_parts.append({"entity_excludes": ["domains", latex_terms.get("domains", [])]})
        if latex_terms.get("terms"):
            filter_parts.extend(build_term_filters(latex_terms.get("terms", [])))
        if latex_terms.get("hashtags"):
            filter_parts.append({"entity_excludes": ["hashtags", latex_terms.get("hashtags", [])]})
        filters.append({
            "or": [
                {"param_compare": ["$BLOCK_LATEX_TERMS", "==", False]},
                {"and": filter_parts}
            ]
        })

    # Roleplay Terms
    if roleplay_terms.get("terms") or roleplay_terms.get("hashtags") or roleplay_terms.get("domains"):
        filter_parts = []
        if roleplay_terms.get("domains"):
            filter_parts.append({"entity_excludes": ["domains", roleplay_terms.get("domains", [])]})
        if roleplay_terms.get("terms"):
            filter_parts.extend(build_term_filters(roleplay_terms.get("terms", [])))
        if roleplay_terms.get("hashtags"):
            filter_parts.append({"entity_excludes": ["hashtags", roleplay_terms.get("hashtags", [])]})
        filters.append({
            "or": [
                {"param_compare": ["$BLOCK_ROLEPLAY_TERMS", "==", False]},
                {"and": filter_parts}
            ]
        })

    # Anime/Gaming Terms
    if anime_gaming_terms.get("terms") or anime_gaming_terms.get("hashtags") or anime_gaming_terms.get("domains"):
        filter_parts = []
        if anime_gaming_terms.get("domains"):
            filter_parts.append({"entity_excludes": ["domains", anime_gaming_terms.get("domains", [])]})
        if anime_gaming_terms.get("terms"):
            filter_parts.extend(build_term_filters(anime_gaming_terms.get("terms", [])))
        if anime_gaming_terms.get("hashtags"):
            filter_parts.append({"entity_excludes": ["hashtags", anime_gaming_terms.get("hashtags", [])]})
        filters.append({
            "or": [
                {"param_compare": ["$BLOCK_ANIME_GAMING_TERMS", "==", False]},
                {"and": filter_parts}
            ]
        })

    # Hentai Terms
    if hentai_terms.get("terms") or hentai_terms.get("hashtags") or hentai_terms.get("domains"):
        filter_parts = []
        if hentai_terms.get("domains"):
            filter_parts.append({"entity_excludes": ["domains", hentai_terms.get("domains", [])]})
        if hentai_terms.get("terms"):
            filter_parts.extend(build_term_filters(hentai_terms.get("terms", [])))
        if hentai_terms.get("hashtags"):
            filter_parts.append({"entity_excludes": ["hashtags", hentai_terms.get("hashtags", [])]})
        filters.append({
            "or": [
                {"param_compare": ["$BLOCK_HENTAI_TERMS", "==", False]},
                {"and": filter_parts}
            ]
        })

    # Furry Terms
    if furry_terms.get("terms") or furry_terms.get("hashtags") or furry_terms.get("domains"):
        filter_parts = []
        if furry_terms.get("domains"):
            filter_parts.append({"entity_excludes": ["domains", furry_terms.get("domains", [])]})
        if furry_terms.get("terms"):
            filter_parts.extend(build_term_filters(furry_terms.get("terms", [])))
        if furry_terms.get("hashtags"):
            filter_parts.append({"entity_excludes": ["hashtags", furry_terms.get("hashtags", [])]})
        filters.append({
            "or": [
                {"param_compare": ["$BLOCK_FURRY_TERMS", "==", False]},
                {"and": filter_parts}
            ]
        })

    # Cosplay Terms
    if cosplay_terms.get("terms") or cosplay_terms.get("hashtags") or cosplay_terms.get("domains"):
        filter_parts = []
        if cosplay_terms.get("domains"):
            filter_parts.append({"entity_excludes": ["domains", cosplay_terms.get("domains", [])]})
        if cosplay_terms.get("terms"):
            filter_parts.extend(build_term_filters(cosplay_terms.get("terms", [])))
        if cosplay_terms.get("hashtags"):
            filter_parts.append({"entity_excludes": ["hashtags", cosplay_terms.get("hashtags", [])]})
        filters.append({
            "or": [
                {"param_compare": ["$BLOCK_COSPLAY_TERMS", "==", False]},
                {"and": filter_parts}
            ]
        })

    # Softcore/Suggestive Terms
    if softcore_terms.get("terms") or softcore_terms.get("hashtags") or softcore_terms.get("domains"):
        filter_parts = []
        if softcore_terms.get("domains"):
            filter_parts.append({"entity_excludes": ["domains", softcore_terms.get("domains", [])]})
        if softcore_terms.get("terms"):
            filter_parts.extend(build_term_filters(softcore_terms.get("terms", [])))
        if softcore_terms.get("hashtags"):
            filter_parts.append({"entity_excludes": ["hashtags", softcore_terms.get("hashtags", [])]})
        filters.append({
            "or": [
                {"param_compare": ["$BLOCK_SOFTCORE_TERMS", "==", False]},
                {"and": filter_parts}
            ]
        })

    # Boobs Terms
    if boobs_terms.get("terms") or boobs_terms.get("hashtags") or boobs_terms.get("domains"):
        filter_parts = []
        if boobs_terms.get("domains"):
            filter_parts.append({"entity_excludes": ["domains", boobs_terms.get("domains", [])]})
        if boobs_terms.get("terms"):
            filter_parts.extend(build_term_filters(boobs_terms.get("terms", [])))
        if boobs_terms.get("hashtags"):
            filter_parts.append({"entity_excludes": ["hashtags", boobs_terms.get("hashtags", [])]})
        filters.append({
            "or": [
                {"param_compare": ["$BLOCK_BOOBS_TERMS", "==", False]},
                {"and": filter_parts}
            ]
        })

    # Ass Terms
    if ass_terms.get("terms") or ass_terms.get("hashtags") or ass_terms.get("domains"):
        filter_parts = []
        if ass_terms.get("domains"):
            filter_parts.append({"entity_excludes": ["domains", ass_terms.get("domains", [])]})
        if ass_terms.get("terms"):
            filter_parts.extend(build_term_filters(ass_terms.get("terms", [])))
        if ass_terms.get("hashtags"):
            filter_parts.append({"entity_excludes": ["hashtags", ass_terms.get("hashtags", [])]})
        filters.append({
            "or": [
                {"param_compare": ["$BLOCK_ASS_TERMS", "==", False]},
                {"and": filter_parts}
            ]
        })

    # Vagina Terms
    if vagina_terms.get("terms") or vagina_terms.get("hashtags") or vagina_terms.get("domains"):
        filter_parts = []
        if vagina_terms.get("domains"):
            filter_parts.append({"entity_excludes": ["domains", vagina_terms.get("domains", [])]})
        if vagina_terms.get("terms"):
            filter_parts.extend(build_term_filters(vagina_terms.get("terms", [])))
        if vagina_terms.get("hashtags"):
            filter_parts.append({"entity_excludes": ["hashtags", vagina_terms.get("hashtags", [])]})
        filters.append({
            "or": [
                {"param_compare": ["$BLOCK_VAGINA_TERMS", "==", False]},
                {"and": filter_parts}
            ]
        })

    # Penis Terms
    if penis_terms.get("terms") or penis_terms.get("hashtags") or penis_terms.get("domains"):
        filter_parts = []
        if penis_terms.get("domains"):
            filter_parts.append({"entity_excludes": ["domains", penis_terms.get("domains", [])]})
        if penis_terms.get("terms"):
            filter_parts.extend(build_term_filters(penis_terms.get("terms", [])))
        if penis_terms.get("hashtags"):
            filter_parts.append({"entity_excludes": ["hashtags", penis_terms.get("hashtags", [])]})
        filters.append({
            "or": [
                {"param_compare": ["$BLOCK_PENIS_TERMS", "==", False]},
                {"and": filter_parts}
            ]
        })

    # BBW Terms
    if bbw_terms.get("terms") or bbw_terms.get("hashtags") or bbw_terms.get("domains"):
        filter_parts = []
        if bbw_terms.get("domains"):
            filter_parts.append({"entity_excludes": ["domains", bbw_terms.get("domains", [])]})
        if bbw_terms.get("terms"):
            filter_parts.extend(build_term_filters(bbw_terms.get("terms", [])))
        if bbw_terms.get("hashtags"):
            filter_parts.append({"entity_excludes": ["hashtags", bbw_terms.get("hashtags", [])]})
        filters.append({
            "or": [
                {"param_compare": ["$BLOCK_BBW_TERMS", "==", False]},
                {"and": filter_parts}
            ]
        })

    # Curvy Terms
    if curvy_terms.get("terms") or curvy_terms.get("hashtags") or curvy_terms.get("domains"):
        filter_parts = []
        if curvy_terms.get("domains"):
            filter_parts.append({"entity_excludes": ["domains", curvy_terms.get("domains", [])]})
        if curvy_terms.get("terms"):
            filter_parts.extend(build_term_filters(curvy_terms.get("terms", [])))
        if curvy_terms.get("hashtags"):
            filter_parts.append({"entity_excludes": ["hashtags", curvy_terms.get("hashtags", [])]})
        filters.append({
            "or": [
                {"param_compare": ["$BLOCK_CURVY_TERMS", "==", False]},
                {"and": filter_parts}
            ]
        })

    # Mature/GILF Terms
    if mature_terms.get("terms") or mature_terms.get("hashtags") or mature_terms.get("domains"):
        filter_parts = []
        if mature_terms.get("domains"):
            filter_parts.append({"entity_excludes": ["domains", mature_terms.get("domains", [])]})
        if mature_terms.get("terms"):
            filter_parts.extend(build_term_filters(mature_terms.get("terms", [])))
        if mature_terms.get("hashtags"):
            filter_parts.append({"entity_excludes": ["hashtags", mature_terms.get("hashtags", [])]})
        filters.append({
            "or": [
                {"param_compare": ["$BLOCK_MATURE_TERMS", "==", False]},
                {"and": filter_parts}
            ]
        })

    # MILF Terms
    if milf_terms.get("terms") or milf_terms.get("hashtags") or milf_terms.get("domains"):
        filter_parts = []
        if milf_terms.get("domains"):
            filter_parts.append({"entity_excludes": ["domains", milf_terms.get("domains", [])]})
        if milf_terms.get("terms"):
            filter_parts.extend(build_term_filters(milf_terms.get("terms", [])))
        if milf_terms.get("hashtags"):
            filter_parts.append({"entity_excludes": ["hashtags", milf_terms.get("hashtags", [])]})
        filters.append({
            "or": [
                {"param_compare": ["$BLOCK_MILF_TERMS", "==", False]},
                {"and": filter_parts}
            ]
        })

    # Young Adult (18+) Terms
    if young_adult_terms.get("terms") or young_adult_terms.get("hashtags") or young_adult_terms.get("domains"):
        filter_parts = []
        if young_adult_terms.get("domains"):
            filter_parts.append({"entity_excludes": ["domains", young_adult_terms.get("domains", [])]})
        if young_adult_terms.get("terms"):
            filter_parts.extend(build_term_filters(young_adult_terms.get("terms", [])))
        if young_adult_terms.get("hashtags"):
            filter_parts.append({"entity_excludes": ["hashtags", young_adult_terms.get("hashtags", [])]})
        filters.append({
            "or": [
                {"param_compare": ["$BLOCK_YOUNG_ADULT_TERMS", "==", False]},
                {"and": filter_parts}
            ]
        })

    # Oral/Blowjob Terms
    if oral_terms.get("terms") or oral_terms.get("hashtags") or oral_terms.get("domains"):
        filter_parts = []
        if oral_terms.get("domains"):
            filter_parts.append({"entity_excludes": ["domains", oral_terms.get("domains", [])]})
        if oral_terms.get("terms"):
            filter_parts.extend(build_term_filters(oral_terms.get("terms", [])))
        if oral_terms.get("hashtags"):
            filter_parts.append({"entity_excludes": ["hashtags", oral_terms.get("hashtags", [])]})
        filters.append({
            "or": [
                {"param_compare": ["$BLOCK_ORAL_TERMS", "==", False]},
                {"and": filter_parts}
            ]
        })

    # Anal Terms
    if anal_terms.get("terms") or anal_terms.get("hashtags") or anal_terms.get("domains"):
        filter_parts = []
        if anal_terms.get("domains"):
            filter_parts.append({"entity_excludes": ["domains", anal_terms.get("domains", [])]})
        if anal_terms.get("terms"):
            filter_parts.extend(build_term_filters(anal_terms.get("terms", [])))
        if anal_terms.get("hashtags"):
            filter_parts.append({"entity_excludes": ["hashtags", anal_terms.get("hashtags", [])]})
        filters.append({
            "or": [
                {"param_compare": ["$BLOCK_ANAL_TERMS", "==", False]},
                {"and": filter_parts}
            ]
        })

    # Group/Threesome/Orgy Terms
    if group_terms.get("terms") or group_terms.get("hashtags") or group_terms.get("domains"):
        filter_parts = []
        if group_terms.get("domains"):
            filter_parts.append({"entity_excludes": ["domains", group_terms.get("domains", [])]})
        if group_terms.get("terms"):
            filter_parts.extend(build_term_filters(group_terms.get("terms", [])))
        if group_terms.get("hashtags"):
            filter_parts.append({"entity_excludes": ["hashtags", group_terms.get("hashtags", [])]})
        filters.append({
            "or": [
                {"param_compare": ["$BLOCK_GROUP_TERMS", "==", False]},
                {"and": filter_parts}
            ]
        })

    # Solo/Masturbation Terms
    if solo_terms.get("terms") or solo_terms.get("hashtags") or solo_terms.get("domains"):
        filter_parts = []
        if solo_terms.get("domains"):
            filter_parts.append({"entity_excludes": ["domains", solo_terms.get("domains", [])]})
        if solo_terms.get("terms"):
            filter_parts.extend(build_term_filters(solo_terms.get("terms", [])))
        if solo_terms.get("hashtags"):
            filter_parts.append({"entity_excludes": ["hashtags", solo_terms.get("hashtags", [])]})
        filters.append({
            "or": [
                {"param_compare": ["$BLOCK_SOLO_TERMS", "==", False]},
                {"and": filter_parts}
            ]
        })

    # Pregnancy/Breeding Terms
    if pregnancy_terms.get("terms") or pregnancy_terms.get("hashtags") or pregnancy_terms.get("domains"):
        filter_parts = []
        if pregnancy_terms.get("domains"):
            filter_parts.append({"entity_excludes": ["domains", pregnancy_terms.get("domains", [])]})
        if pregnancy_terms.get("terms"):
            filter_parts.extend(build_term_filters(pregnancy_terms.get("terms", [])))
        if pregnancy_terms.get("hashtags"):
            filter_parts.append({"entity_excludes": ["hashtags", pregnancy_terms.get("hashtags", [])]})
        filters.append({
            "or": [
                {"param_compare": ["$BLOCK_PREGNANCY_TERMS", "==", False]},
                {"and": filter_parts}
            ]
        })

    # Cam/Streaming Terms
    if cam_terms.get("terms") or cam_terms.get("hashtags") or cam_terms.get("domains"):
        filter_parts = []
        if cam_terms.get("domains"):
            filter_parts.append({"entity_excludes": ["domains", cam_terms.get("domains", [])]})
        if cam_terms.get("terms"):
            filter_parts.extend(build_term_filters(cam_terms.get("terms", [])))
        if cam_terms.get("hashtags"):
            filter_parts.append({"entity_excludes": ["hashtags", cam_terms.get("hashtags", [])]})
        filters.append({
            "or": [
                {"param_compare": ["$BLOCK_CAM_TERMS", "==", False]},
                {"and": filter_parts}
            ]
        })

    # Sex Work Terms
    if sexwork_terms.get("terms") or sexwork_terms.get("hashtags") or sexwork_terms.get("domains"):
        filter_parts = []
        if sexwork_terms.get("domains"):
            filter_parts.append({"entity_excludes": ["domains", sexwork_terms.get("domains", [])]})
        if sexwork_terms.get("terms"):
            filter_parts.extend(build_term_filters(sexwork_terms.get("terms", [])))
        if sexwork_terms.get("hashtags"):
            filter_parts.append({"entity_excludes": ["hashtags", sexwork_terms.get("hashtags", [])]})
        filters.append({
            "or": [
                {"param_compare": ["$BLOCK_SEXWORK_TERMS", "==", False]},
                {"and": filter_parts}
            ]
        })

    # Nudity (Non-Sexual) Terms
    if nudity_nonsexual_terms.get("terms") or nudity_nonsexual_terms.get("hashtags") or nudity_nonsexual_terms.get("domains"):
        filter_parts = []
        if nudity_nonsexual_terms.get("domains"):
            filter_parts.append({"entity_excludes": ["domains", nudity_nonsexual_terms.get("domains", [])]})
        if nudity_nonsexual_terms.get("terms"):
            filter_parts.extend(build_term_filters(nudity_nonsexual_terms.get("terms", [])))
        if nudity_nonsexual_terms.get("hashtags"):
            filter_parts.append({"entity_excludes": ["hashtags", nudity_nonsexual_terms.get("hashtags", [])]})
        filters.append({
            "or": [
                {"param_compare": ["$BLOCK_NUDITY_NONSEXUAL_TERMS", "==", False]},
                {"and": filter_parts}
            ]
        })

    # Bluesky Labels
    filters.append({
        "or": [
            {"param_compare": ["$block_labels", "==", False]},
            {"and": [
                {"attribute_compare": ["hydrated_metadata.user.labels[*].val", "!=", "sexual"]},
                {"attribute_compare": ["hydrated_metadata.user.labels[*].val", "!=", "nudity"]},
                {"attribute_compare": ["hydrated_metadata.user.labels[*].val", "!=", "porn"]},
                {"entity_excludes": ["labels", ["porn", "sexual", "nudity", "graphic-media"]]}
            ]}
        ]
    })

    return {
        "filter": {
            "and": filters,
            "metadata": {
                "color": "yellow",
                "customNodeParameters": [
                    {"name": "BLOCK_ALL_NSFW", "type": "toggle", "description": "Block ALL NSFW content from all categories. When enabled, all other toggles are ignored.", "displayName": "🚫 Block ALL NSFW Content", "exampleValue": False},
                    {"name": "block_labels", "type": "toggle", "description": "Block all posts with self-applied NSFW labels.", "displayName": "Block Self Labeled NSFW Posts", "exampleValue": True},
                    {"name": "DIRECTIONS", "description": "Toggle to block content. Use the gear icon to manage terms.", "displayName": "Directions:", "exampleValue": "Toggle to block content."},
                    {"name": "BLOCK_CREATOR_SITES", "type": "toggle", "group": "sites", "description": "Block creator sites", "displayName": "Block Creator Sites", "exampleValue": False},
                    {"name": "BLOCK_XXX_SITES", "type": "toggle", "group": "sites", "description": "Block general xxx sites", "displayName": "Block General XXX Sites", "exampleValue": False},
                    {"name": "BLOCK_SHOP_SITES", "type": "toggle", "group": "sites", "description": "Block nsfw shop sites", "displayName": "Block NSFW Shop Sites", "exampleValue": False},
                    {"name": "BLOCK_GENERAL_TERMS", "type": "toggle", "group": "general", "description": "Block general nsfw terms", "displayName": "Block General NSFW Terms", "exampleValue": False},
                    {"name": "BLOCK_CREATOR_TERMS", "type": "toggle", "group": "general", "description": "Block creator terms", "displayName": "Block Creator Terms", "exampleValue": False},
                    {"name": "BLOCK_AI_TERMS", "type": "toggle", "group": "general", "description": "Block ai terms", "displayName": "Block AI Terms", "exampleValue": False},
                    {"name": "BLOCK_ART_TERMS", "type": "toggle", "group": "general", "description": "Block nsfw art terms", "displayName": "Block NSFW Art Terms", "exampleValue": False},
                    {"name": "BLOCK_MISC_TERMS", "type": "toggle", "group": "general", "description": "Block misc terms", "displayName": "Block Misc Terms", "exampleValue": False},
                    {"name": "BLOCK_STRAIGHT_TERMS", "type": "toggle", "group": "orientation", "description": "Block straight terms", "displayName": "Block Straight Terms", "exampleValue": False},
                    {"name": "BLOCK_GAY_TERMS", "type": "toggle", "group": "orientation", "description": "Block gay terms", "displayName": "Block Gay Terms", "exampleValue": False},
                    {"name": "BLOCK_LESBIAN_TERMS", "type": "toggle", "group": "orientation", "description": "Block lesbian/wlw terms", "displayName": "Block Lesbian/WLW Terms", "exampleValue": False},
                    {"name": "BLOCK_BISEXUAL_TERMS", "type": "toggle", "group": "orientation", "description": "Block bisexual terms", "displayName": "Block Bisexual Terms", "exampleValue": False},
                    {"name": "BLOCK_TRANS_TERMS", "type": "toggle", "group": "orientation", "description": "Block trans terms", "displayName": "Block Trans Terms", "exampleValue": False},
                    {"name": "BLOCK_DOMINATION_TERMS", "type": "toggle", "group": "kinks", "description": "Block domination terms", "displayName": "Block Domination Terms", "exampleValue": False},
                    {"name": "BLOCK_FETISH_TERMS", "type": "toggle", "group": "kinks", "description": "Block fetish terms", "displayName": "Block Fetish Terms", "exampleValue": False},
                    {"name": "BLOCK_CUCKOLD_TERMS", "type": "toggle", "group": "kinks", "description": "Block cuckold terms", "displayName": "Block Cuckold Terms", "exampleValue": False},
                    {"name": "BLOCK_INTERRACIAL_TERMS", "type": "toggle", "group": "kinks", "description": "Block interracial terms", "displayName": "Block Interracial Terms", "exampleValue": False},
                    {"name": "BLOCK_FEET_TERMS", "type": "toggle", "group": "kinks", "description": "Block feet terms", "displayName": "Block Feet Terms", "exampleValue": False},
                    {"name": "BLOCK_LATEX_TERMS", "type": "toggle", "group": "kinks", "description": "Block latex/leather/rubber terms", "displayName": "Block Latex/Leather/Rubber Terms", "exampleValue": False},
                    {"name": "BLOCK_ROLEPLAY_TERMS", "type": "toggle", "group": "kinks", "description": "Block roleplay terms", "displayName": "Block Roleplay Terms", "exampleValue": False},
                    {"name": "BLOCK_ANIME_GAMING_TERMS", "type": "toggle", "group": "media", "description": "Block anime/gaming terms", "displayName": "Block Anime/Gaming Terms", "exampleValue": False},
                    {"name": "BLOCK_HENTAI_TERMS", "type": "toggle", "group": "media", "description": "Block hentai terms", "displayName": "Block Hentai Terms", "exampleValue": False},
                    {"name": "BLOCK_FURRY_TERMS", "type": "toggle", "group": "media", "description": "Block furry terms", "displayName": "Block Furry Terms", "exampleValue": False},
                    {"name": "BLOCK_COSPLAY_TERMS", "type": "toggle", "group": "media", "description": "Block cosplay terms", "displayName": "Block Cosplay Terms", "exampleValue": False},
                    {"name": "BLOCK_SOFTCORE_TERMS", "type": "toggle", "group": "media", "description": "Block softcore/suggestive terms", "displayName": "Block Softcore/Suggestive Terms", "exampleValue": False},
                    {"name": "BLOCK_BOOBS_TERMS", "type": "toggle", "group": "body_parts", "description": "Block boobs terms", "displayName": "Block Boobs Terms", "exampleValue": False},
                    {"name": "BLOCK_ASS_TERMS", "type": "toggle", "group": "body_parts", "description": "Block ass terms", "displayName": "Block Ass Terms", "exampleValue": False},
                    {"name": "BLOCK_VAGINA_TERMS", "type": "toggle", "group": "body_parts", "description": "Block vagina terms", "displayName": "Block Vagina Terms", "exampleValue": False},
                    {"name": "BLOCK_PENIS_TERMS", "type": "toggle", "group": "body_parts", "description": "Block penis terms", "displayName": "Block Penis Terms", "exampleValue": False},
                    {"name": "BLOCK_BBW_TERMS", "type": "toggle", "group": "body_types", "description": "Block bbw terms", "displayName": "Block BBW Terms", "exampleValue": False},
                    {"name": "BLOCK_CURVY_TERMS", "type": "toggle", "group": "body_types", "description": "Block curvy terms", "displayName": "Block Curvy Terms", "exampleValue": False},
                    {"name": "BLOCK_MATURE_TERMS", "type": "toggle", "group": "body_types", "description": "Block mature/gilf terms", "displayName": "Block Mature/GILF Terms", "exampleValue": False},
                    {"name": "BLOCK_MILF_TERMS", "type": "toggle", "group": "body_types", "description": "Block milf terms", "displayName": "Block MILF Terms", "exampleValue": False},
                    {"name": "BLOCK_YOUNG_ADULT_TERMS", "type": "toggle", "group": "body_types", "description": "Block young adult (18+) terms", "displayName": "Block Young Adult (18+) Terms", "exampleValue": False},
                    {"name": "BLOCK_ORAL_TERMS", "type": "toggle", "group": "acts", "description": "Block oral/blowjob terms", "displayName": "Block Oral/Blowjob Terms", "exampleValue": False},
                    {"name": "BLOCK_ANAL_TERMS", "type": "toggle", "group": "acts", "description": "Block anal terms", "displayName": "Block Anal Terms", "exampleValue": False},
                    {"name": "BLOCK_GROUP_TERMS", "type": "toggle", "group": "acts", "description": "Block group/threesome/orgy terms", "displayName": "Block Group/Threesome/Orgy Terms", "exampleValue": False},
                    {"name": "BLOCK_SOLO_TERMS", "type": "toggle", "group": "acts", "description": "Block solo/masturbation terms", "displayName": "Block Solo/Masturbation Terms", "exampleValue": False},
                    {"name": "BLOCK_PREGNANCY_TERMS", "type": "toggle", "group": "acts", "description": "Block pregnancy/breeding terms", "displayName": "Block Pregnancy/Breeding Terms", "exampleValue": False},
                    {"name": "BLOCK_CAM_TERMS", "type": "toggle", "group": "acts", "description": "Block cam/streaming terms", "displayName": "Block Cam/Streaming Terms", "exampleValue": False},
                    {"name": "BLOCK_SEXWORK_TERMS", "type": "toggle", "group": "acts", "description": "Block sex work terms", "displayName": "Block Sex Work Terms", "exampleValue": False},
                    {"name": "BLOCK_NUDITY_NONSEXUAL_TERMS", "type": "toggle", "group": "acts", "description": "Block nudity (non-sexual) terms", "displayName": "Block Nudity (Non-Sexual) Terms", "exampleValue": False},
                ],
                "customNodeParameterGroups": [
                    {"id": "sites", "name": "Sites", "description": "Block NSFW domains"},
                    {"id": "general", "name": "General Content", "description": "General NSFW content"},
                    {"id": "orientation", "name": "Orientation/Identity", "description": "Sexual orientation and identity"},
                    {"id": "kinks", "name": "Kinks & Fetishes", "description": "Specific kinks and fetishes"},
                    {"id": "media", "name": "Media & Genre", "description": "Content types and genres"},
                    {"id": "body_parts", "name": "Body Parts", "description": "Specific body parts"},
                    {"id": "body_types", "name": "Body Types & Age", "description": "Body types and age demographics"},
                    {"id": "acts", "name": "Acts & Scenarios", "description": "Sexual acts and scenarios"}
                ]
            }
        }
    }
