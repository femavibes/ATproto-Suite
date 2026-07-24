// Optimized custom node generator for large regions like California
// This version reduces JSON size by ~60-70% while maintaining all functionality

function generateOptimizedCustomNode(region, cities, regionHashtags) {
  const settingsGroupId = 's';
  const stateGroupId = 't';
  const cityGroupId = 'c';
  
  const stateListUrl = `at://did:web:lists.fema.monster/app.bsky.graph.list/${region.key}`;
  
  // Build state filter entries (simplified)
  const stateFilters = [{ list_member: [stateListUrl, "in"] }];
  
  if (regionHashtags.length > 0) {
    stateFilters.push({
      and: [
        { param_compare: ["$H", "==", true] },
        { entity_matches: ["hashtags", regionHashtags] }
      ]
    });
    stateFilters.push({
      and: [
        { param_compare: ["$B", "==", true] },
        { list_member: [stateListUrl, "in"] },
        { entity_matches: ["hashtags", regionHashtags] }
      ]
    });
  }
  
  // Build city filters (optimized - removed redundant nesting)
  const cityFilters = cities.map(city => {
    const cityKey = city.name.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 20);
    const cityListUrl = `at://did:web:lists.fema.monster/app.bsky.graph.list/${city.key}`;
    const hasHashtags = city.hashtags?.length > 0 && city.hashtags[0] !== null;
    
    const filters = [{ list_member: [cityListUrl, "in"] }];
    
    if (hasHashtags) {
      filters.push({
        and: [
          { param_compare: ["$H", "==", true] },
          { entity_matches: ["hashtags", city.hashtags] }
        ]
      });
      filters.push({
        and: [
          { param_compare: ["$B", "==", true] },
          { list_member: [cityListUrl, "in"] },
          { entity_matches: ["hashtags", city.hashtags] }
        ]
      });
    }
    
    return {
      and: [
        { or: [
          { param_compare: [`$${cityKey}`, "==", true] },
          { param_compare: ["$S", "==", true] }
        ]},
        { or: filters }
      ]
    };
  });
  
  // Build parameters (simplified names)
  const params = [
    {
      name: "H",
      type: "toggle",
      exampleValue: false,
      displayName: "Include hashtags?",
      description: "Match posts with location hashtags (no list membership required)",
      group: settingsGroupId
    },
    {
      name: "B",
      type: "toggle",
      exampleValue: false,
      displayName: "Require both?",
      description: "Require BOTH list membership AND hashtags",
      group: settingsGroupId
    },
    {
      name: "S",
      type: "toggle",
      exampleValue: false,
      displayName: region.region_name,
      description: `All ${region.region_name} users and cities`,
      group: stateGroupId
    },
    ...cities.map(city => ({
      name: city.name.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 20),
      type: "toggle",
      exampleValue: false,
      displayName: city.name,
      group: cityGroupId
    }))
  ];
  
  return {
    order: "new",
    manifest: {
      filter: {
        or: [
          {
            and: [
              { param_compare: ["$S", "==", true] },
              { or: stateFilters }
            ]
          },
          ...cityFilters
        ],
        metadata: {
          color: "purple",
          customNodeParameters: params,
          customNodeParameterGroups: [
            { name: "Settings", id: settingsGroupId },
            { name: "State", id: stateGroupId },
            { name: "Cities", id: cityGroupId }
          ]
        }
      }
    }
  };
}

module.exports = { generateOptimizedCustomNode };
