"""
Time Master - Filter posts by date and time ranges
"""

metadata = {
    "id": "time_master",
    "name": "Time Master",
    "description": "Filter posts by year, month, day, and time. Perfect for seasonal content or time-based filtering.",
    "color": "blue",
    "version": "1.0.0",
    "author": "Custom Nodes System",
    "tags": ["time", "date", "filter"],
    "configurable": {}
}

def get_manifest(options=None):
    """Generate time-based filter manifest"""
    
    # Year checks
    year_checks = []
    for year in range(2020, 2031):
        year_checks.append({
            "or": [
                {"param_compare": [f"$YEAR_{year}", "==", False]},
                {"regex_matches": ["createdAt", f"{year}-\\d{{2}}-\\d{{2}}T\\d{{2}}:\\d{{2}}:\\d{{2}}", True]}
            ]
        })
    
    # Month checks
    month_checks = []
    for i in range(1, 13):
        month_checks.append({
            "or": [
                {"param_compare": [f"$MONTH_{i:02d}", "==", False]},
                {"regex_matches": ["createdAt", f"\\d{{4}}-{i:02d}-\\d{{2}}T\\d{{2}}:\\d{{2}}:\\d{{2}}", True]}
            ]
        })
    
    # Hour checks
    hour_checks = []
    for hour in range(24):
        hour_checks.append({
            "or": [
                {"param_compare": [f"$HOUR_{hour:02d}", "==", False]},
                {"regex_matches": ["createdAt", f"\\d{{4}}-\\d{{2}}-\\d{{2}}T{hour:02d}:\\d{{2}}:\\d{{2}}", True]}
            ]
        })
    
    # Build parameters
    params = []
    
    # Year toggles
    for year in range(2020, 2031):
        params.append({
            "name": f"YEAR_{year}",
            "type": "toggle",
            "displayName": str(year),
            "description": f"Include posts from {year}",
            "exampleValue": False,
            "group": "years"
        })
    
    # Month toggles
    month_names = ["January", "February", "March", "April", "May", "June", 
                   "July", "August", "September", "October", "November", "December"]
    for i, name in enumerate(month_names, 1):
        params.append({
            "name": f"MONTH_{i:02d}",
            "type": "toggle",
            "displayName": name,
            "description": f"Include {name}",
            "exampleValue": False,
            "group": "months"
        })
    
    # Hour toggles
    for hour in range(24):
        if hour == 0:
            label = "12am (Midnight)"
        elif hour < 12:
            label = f"{hour}am"
        elif hour == 12:
            label = "12pm (Noon)"
        else:
            label = f"{hour-12}pm"
        
        params.append({
            "name": f"HOUR_{hour:02d}",
            "type": "toggle",
            "displayName": label,
            "description": f"Include hour {hour:02d}:00-{hour:02d}:59",
            "exampleValue": False,
            "group": "hours"
        })
    
    return {
        "filter": {
            "and": [
                {"and": year_checks},
                {"and": month_checks},
                {"and": hour_checks}
            ],
            "metadata": {
                "color": "blue",
                "customNodeParameters": params,
                "customNodeParameterGroups": [
                    {
                        "id": "years",
                        "name": "Years",
                        "description": "Select which years to include"
                    },
                    {
                        "id": "months",
                        "name": "Months",
                        "description": "Select which months to include"
                    },
                    {
                        "id": "hours",
                        "name": "Hours",
                        "description": "Select which hours of the day to include"
                    }
                ]
            }
        }
    }
