"use client"
import type { StationLayout, StationPoint } from "@/lib/station-data"
import { StepBackIcon as Stairs, CableCarIcon as Escalator, DoorOpen, TrainFront, LocateFixed } from "lucide-react"
import { useEffect, useRef } from "react"

interface StationMapProps {
  layout: StationLayout
  selectedEntryGateId: string | null
  destinationPlatformId: string | null
  onSelectEntryGate: (gateId: string) => void
  pathPoints: StationPoint[] // Path points for drawing and animation
  userPosition: { x: number; y: number } | null // Simulated user position
}

export default function StationMap({
  layout,
  selectedEntryGateId,
  destinationPlatformId,
  onSelectEntryGate,
  pathPoints,
  userPosition,
}: StationMapProps) {
  const stationWidth = 500
  const stationHeight = 350
  const padding = 20 // Padding around the SVG content

  const pathRef = useRef<SVGPolylineElement>(null)

  // Update path animation offset
  useEffect(() => {
    if (pathRef.current && pathPoints.length > 0) {
      const pathLength = pathRef.current.getTotalLength()
      // This is a simple way to "reset" the animation.
      // For continuous animation, you'd update strokeDashoffset based on userPosition progress.
      pathRef.current.style.strokeDasharray = `${pathLength} ${pathLength}`
      pathRef.current.style.strokeDashoffset = `${pathLength}`
    }
  }, [pathPoints])

  const pathData = pathPoints.map((p) => `${p.x + padding},${p.y + padding}`).join(" ")

  return (
    <div className="relative w-full max-w-xl mx-auto bg-white rounded-lg shadow-md p-4">
      <h3 className="text-lg font-semibold mb-2">Station Layout Map</h3>
      <svg
        width={stationWidth + padding * 2}
        height={stationHeight + padding * 2}
        viewBox={`0 0 ${stationWidth + padding * 2} ${stationHeight + padding * 2}`}
        className="border rounded-md bg-blue-50 relative overflow-hidden"
        role="img"
        aria-label="Railway Station Layout Map"
      >
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#cceeff" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="url(#grid)" />
        {/* Station outline */}
        <rect
          x={padding}
          y={padding}
          width={stationWidth}
          height={stationHeight}
          fill="none"
          stroke="#66aaff"
          strokeWidth="2"
        />

        {/* Platforms */}
        {layout.points
          .filter((p) => p.type === "platform")
          .map((platform) => (
            <g key={platform.id} aria-label={`Platform ${platform.name}`}>
              <rect
                x={platform.x - 50 + padding}
                y={platform.y - 10 + padding}
                width="100"
                height="20"
                fill={destinationPlatformId === platform.id ? "hsl(var(--primary))" : "#aaddff"}
                stroke="#66aaff"
                strokeWidth="1"
                rx="3"
                ry="3"
              />
              <text
                x={platform.x + padding}
                y={platform.y + 5 + padding}
                fontSize="10"
                textAnchor="middle"
                fill={destinationPlatformId === platform.id ? "white" : "#333"}
                fontWeight="bold"
              >
                {platform.name}
              </text>
              <foreignObject x={platform.x - 45 + padding} y={platform.y - 7 + padding} width="16" height="16">
                <TrainFront className="text-gray-700" style={{ width: "100%", height: "100%" }} />
              </foreignObject>
            </g>
          ))}

        {/* Gates */}
        {layout.points
          .filter((p) => p.type === "gate")
          .map((gate) => (
            <g
              key={gate.id}
              className="cursor-pointer"
              onClick={() => onSelectEntryGate(gate.id)}
              aria-label={`Entry Gate ${gate.name}`}
            >
              <rect
                x={gate.x - 15 + padding}
                y={gate.y - 15 + padding}
                width="30"
                height="30"
                fill={selectedEntryGateId === gate.id ? "hsl(var(--primary))" : "#ccffcc"}
                stroke="#33aa33"
                strokeWidth="1"
                rx="5"
                ry="5"
              />
              <text
                x={gate.x + padding}
                y={gate.y - 20 + padding}
                fontSize="10"
                textAnchor="middle"
                fill="#333"
                fontWeight="bold"
              >
                {gate.name}
              </text>
              <foreignObject x={gate.x - 8 + padding} y={gate.y - 8 + padding} width="16" height="16">
                <DoorOpen className="text-gray-700" style={{ width: "100%", height: "100%" }} />
              </foreignObject>
            </g>
          ))}

        {/* POIs */}
        {layout.points
          .filter((p) => p.type === "poi")
          .map((poi) => (
            <g key={poi.id} aria-label={`Point of Interest: ${poi.name}`}>
              <rect
                x={poi.x - 30 + padding}
                y={poi.y - 10 + padding}
                width="60"
                height="20"
                fill="#ffddaa"
                stroke="#ff9933"
                strokeWidth="1"
                rx="3"
                ry="3"
              />
              <text x={poi.x + padding} y={poi.y + 5 + padding} fontSize="8" textAnchor="middle" fill="#333">
                {poi.name}
              </text>
              {poi.id === "escalator-1" && (
                <foreignObject x={poi.x - 25 + padding} y={poi.y - 7 + padding} width="16" height="16">
                  <Escalator className="text-gray-700" style={{ width: "100%", height: "100%" }} />
                </foreignObject>
              )}
              {poi.id === "stairs-1" && (
                <foreignObject x={poi.x - 25 + padding} y={poi.y - 7 + padding} width="16" height="16">
                  <Stairs className="text-gray-700" style={{ width: "100%", height: "100%" }} />
                </foreignObject>
              )}
            </g>
          ))}

        {/* Path nodes (hidden, just for drawing lines) */}
        {layout.points
          .filter((p) => p.type === "path_node")
          .map((node) => (
            <circle key={node.id} cx={node.x + padding} cy={node.y + padding} r="2" fill="transparent" />
          ))}

        {/* Path */}
        {pathData && (
          <polyline
            ref={pathRef}
            points={pathData}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="3"
            strokeDasharray="0" // Initial state for animation
            strokeDashoffset="0" // Initial state for animation
            markerEnd="url(#arrowhead)"
            className="transition-all duration-1000 ease-linear" // For smooth animation
          />
        )}

        {/* User Position */}
        {userPosition && (
          <g aria-label="Your current position">
            <circle
              cx={userPosition.x + padding}
              cy={userPosition.y + padding}
              r="8"
              fill="hsl(var(--destructive))"
              stroke="white"
              strokeWidth="2"
            />
            <foreignObject x={userPosition.x - 8 + padding} y={userPosition.y - 8 + padding} width="16" height="16">
              <LocateFixed className="text-white" style={{ width: "100%", height: "100%" }} />
            </foreignObject>
          </g>
        )}

        {/* Arrowhead for path */}
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--primary))" />
          </marker>
        </defs>
      </svg>
    </div>
  )
}
