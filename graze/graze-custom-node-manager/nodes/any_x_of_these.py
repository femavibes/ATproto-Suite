"""
Any X of These - Require multiple term matches with configurable threshold
"""

metadata = {
    "id": "any_x_of_these",
    "name": "Any X of These",
    "description": "Require a minimum number of different terms to match. Useful for reducing false positives by requiring multiple related terms to appear together.",
    "color": "blue",
    "version": "2.0.0",
    "author": "Custom Nodes System",
    "tags": ["threshold", "multiple", "terms", "advanced"],
    "configurable": {
        "num_terms": {
            "type": "number",
            "default": 15,
            "min": 5,
            "max": 30,
            "description": "Number of term input fields to generate"
        }
    }
}

def get_manifest(options=None):
    """Generate the filter manifest"""
    
    # Get number of terms from options or use default
    NUM_TERMS = 15
    if options and 'num_terms' in options:
        NUM_TERMS = int(options['num_terms'])
    
    # Fun example terms for first 10
    example_terms = [
        "fema",
        "electroencephalographically",
        "psychoneuroimmunology",
        "counterrevolutionaries",
        "deinstitutionalization",
        "otorhinolaryngological",
        "pseudohermaphroditism",
        "radioimmunoelectrophoresis",
        "hydrochlorofluorocarbon",
        "incomprehensibilities"
    ]
    
    # Generate term parameter references for regex
    term_refs = "|".join([f"$TERM{i}" for i in range(1, NUM_TERMS + 1)])
    regex_pattern = f"(?=(?:.*\\b({term_refs})\\b){{$THRESHOLD,}}).*"
    
    # Search locations
    search_fields = [
        "text",
        "embed",
        "embed.external.uri",
        "embed.external.title",
        "embed.external.description",
        "embed.media.external.uri",
        "embed.media.external.title",
        "embed.media.external.description",
        "embed.alt",
        "embed.media[*].alt",
        "embed.images[*].alt",
        "embed.media.images[*].alt"
    ]
    
    # Generate search filters
    search_filters = []
    for field in search_fields:
        search_filters.append({
            "regex_matches": [field, regex_pattern, True]
        })
    
    # Generate term parameters
    term_params = []
    for i in range(1, NUM_TERMS + 1):
        # Use fun example for first 10, empty for rest
        example_value = example_terms[i-1] if i <= len(example_terms) else ""
        term_params.append({
            "name": f"TERM{i}",
            "description": f"Search term {i}. Leave blank if not needed.",
            "displayName": f"Term {i}",
            "exampleValue": example_value
        })
    
    return {
        "filter": {
            "or": search_filters,
            "metadata": {
                "color": "blue",
                "customNodeParameters": [
                    {
                        "name": "THRESHOLD",
                        "type": "number",
                        "description": "Minimum number of term matches required. Note: If the same term appears multiple times in a post, each occurrence counts toward the threshold. This is a regex engine limitation.",
                        "displayName": "Match Threshold",
                        "exampleValue": 3
                    }
                ] + term_params
            }
        }
    }
