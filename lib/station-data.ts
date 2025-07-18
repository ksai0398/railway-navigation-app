// lib/station-data.ts
// Using approximate coordinates for New Delhi Railway Station for demonstration
const STATION_CENTER_LAT = 28.6435
const STATION_CENTER_LNG = 77.2222

// Function to convert relative (x,y) offsets to LatLng
function getLatLngFromOffset(xOffset: number, yOffset: number) {
  // Approximate conversion factors (1 degree lat ~ 111km, 1 degree lng ~ 111km * cos(lat))
  // For small offsets, we can simplify. Let's assume 1 unit in our SVG is roughly 1 meter.
  // 1 meter latitude ~ 1 / 111000 degrees
  // 1 meter longitude ~ 1 / (111000 * Math.cos(STATION_CENTER_LAT * Math.PI) / 180)) degrees
  const latConv = 1 / 111000
  const lngConv = 1 / (111000 * Math.cos((STATION_CENTER_LAT * Math.PI) / 180))

  const lat = STATION_CENTER_LAT + yOffset * latConv * -1 // Y increases downwards in SVG, latitude increases upwards
  const lng = STATION_CENTER_LNG + xOffset * lngConv

  return { lat, lng }
}

export interface StationPoint {
  id: string
  name: string
  type: "gate" | "platform" | "poi" | "path_node"
  x: number // Relative X offset from map origin (0-500)
  y: number // Relative Y offset from map origin (0-350)
  latLng?: { lat: number; lng: number } // Calculated LatLng
  cumulativeDistance?: number // New: Distance from start of path to this point
}

export interface PathInstruction {
  id: string
  text: string
  hindiText: string
  from: string // ID of starting point
  to: string // ID of ending point
  path_nodes?: string[] // IDs of intermediate path nodes to draw the line
  distance?: number // Simulated distance for instruction
  cumulativeDistanceToTarget?: number // New: Distance from start of path to this instruction's 'to' point
}

export interface StationLayout {
  points: StationPoint[]
  paths: { [key: string]: PathInstruction[] } // Key: "gateId-platformId"
}

export interface PNRDetails {
  pnr: string
  trainNumber: string
  platformNumber: string
  coachDetails: string
  destinationPlatformId: string // To link with station layout
}

// Define raw points with relative x,y
const rawStationPoints: Omit<StationPoint, "latLng">[] = [
  { id: "gate-a", name: "Entry Gate A", type: "gate", x: 50, y: 250 },
  { id: "gate-b", name: "Entry Gate B", type: "gate", x: 450, y: 250 },
  { id: "platform-1", name: "Platform 1", type: "platform", x: 250, y: 50 },
  { id: "platform-2", name: "Platform 2", type: "platform", x: 250, y: 100 },
  { id: "platform-3", name: "Platform 3", type: "platform", x: 250, y: 150 },
  { id: "platform-4", name: "Platform 4", type: "platform", x: 250, y: 200 },
  { id: "waiting-hall", name: "Waiting Hall", type: "poi", x: 150, y: 300 },
  { id: "escalator-1", name: "Escalator 1", type: "poi", x: 200, y: 250 },
  { id: "stairs-1", name: "Stairs 1", type: "poi", x: 300, y: 250 },
  // Path nodes for drawing lines - more granular for animation
  { id: "node-ga-1", name: "Node GA-1", type: "path_node", x: 70, y: 250 },
  { id: "node-ga-2", name: "Node GA-2", type: "path_node", x: 100, y: 250 },
  { id: "node-ga-wh-1", name: "Node GA-WH-1", type: "path_node", x: 135, y: 290 }, // Adjusted for more winding path
  { id: "node-wh-e1-1", name: "Node WH-E1-1", type: "path_node", x: 175, y: 275 },
  { id: "node-e1-p1-1", name: "Node E1-P1-1", type: "path_node", x: 190, y: 210 }, // Adjusted for slight curve
  { id: "node-e1-p1-2", name: "Node E1-P1-2", type: "path_node", x: 230, y: 65 }, // Adjusted for slight curve
  { id: "node-e1-p2-1", name: "Node E1-P2-1", type: "path_node", x: 200, y: 175 },
  { id: "node-e1-p2-2", type: "path_node", x: 225, y: 125 },
  { id: "node-wh-s1-1", name: "Node WH-S1-1", type: "path_node", x: 260, y: 290 }, // Adjusted for more winding path
  { id: "node-s1-p3-1", name: "Node S1-P3-1", type: "path_node", x: 310, y: 215 }, // Adjusted for slight curve
  { id: "node-s1-p3-2", type: "path_node", x: 280, y: 165 }, // Adjusted for slight curve
  { id: "node-s1-p4-1", name: "Node S1-P4-1", type: "path_node", x: 300, y: 200 },
  { id: "node-s1-p4-2", type: "path_node", x: 275, y: 225 },
  { id: "node-gb-1", name: "Node GB-1", type: "path_node", x: 430, y: 250 },
  { id: "node-gb-s1-1", name: "Node GB-S1-1", type: "path_node", x: 350, y: 250 },
]

// Calculate LatLng for each point
export const mockStationLayout: StationLayout = {
  points: rawStationPoints.map((point) => ({
    ...point,
    latLng: getLatLngFromOffset(point.x, point.y),
  })),
  paths: {
    "gate-a-platform-1": [
      {
        id: "inst1",
        text: "Walk straight from Entry Gate A for 20 meters.",
        hindiText: "प्रवेश द्वार ए से 20 मीटर सीधा चलें।",
        from: "gate-a",
        to: "node-ga-2",
        path_nodes: ["node-ga-1"],
        distance: 20,
      },
      {
        id: "inst2",
        text: "Turn right towards Waiting Hall.",
        hindiText: "प्रतीक्षा कक्ष की ओर दाहिने मुड़ें।",
        from: "node-ga-2",
        to: "waiting-hall",
        path_nodes: ["node-ga-wh-1"],
        distance: 30,
      },
      {
        id: "inst3",
        text: "Walk straight towards Escalator 1.",
        hindiText: "एस्केलेटर 1 की ओर सीधा चलें।",
        from: "waiting-hall",
        to: "escalator-1",
        path_nodes: ["node-wh-e1-1"],
        distance: 40,
      },
      {
        id: "inst4",
        text: "Use Escalator 1 to reach Platform 1.",
        hindiText: "प्लेटफॉर्म 1 तक पहुंचने के लिए एस्केलेटर 1 का उपयोग करें।",
        from: "escalator-1",
        to: "platform-1",
        path_nodes: ["node-e1-p1-1", "node-e1-p1-2"],
        distance: 50,
      },
    ],
    "gate-a-platform-2": [
      {
        id: "inst1",
        text: "Walk straight from Entry Gate A for 20 meters.",
        hindiText: "प्रवेश द्वार ए से 20 मीटर सीधा चलें।",
        from: "gate-a",
        to: "node-ga-2",
        path_nodes: ["node-ga-1"],
        distance: 20,
      },
      {
        id: "inst2",
        text: "Turn right towards Waiting Hall.",
        hindiText: "प्रतीक्षा कक्ष की ओर दाहिने मुड़ें।",
        from: "node-ga-2",
        to: "waiting-hall",
        path_nodes: ["node-ga-wh-1"],
        distance: 30,
      },
      {
        id: "inst3",
        text: "Walk straight towards Escalator 1.",
        hindiText: "एस्केलेटर 1 की ओर सीधा चलें।",
        from: "waiting-hall",
        to: "escalator-1",
        path_nodes: ["node-wh-e1-1"],
        distance: 40,
      },
      {
        id: "inst4",
        text: "Use Escalator 1 to reach Platform 2.",
        hindiText: "प्लेटफॉर्म 2 तक पहुंचने के लिए एस्केलेटर 1 का उपयोग करें।",
        from: "escalator-1",
        to: "platform-2",
        path_nodes: ["node-e1-p2-1", "node-e1-p2-2"],
        distance: 50,
      },
    ],
    "gate-a-platform-3": [
      {
        id: "inst1",
        text: "Walk straight from Entry Gate A for 20 meters.",
        hindiText: "प्रवेश द्वार ए से 20 मीटर सीधा चलें।",
        from: "gate-a",
        to: "node-ga-2",
        path_nodes: ["node-ga-1"],
        distance: 20,
      },
      {
        id: "inst2",
        text: "Turn right towards Waiting Hall.",
        hindiText: "प्रतीक्षा कक्ष की ओर दाहिने मुड़ें।",
        from: "node-ga-2",
        to: "waiting-hall",
        path_nodes: ["node-ga-wh-1"],
        distance: 30,
      },
      {
        id: "inst3",
        text: "Walk past Escalator 1 and turn right towards Stairs 1.",
        hindiText: "एस्केलेटर 1 से आगे बढ़ें और सीढ़ियों 1 की ओर दाहिने मुड़ें।",
        from: "waiting-hall",
        to: "stairs-1",
        path_nodes: ["node-wh-s1-1"],
        distance: 40,
      },
      {
        id: "inst4",
        text: "Use Stairs 1 to reach Platform 3.",
        hindiText: "प्लेटफॉर्म 3 तक पहुंचने के लिए सीढ़ियों 1 का उपयोग करें।",
        from: "stairs-1",
        to: "platform-3",
        path_nodes: ["node-s1-p3-1", "node-s1-p3-2"],
        distance: 50,
      },
    ],
    "gate-a-platform-4": [
      {
        id: "inst1",
        text: "Walk straight from Entry Gate A for 20 meters.",
        hindiText: "प्रवेश द्वार ए से 20 मीटर सीधा चलें।",
        from: "gate-a",
        to: "node-ga-2",
        path_nodes: ["node-ga-1"],
        distance: 20,
      },
      {
        id: "inst2",
        text: "Turn right towards Waiting Hall.",
        hindiText: "प्रतीक्षा कक्ष की ओर दाहिने मुड़ें।",
        from: "node-ga-2",
        to: "waiting-hall",
        path_nodes: ["node-ga-wh-1"],
        distance: 30,
      },
      {
        id: "inst3",
        text: "Walk past Escalator 1 and turn right towards Stairs 1.",
        hindiText: "एस्केलेटर 1 से आगे बढ़ें और सीढ़ियों 1 की ओर दाहिने मुड़ें।",
        from: "waiting-hall",
        to: "stairs-1",
        path_nodes: ["node-wh-s1-1"],
        distance: 40,
      },
      {
        id: "inst4",
        text: "Use Stairs 1 to reach Platform 4.",
        hindiText: "प्लेटफॉर्म 4 तक पहुंचने के लिए सीढ़ियों 1 का उपयोग करें।",
        from: "stairs-1",
        to: "platform-4",
        path_nodes: ["node-s1-p4-1", "node-s1-p4-2"],
        distance: 50,
      },
    ],
    "gate-b-platform-1": [
      {
        id: "inst1",
        text: "Walk straight from Entry Gate B for 20 meters.",
        hindiText: "प्रवेश द्वार बी से 20 मीटर सीधा चलें।",
        from: "gate-b",
        to: "node-gb-s1-1",
        path_nodes: ["node-gb-1"],
        distance: 20,
      },
      {
        id: "inst2",
        text: "Turn left towards Stairs 1.",
        hindiText: "सीढ़ियों 1 की ओर बाएं मुड़ें।",
        from: "node-gb-s1-1",
        to: "stairs-1",
        distance: 30,
      },
      {
        id: "inst3",
        text: "Walk past Stairs 1 and turn left towards Escalator 1.",
        hindiText: "सीढ़ियों 1 से आगे बढ़ें और एस्केलेटर 1 की ओर बाएं मुड़ें।",
        from: "stairs-1",
        to: "escalator-1",
        path_nodes: ["node-wh-e1-1"],
        distance: 40,
      },
      {
        id: "inst4",
        text: "Use Escalator 1 to reach Platform 1.",
        hindiText: "प्लेटफॉर्म 1 तक पहुंचने के लिए एस्केलेटर 1 का उपयोग करें।",
        from: "escalator-1",
        to: "platform-1",
        path_nodes: ["node-e1-p1-1", "node-e1-p1-2"],
        distance: 50,
      },
    ],
    "gate-b-platform-2": [
      {
        id: "inst1",
        text: "Walk straight from Entry Gate B for 20 meters.",
        hindiText: "प्रवेश द्वार बी से 20 मीटर सीधा चलें।",
        from: "gate-b",
        to: "node-gb-s1-1",
        path_nodes: ["node-gb-1"],
        distance: 20,
      },
      {
        id: "inst2",
        text: "Turn left towards Stairs 1.",
        hindiText: "सीढ़ियों 1 की ओर बाएं मुड़ें।",
        from: "node-gb-s1-1",
        to: "stairs-1",
        distance: 30,
      },
      {
        id: "inst3",
        text: "Walk past Stairs 1 and turn left towards Escalator 1.",
        hindiText: "सीढ़ियों 1 से आगे बढ़ें और एस्केलेटर 1 की ओर बाएं मुड़ें।",
        from: "stairs-1",
        to: "escalator-1",
        path_nodes: ["node-wh-e1-1"],
        distance: 40,
      },
      {
        id: "inst4",
        text: "Use Escalator 1 to reach Platform 2.",
        hindiText: "प्लेटफॉर्म 2 तक पहुंचने के लिए एस्केलेटर 1 का उपयोग करें।",
        from: "escalator-1",
        to: "platform-2",
        path_nodes: ["node-e1-p2-1", "node-e1-p2-2"],
        distance: 50,
      },
    ],
    "gate-b-platform-3": [
      {
        id: "inst1",
        text: "Walk straight from Entry Gate B for 20 meters.",
        hindiText: "प्रवेश द्वार बी से 20 मीटर सीधा चलें।",
        from: "gate-b",
        to: "node-gb-s1-1",
        path_nodes: ["node-gb-1"],
        distance: 20,
      },
      {
        id: "inst2",
        text: "Turn left towards Stairs 1.",
        hindiText: "सीढ़ियों 1 की ओर बाएं मुड़ें।",
        from: "node-gb-s1-1",
        to: "stairs-1",
        distance: 30,
      },
      {
        id: "inst3",
        text: "Use Stairs 1 to reach Platform 3.",
        hindiText: "प्लेटफॉर्म 3 तक पहुंचने के लिए सीढ़ियों 1 का उपयोग करें।",
        from: "stairs-1",
        to: "platform-3",
        path_nodes: ["node-s1-p3-1", "node-s1-p3-2"],
        distance: 50,
      },
    ],
    "gate-b-platform-4": [
      {
        id: "inst1",
        text: "Walk straight from Entry Gate B for 20 meters.",
        hindiText: "प्रवेश द्वार बी से 20 मीटर सीधा चलें।",
        from: "gate-b",
        to: "node-gb-s1-1",
        path_nodes: ["node-gb-1"],
        distance: 20,
      },
      {
        id: "inst2",
        text: "Turn left towards Stairs 1.",
        hindiText: "सीढ़ियों 1 की ओर बाएं मुड़ें।",
        from: "node-gb-s1-1",
        to: "stairs-1",
        distance: 30,
      },
      {
        id: "inst3",
        text: "Use Stairs 1 to reach Platform 4.",
        hindiText: "प्लेटफॉर्म 4 तक पहुंचने के लिए सीढ़ियों 1 का उपयोग करें।",
        from: "stairs-1",
        to: "platform-4",
        path_nodes: ["node-s1-p4-1", "node-s1-p4-2"],
        distance: 50,
      },
    ],
  },
}

export const mockPNRData: PNRDetails[] = [
  {
    pnr: "1234567890",
    trainNumber: "12001",
    platformNumber: "1",
    coachDetails: "S1, Seat 45",
    destinationPlatformId: "platform-1",
  },
  {
    pnr: "0987654321",
    trainNumber: "12002",
    platformNumber: "3",
    coachDetails: "A2, Seat 12",
    destinationPlatformId: "platform-3",
  },
  {
    pnr: "1122334455",
    trainNumber: "12003",
    platformNumber: "2",
    coachDetails: "B5, Seat 23",
    destinationPlatformId: "platform-2",
  },
  {
    pnr: "5544332211",
    trainNumber: "12004",
    platformNumber: "4",
    coachDetails: "C1, Seat 05",
    destinationPlatformId: "platform-4",
  },
]

export function getPNRDetails(pnr: string): PNRDetails | undefined {
  return mockPNRData.find((data) => data.pnr === pnr)
}
