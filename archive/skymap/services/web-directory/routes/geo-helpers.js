function pointInPolygon(point, polygon) {
  const [x, y] = point;
  let inside = false;
  
  let rings = [];
  if (polygon.type === 'Polygon') {
    rings = polygon.coordinates;
  } else if (polygon.type === 'MultiPolygon') {
    rings = polygon.coordinates.flat();
  } else {
    return false;
  }
  
  const ring = rings[0];
  if (!ring || ring.length < 3) return false;
  
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  
  return inside;
}

function randomPointInPolygon(polygon, bbox) {
  if (!bbox || !polygon) return null;
  
  const south = parseFloat(bbox.bbox_south);
  const north = parseFloat(bbox.bbox_north);
  const west = parseFloat(bbox.bbox_west);
  const east = parseFloat(bbox.bbox_east);
  
  for (let attempts = 0; attempts < 100; attempts++) {
    const lat = south + Math.random() * (north - south);
    const lng = west + Math.random() * (east - west);
    if (pointInPolygon([lng, lat], polygon)) {
      return [lat, lng];
    }
  }
  
  return [(south + north) / 2, (west + east) / 2];
}

function filterNearbyPolygons(geometry, cityLat, cityLng, maxDistanceKm) {
  if (!geometry || geometry.type !== 'MultiPolygon' || geometry.coordinates.length <= 1) return geometry;
  
  const nearbyPolygons = geometry.coordinates.filter(polygon => {
    const ring = polygon[0];
    if (!ring || ring.length === 0) return false;
    let sumLat = 0, sumLng = 0;
    ring.forEach(coord => { sumLng += coord[0]; sumLat += coord[1]; });
    const centroidLat = sumLat / ring.length;
    const centroidLng = sumLng / ring.length;
    const R = 6371;
    const dLat = (centroidLat - cityLat) * Math.PI / 180;
    const dLng = (centroidLng - cityLng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(cityLat * Math.PI / 180) * Math.cos(centroidLat * Math.PI / 180) * Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c <= maxDistanceKm;
  });
  
  if (nearbyPolygons.length === 0) return null;
  return nearbyPolygons.length === 1
    ? { type: 'Polygon', coordinates: nearbyPolygons[0] }
    : { type: 'MultiPolygon', coordinates: nearbyPolygons };
}

function randomizeLocation(row) {
  let lat, lng;
  
  if (row.geometry) {
    try {
      let geometry = typeof row.geometry === 'string' ? JSON.parse(row.geometry) : row.geometry;
      
      if (geometry && geometry.type === 'MultiPolygon' && geometry.coordinates.length > 1) {
        geometry = filterNearbyPolygons(geometry, parseFloat(row.latitude), parseFloat(row.longitude), 10);
        if (!geometry) throw new Error('No nearby polygons');
      }
      
      if (geometry && (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') && row.bbox_south && row.bbox_north && row.bbox_west && row.bbox_east) {
        const point = randomPointInPolygon(geometry, row);
        if (point) {
          return { lat: point[0], lng: point[1] };
        }
      }
      throw new Error('Invalid geometry');
    } catch (error) {
      // Fall through to bounding box
    }
  }
  
  if (row.bbox_south && row.bbox_north && row.bbox_west && row.bbox_east) {
    const centerLat = (parseFloat(row.bbox_south) + parseFloat(row.bbox_north)) / 2;
    const centerLng = (parseFloat(row.bbox_west) + parseFloat(row.bbox_east)) / 2;
    const height = parseFloat(row.bbox_north) - parseFloat(row.bbox_south);
    const width = parseFloat(row.bbox_east) - parseFloat(row.bbox_west);
    const radius = Math.sqrt((height / 2) ** 2 + (width / 2) ** 2) * 0.81;
    
    const angle = Math.random() * 2 * Math.PI;
    const distance = Math.sqrt(Math.random()) * radius;
    lat = centerLat + distance * Math.cos(angle);
    lng = centerLng + distance * Math.sin(angle);
  } else {
    const offset = 0.025;
    lat = parseFloat(row.latitude) + (Math.random() - 0.5) * offset * 2;
    lng = parseFloat(row.longitude) + (Math.random() - 0.5) * offset * 2;
  }
  
  return { lat, lng };
}

module.exports = { pointInPolygon, randomPointInPolygon, filterNearbyPolygons, randomizeLocation };
