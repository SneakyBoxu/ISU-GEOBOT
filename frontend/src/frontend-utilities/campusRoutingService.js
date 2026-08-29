/**
 * Campus Routing & Navigation Service for ISU-GeoBot.
 *
 * Uses the high-density OpenStreetMap vector road network (1,735 road nodes and
 * 1,871 road segments) covering every paved street, boulevard, walkway, and highway
 * corridor on the ISU Echague Main Campus.
 *
 * Calculates optimal paths with Dijkstra/A* so lines follow actual roads and curves.
 */

import roadGraphData from './campusRoadGraph.json';

export const CAMPUS_PRESET_GATES = [
  {
    id: 'gate-main',
    name: 'Main Campus Gate (National Highway)',
    lat: 16.72165,
    lng: 121.68551,
    type: 'gate',
    description: 'Primary entrance on the Pan-Philippine Highway (AH26)',
  },
  {
    id: 'gate-north',
    name: 'North Gate (De Venecia & Agriculture)',
    lat: 16.72533,
    lng: 121.69192,
    type: 'gate',
    description: 'Access to northern agriculture and research fields',
  },
  {
    id: 'oval-grandstand',
    name: 'University Oval & Grandstand',
    lat: 16.71765,
    lng: 121.68740,
    type: 'landmark',
    description: 'Central campus athletic grounds and grandstand',
  },
  {
    id: 'student-plaza',
    name: 'Student Plaza & Quad',
    lat: 16.72010,
    lng: 121.68960,
    type: 'facility',
    description: 'Central walkway hub between colleges',
  },
];

// Pre-build adjacency graph in memory
const roadPoints = roadGraphData.points;
const roadAdj = Array.from({ length: roadPoints.length }, () => []);

for (const [u, v, d, name] of roadGraphData.edges) {
  roadAdj[u].push({ to: v, weight: d, name });
  roadAdj[v].push({ to: u, weight: d, name });
}

/**
 * Calculates great-circle distance between two coordinates in meters.
 */
export function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2)
          + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Formats distance into a clean string (meters or kilometers).
 */
export function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Formats duration in seconds to a human-readable walking estimate.
 * Average walking speed on campus is ~1.33 m/s (~80 meters/minute).
 */
export function formatDuration(seconds) {
  const mins = Math.max(1, Math.round(seconds / 60));
  if (mins < 60) return `~${mins} min walk`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `~${hrs} hr ${remMins} min`;
}

/**
 * Gets user's current GPS position via browser Geolocation API.
 */
export async function getBrowserLocation() {
  if (!navigator.geolocation) {
    throw new Error('Geolocation is not supported by your browser.');
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          name: 'My Current Location',
          isGps: true,
        });
      },
      (err) => {
        let msg = 'Could not access your location.';
        if (err.code === 1) msg = 'Location permission was denied. Please allow location access or choose a campus gate.';
        else if (err.code === 2) msg = 'Location position unavailable. Please choose a starting gate.';
        else if (err.code === 3) msg = 'Location request timed out. Please try again.';
        const error = new Error(msg);
        error.code = err.code;
        reject(error);
      },
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 10000 },
    );
  });
}

/**
 * Finds the closest point on the road network to any coordinate.
 */
function findNearestRoadPoint(lat, lng) {
  let best = 0;
  let minDist = Infinity;
  for (let i = 0; i < roadPoints.length; i += 1) {
    const d = calculateDistanceMeters(lat, lng, roadPoints[i][0], roadPoints[i][1]);
    if (d < minDist) {
      minDist = d;
      best = i;
    }
  }
  return { id: best, dist: minDist, point: roadPoints[best] };
}

/**
 * Runs Dijkstra's algorithm over the high-density OpenStreetMap campus road graph.
 */
function computeRoadShortestPath(startId, endId) {
  const numNodes = roadPoints.length;
  const dist = new Float64Array(numNodes).fill(Infinity);
  const prev = new Int32Array(numNodes).fill(-1);
  const prevStreet = new Array(numNodes).fill('');
  const visited = new Uint8Array(numNodes);

  dist[startId] = 0;

  // Simple priority queue (min-heap or sorted array for ~1.7k nodes runs in <2ms)
  const pq = [{ id: startId, d: 0 }];

  while (pq.length > 0) {
    pq.sort((a, b) => a.d - b.d);
    const { id: u, d } = pq.shift();

    if (u === endId) break;
    if (visited[u] || d > dist[u]) continue;
    visited[u] = 1;

    for (const edge of roadAdj[u]) {
      const v = edge.to;
      const alt = dist[u] + edge.weight;
      if (alt < dist[v]) {
        dist[v] = alt;
        prev[v] = u;
        prevStreet[v] = edge.name;
        pq.push({ id: v, d: alt });
      }
    }
  }

  const path = [];
  const streets = [];
  let curr = endId;

  while (curr !== -1) {
    path.unshift(roadPoints[curr]);
    if (prevStreet[curr]) streets.unshift(prevStreet[curr]);
    curr = prev[curr];
  }

  return { path, streets, totalRoadDist: dist[endId] };
}

/**
 * Fetches walking route strictly adhering to actual road geometries and curves.
 */
export async function fetchWalkingRoute(origin, dest) {
  if (!origin?.lat || !origin?.lng || !dest?.lat || !dest?.lng) {
    throw new Error('Origin and destination coordinates are required.');
  }

  const startMatch = findNearestRoadPoint(origin.lat, origin.lng);
  const endMatch = findNearestRoadPoint(dest.lat, dest.lng);

  const { path: roadPath, streets, totalRoadDist } = computeRoadShortestPath(startMatch.id, endMatch.id);

  // Build the complete smooth route geometry
  const coordinates = [];

  // Start from origin
  coordinates.push([origin.lat, origin.lng]);

  // Insert all real road waypoints along the curves
  for (const pt of roadPath) {
    const last = coordinates[coordinates.length - 1];
    if (!last || Math.abs(last[0] - pt[0]) > 0.000005 || Math.abs(last[1] - pt[1]) > 0.000005) {
      coordinates.push([pt[0], pt[1]]);
    }
  }

  // End at destination
  coordinates.push([dest.lat, dest.lng]);

  // Compute total travel distance along every polyline segment
  let totalDistanceMeters = 0;
  for (let i = 0; i < coordinates.length - 1; i += 1) {
    totalDistanceMeters += calculateDistanceMeters(
      coordinates[i][0], coordinates[i][1],
      coordinates[i + 1][0], coordinates[i + 1][1],
    );
  }

  // Generate step-by-step guidance
  const steps = [];
  steps.push({
    instruction: `Depart from ${origin.name || 'Starting Point'}`,
    distance: Math.round(startMatch.dist),
    type: 'depart',
  });

  // Group steps by road name for clean directions
  let curStreet = null;
  let curDist = 0;

  for (let i = 0; i < streets.length; i += 1) {
    const st = streets[i] || 'Campus Walkway';
    const segDist = calculateDistanceMeters(roadPath[i][0], roadPath[i][1], roadPath[i + 1][0], roadPath[i + 1][1]);

    if (st === curStreet) {
      curDist += segDist;
    } else {
      if (curStreet && curDist > 10) {
        steps.push({
          instruction: `Follow ${curStreet} (${formatDistance(curDist)})`,
          distance: curDist,
          type: 'continue',
        });
      }
      curStreet = st;
      curDist = segDist;
    }
  }
  if (curStreet && curDist > 10) {
    steps.push({
      instruction: `Follow ${curStreet} (${formatDistance(curDist)})`,
      distance: curDist,
      type: 'continue',
    });
  }

  steps.push({
    instruction: `Arrive at ${dest.name || 'Destination'} entrance`,
    distance: Math.round(endMatch.dist),
    type: 'arrive',
  });

  const durationSeconds = Math.round(totalDistanceMeters / 1.33);

  return {
    coordinates,
    distanceMeters: Math.round(totalDistanceMeters),
    durationSeconds,
    steps,
    isFallback: false,
    roadNetwork: true,
  };
}
