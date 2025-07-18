"use client"

import { useEffect, useRef } from "react"
import mapboxgl from "mapbox-gl"
import type { StationLayout, StationPoint, PathInstruction } from "@/lib/station-data"

interface MapboxStationMapProps {
  layout: StationLayout
  selectedEntryGateId: string | null
  destinationPlatformId: string | null
  onSelectEntryGate: (gateId: string) => void
  pathPoints: StationPoint[]
  userPosition: { lat: number; lng: number } | null
  userBearing: number | null // New prop for user direction
  currentInstructionIndex: number // New prop for current instruction
  pathInstructions: PathInstruction[] // New prop for all instructions
}

mapboxgl.accessToken = "pk.eyJ1Ijoia3Jpc2huYTAzOTgiLCJhIjoiY21kNnZhY3NqMGI5MjJtc2N2OHZxOW5pYSJ9.8LMXs7ubdSo5BQj7ajOSWA"

const ICON_SVG_PATHS: { [key: string]: string } = {
  DoorOpen: `<path d="M12 22h6a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h2" /><path d="M14 12h.01" />`,
  TrainFront: `<path d="M17 6H7c-2.8 0-5 2.2-5 5v3c0 2.8 2.2 5 5 5h10c2.8 0 5-2.2 5-5v-3c0-2.8-2.2-5-5-5Z"/><path d="m17 19-2.5-1.5"/><path d="m7 19 2.5-1.5"/><path d="M2 11h20"/><path d="M12 6V3"/><path d="M12 19v3"/>`,
  Escalator: `<path d="M10 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4"/><path d="M14 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M8 12h8"/><path d="M12 21V3"/><path d="M12 7h.01"/><path d="M12 17h.01"/>`,
  Stairs: `<path d="M18 15V9"/><path d="M12 15V9"/><path d="M6 15V9"/><path d="m18 2-4 4 4 4"/><path d="m6 2-4 4 4 4"/>`,
  LocateFixed: `<path d="M2 12h20"/><path d="M12 2v20"/><circle cx="12" cy="12" r="4"/>`,
}

const createHtmlMarker = (iconName: string, color: string, labelText: string, isSelected: boolean) => {
  const el = document.createElement("div")
  el.className = "mapbox-custom-marker"
  el.style.cssText = `
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 5px;
  border-radius: 8px;
  background-color: ${isSelected ? "hsl(var(--primary))" : "white"};
  border: 1px solid ${color};
  box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  min-width: 60px;
  text-align: center;
  transform: translate(-50%, -100%); /* Adjust to center marker base at coordinates */
`
  const iconSvgPath = ICON_SVG_PATHS[iconName] || "" // Get SVG path data
  const iconHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${
    isSelected ? "white" : color
  }" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">${iconSvgPath}</svg>`

  const labelHtml = `<span style="font-size: 10px; font-weight: bold; color: ${
    isSelected ? "white" : "black"
  }; white-space: nowrap;">${labelText}</span>`
  el.innerHTML = `${iconHtml}${labelHtml}`
  return el
}

const mapOptions: mapboxgl.MapboxOptions = {
  style: "mapbox://styles/mapbox/streets-v11",
  center: [77.2222, 28.6435],
  zoom: 17,
  pitch: 45,
  bearing: -17.6,
  antialias: true,
}

export default function MapboxStationMap({
  layout,
  selectedEntryGateId,
  destinationPlatformId,
  onSelectEntryGate,
  pathPoints,
  userPosition,
  userBearing,
  currentInstructionIndex,
  pathInstructions,
}: MapboxStationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map())
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const currentInstructionTargetMarkerRef = useRef<mapboxgl.Marker | null>(null)

  const getPointById = (id: string) => layout.points.find((p) => p.id === id)

  useEffect(() => {
    if (mapInstance.current) return

    mapInstance.current = new mapboxgl.Map({
      ...mapOptions,
      container: mapRef.current!,
    })

    mapInstance.current.on("load", () => {
      mapInstance.current?.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [],
          },
        },
      })

      mapInstance.current?.addLayer({
        id: "route",
        type: "line",
        source: "route",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#3b82f6",
          "line-width": 4,
        },
      })

      mapInstance.current?.addLayer({
        id: "route-arrows",
        type: "symbol",
        source: "route",
        layout: {
          "symbol-placement": "line",
          "symbol-spacing": 50,
          "text-field": "▶",
          "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
          "text-size": 12,
          "text-offset": [0, 0],
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: {
          "text-color": "#3b82f6",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1,
        },
      })
    })

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove()
        mapInstance.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!mapInstance.current || !mapInstance.current.isStyleLoaded()) return

    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current.clear()

    layout.points.forEach((point) => {
      if (!point.latLng) return

      let iconName: string | null = null
      let markerColor = ""
      let isSelected = false

      if (point.type === "gate") {
        iconName = "DoorOpen"
        markerColor = "#33aa33"
        isSelected = selectedEntryGateId === point.id
      } else if (point.type === "platform") {
        iconName = "TrainFront"
        markerColor = "#66aaff"
        isSelected = destinationPlatformId === point.id
      } else if (point.type === "poi") {
        if (point.id === "escalator-1") iconName = "Escalator"
        else if (point.id === "stairs-1") iconName = "Stairs"
        else iconName = null
        markerColor = "#ff9933"
      } else {
        return
      }

      if (iconName) {
        const el = createHtmlMarker(iconName, markerColor, point.name, isSelected)
        const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([point.latLng.lng, point.latLng.lat])
          .addTo(mapInstance.current)

        if (point.type === "gate") {
          el.onclick = () => onSelectEntryGate(point.id)
        }
        markersRef.current.set(point.id, marker)
      }
    })
  }, [layout, selectedEntryGateId, destinationPlatformId, onSelectEntryGate])

  useEffect(() => {
    if (!mapInstance.current || !mapInstance.current.isStyleLoaded()) return

    const routeSource = mapInstance.current.getSource("route") as mapboxgl.GeoJSONSource
    if (routeSource) {
      if (pathPoints.length > 0) {
        const pathCoordinates = pathPoints.map((p) => [p.latLng!.lng, p.latLng!.lat])
        routeSource.setData({
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: pathCoordinates,
          },
        })
      } else {
        routeSource.setData({
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [],
          },
        })
      }
    }
  }, [pathPoints])

  useEffect(() => {
    if (!mapInstance.current || !mapInstance.current.isStyleLoaded()) return

    if (!userMarkerRef.current) {
      const el = document.createElement("div")
      el.className = "user-position-marker"
      el.style.cssText = `
      width: 30px;
      height: 30px;
      background-color: hsl(var(--destructive));
      border-radius: 50%;
      border: 2px solid white;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 5px rgba(0,0,0,0.5);
      transform: translate(-50%, -50%);
    `
      const iconSvgPath = ICON_SVG_PATHS["LocateFixed"] || ""
      const iconHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">${iconSvgPath}</svg>`
      el.innerHTML = iconHtml
      userMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: "center" })
    }

    if (userPosition) {
      userMarkerRef.current.setLngLat([userPosition.lng, userPosition.lat]).addTo(mapInstance.current)
      mapInstance.current.panTo(userPosition)

      if (userBearing !== null && userMarkerRef.current.getElement()) {
        userMarkerRef.current.getElement().style.transform = `translate(-50%, -50%) rotate(${userBearing}deg)`
      }
    } else {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove()
        userMarkerRef.current = null
      }
    }
  }, [userPosition, userBearing])

  useEffect(() => {
    if (!mapInstance.current || !mapInstance.current.isStyleLoaded()) return

    if (currentInstructionTargetMarkerRef.current) {
      currentInstructionTargetMarkerRef.current.remove()
      currentInstructionTargetMarkerRef.current = null
    }

    if (currentInstructionIndex < pathInstructions.length) {
      const currentInstruction = pathInstructions[currentInstructionIndex]
      const targetPoint = getPointById(currentInstruction.to)

      if (targetPoint && targetPoint.latLng) {
        const el = document.createElement("div")
        el.className = "current-instruction-target-marker"
        el.style.cssText = `
          width: 20px;
          height: 20px;
          background-color: hsl(var(--primary));
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 0 8px rgba(0,0,0,0.6);
          animation: pulse 1.5s infinite ease-in-out;
        `
        currentInstructionTargetMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([targetPoint.latLng.lng, targetPoint.latLng.lat])
          .addTo(mapInstance.current)
      }
    }

    const styleTag = document.createElement("style")
    styleTag.innerHTML = `
      @keyframes pulse {
        0% { transform: scale(0.8); opacity: 0.7; }
        50% { transform: scale(1.2); opacity: 1; }
        100% { transform: scale(0.8); opacity: 0.7; }
      }
    `
    document.head.appendChild(styleTag)

    return () => {
      document.head.removeChild(styleTag)
    }
  }, [currentInstructionIndex, pathInstructions])

  return (
    <div className="relative w-full max-w-xl mx-auto bg-white rounded-lg shadow-md p-4">
      <h3 className="text-lg font-semibold mb-2">Station Layout Map</h3>
      <div
        ref={mapRef}
        className="w-full h-[400px] border rounded-md"
        role="application"
        aria-label="Interactive Mapbox Map of Railway Station"
      ></div>
    </div>
  )
}
