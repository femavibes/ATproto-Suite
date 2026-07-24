// Multi-node generator for large regions
function splitCitiesIntoNodes(cities, maxPerNode = 50, minLastNode = 11) {
  const total = cities.length;
  if (total <= maxPerNode + minLastNode - 1) return [cities];
  
  const remainder = total % maxPerNode;
  if (remainder > 0 && remainder < minLastNode) {
    const numNodes = Math.floor(total / maxPerNode);
    const chunks = [];
    for (let i = 0; i < numNodes - 1; i++) {
      chunks.push(cities.slice(i * maxPerNode, (i + 1) * maxPerNode));
    }
    chunks.push(cities.slice((numNodes - 1) * maxPerNode));
    return chunks;
  }
  
  const chunks = [];
  for (let i = 0; i < total; i += maxPerNode) {
    chunks.push(cities.slice(i, i + maxPerNode));
  }
  return chunks;
}

function generateOptimizedCustomNode(region, cities, regionHashtags, partNum = null, totalParts = null) {
  const s = 's', t = 't', c = 'c';
  const stateUrl = `at://did:web:lists.fema.monster/app.bsky.graph.list/${region.key}`;
  
  const stateFilters = [{ list_member: [stateUrl, "in"] }];
  if (regionHashtags.length > 0) {
    stateFilters.push({ and: [{ param_compare: ["$H", "==", true] }, { entity_matches: ["hashtags", regionHashtags] }] });
    stateFilters.push({ and: [{ param_compare: ["$B", "==", true] }, { list_member: [stateUrl, "in"] }, { entity_matches: ["hashtags", regionHashtags] }] });
  }
  
  const cityFilters = cities.map(city => {
    const k = city.name.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 20);
    const u = `at://did:web:lists.fema.monster/app.bsky.graph.list/${city.key}`;
    const h = city.hashtags?.length > 0 && city.hashtags[0] !== null;
    const f = [{ list_member: [u, "in"] }];
    if (h) {
      f.push({ and: [{ param_compare: ["$H", "==", true] }, { entity_matches: ["hashtags", city.hashtags] }] });
      f.push({ and: [{ param_compare: ["$B", "==", true] }, { list_member: [u, "in"] }, { entity_matches: ["hashtags", city.hashtags] }] });
    }
    return { and: [{ or: [{ param_compare: [`$${k}`, "==", true] }, { param_compare: ["$S", "==", true] }] }, { or: f }] };
  });
  
  return {
    order: "new",
    manifest: {
      filter: {
        or: [{ and: [{ param_compare: ["$S", "==", true] }, { or: stateFilters }] }, ...cityFilters],
        metadata: {
          color: "purple",
          customNodeParameters: [
            { name: "H", type: "toggle", exampleValue: false, displayName: "Include hashtags?", description: "Match posts with location hashtags", group: s },
            { name: "B", type: "toggle", exampleValue: false, displayName: "Require both?", description: "Require BOTH list + hashtags", group: s },
            { name: "S", type: "toggle", exampleValue: false, displayName: region.region_name, description: `All ${region.region_name}`, group: t },
            ...cities.map(city => ({ 
              name: city.name.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 20), 
              type: "toggle", 
              exampleValue: false, 
              displayName: city.name, 
              description: "",
              group: c 
            }))
          ],
          customNodeParameterGroups: [{ name: "Settings", id: s }, { name: "State", id: t }, { name: "Cities", id: c }]
        }
      }
    }
  };
}

module.exports = { generateOptimizedCustomNode, splitCitiesIntoNodes };
