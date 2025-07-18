"use client"

import { useEffect, useRef, useState } from "react"
import type { StationLayout, StationPoint } from "@/lib/station-data"

// Declare global google object for TypeScript to recognize it
declare global {
  interface Window {
    google: any
  }
}

interface GoogleStationMapProps {
  layout: StationLayout
  selectedEntryGateId: string | null
  destinationPlatformId: string | null
  onSelectEntryGate: (gateId: string) => void
  pathPoints: StationPoint[]
  userPosition: { lat: number; lng: number } | null
}

// Raw SVG paths for Lucide icons used in markers
const ICON_SVG_PATHS: { [key: string]: string } = {
  DoorOpen: `<path d="M12 22h6a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h2" /><path d="M14 12h.01" />`,
  TrainFront: `<path d="M17 6H7c-2.8 0-5 2.2-5 5v3c0 2.8 2.2 5 5 5h10c2.8 0 5-2.2 5-5v-3c0-2.8-2.2-5-5-5Z"/><path d="m17 19-2.5-1.5"/><path d="m7 19 2.5-1.5"/><path d="M2 11h20"/><path d="M12 6V3"/><path d="M12 19v3"/>`,
  Escalator: `<path d="M10 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4"/><path d="M14 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M8 12h8"/><path d="M12 21V3"/><path d="M12 7h.01"/><path d="M12 17h.01"/>`,
  Stairs: `<path d="M18 15V9"/><path d="M12 15V9"/><path d="M6 15V9"/><path d="m18 2-4 4 4 4"/><path d="m6 2-4 4 4 4"/>`,
  LocateFixed: `<path d="M2 12h20"/><path d="M12 2v20"/><circle cx="12" cy="12" r="4"/>`,
}

// Helper function to create SVG string for Lucide icons without React rendering
const getSvgIconUrl = (iconName: string, color: string, googleMaps: any) => {
  const pathData = ICON_SVG_PATHS[iconName]
  if (!pathData) {
    console.warn(`SVG path not found for icon: ${iconName}`)
    return null
  }
  // Construct the SVG string directly
  const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">${pathData}</svg>`
  const encodedSvg = encodeURIComponent(svgString)
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodedSvg}`,
    scaledSize: new googleMaps.Size(30, 30),
    anchor: new googleMaps.Point(15, 15),
  }
}

// mapOptions now uses window.google.maps directly
const mapOptions: any = {
  center: { lat: 28.6435, lng: 77.2222 }, // Approximate center of New Delhi Railway Station
  zoom: 17, // Zoom level for indoor view
  // IMPORTANT: If you have a custom Map ID from Google Cloud Console, replace the empty string.
  // Otherwise, leave it as an empty string to use the default map style.
  mapId: "",
  disableDefaultUI: true, // Hide default UI controls
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
}

export default function GoogleStationMap({
  layout,
  selectedEntryGateId,
  destinationPlatformId,
  onSelectEntryGate,
  pathPoints,
  userPosition,
}: GoogleStationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<any>(null)
  const markersRef = useRef<Map<string, any>>(new Map())
  const polylineRef = useRef<any>(null)
  const userMarkerRef = useRef<any>(null)
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false)

  // Check if Google Maps API is loaded
  useEffect(() => {
    const checkGoogleMaps = () => {
      if (window.google && window.google.maps) {
        setIsGoogleMapsLoaded(true)
      } else {
        // Retry checking after a short delay if not loaded yet
        setTimeout(checkGoogleMaps, 100)
      }
    }
    checkGoogleMaps()
  }, [])

  useEffect(() => {
    if (!isGoogleMapsLoaded || !mapRef.current) return

    // Initialize map only once
    if (!mapInstance.current) {
      mapInstance.current = new window.google.maps.Map(mapRef.current, mapOptions)

      // Add click listener to map to allow selecting gates by clicking their markers
      mapInstance.current.addListener("click", (e: any) => {
        console.log("Map clicked at:", e.latLng?.toJSON())
      })
    }

    return () => {
      // Clean up markers and polylines on unmount
      markersRef.current.forEach((marker) => marker.setMap(null))
      markersRef.current.clear()
      if (polylineRef.current) {
        polylineRef.current.setMap(null)
      }
      if (userMarkerRef.current) {
        userMarkerRef.current.setMap(null)
      }
    }
  }, [isGoogleMapsLoaded]) // Depend on isGoogleMapsLoaded

  // Update markers when layout or selections change
  useEffect(() => {
    if (!mapInstance.current || !isGoogleMapsLoaded) return

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.setMap(null))
    markersRef.current.clear()

    layout.points.forEach((point) => {
      if (!point.latLng) return

      let icon = null
      const label = point.name
      let zIndex = 1

      if (point.type === "gate") {
        icon = getSvgIconUrl(
          "DoorOpen",
          selectedEntryGateId === point.id ? "hsl(var(--primary))" : "#33aa33",
          window.google.maps,
        )
        zIndex = selectedEntryGateId === point.id ? 3 : 2
      } else if (point.type === "platform") {
        icon = getSvgIconUrl(
          "TrainFront",
          destinationPlatformId === point.id ? "hsl(var(--primary))" : "#66aaff",
          window.google.maps,
        )
        zIndex = destinationPlatformId === point.id ? 3 : 2
      } else if (point.type === "poi") {
        if (point.id === "escalator-1") icon = getSvgIconUrl("Escalator", "#ff9933", window.google.maps)
        else if (point.id === "stairs-1") icon = getSvgIconUrl("Stairs", "#ff9933", window.google.maps)
        else icon = { url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png" } // Generic POI
        zIndex = 1
      } else {
        return // Don't create markers for path_nodes
      }

      const marker = new window.google.maps.Marker({
        position: point.latLng,
        map: mapInstance.current,
        title: point.name,
        icon: icon,
        label: {
          text: label,
          className: "map-label", // Custom class for styling
          color: point.type === "platform" && destinationPlatformId === point.id ? "white" : "black",
          fontWeight: "bold",
          fontSize: "10px",
        },
        zIndex: zIndex,
      })

      if (point.type === "gate") {
        marker.addListener("click", () => onSelectEntryGate(point.id))
      }

      markersRef.current.set(point.id, marker)
    })
  }, [layout, selectedEntryGateId, destinationPlatformId, onSelectEntryGate, isGoogleMapsLoaded])

  // Update path polyline
  useEffect(() => {
    if (!mapInstance.current || !isGoogleMapsLoaded) return

    if (polylineRef.current) {
      polylineRef.current.setMap(null)
    }

    if (pathPoints.length > 0) {
      const pathLatLngs = pathPoints.map((p) => p.latLng!)
      polylineRef.current = new window.google.maps.Polyline({
        path: pathLatLngs,
        geodesic: true,
        strokeColor: "hsl(var(--primary))",
        strokeOpacity: 1.0,
        strokeWeight: 4,
        icons: [
          {
            icon: {
              path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
              scale: 4,
              strokeColor: "hsl(var(--primary))",
              fillColor: "hsl(var(--primary))",
              fillOpacity: 1,
            },
            offset: "100%",
            repeat: "50px", // Repeat arrows along the path
          },
        ],
      })
      polylineRef.current.setMap(mapInstance.current)
    }
  }, [pathPoints, isGoogleMapsLoaded])

  // Update user position marker
  useEffect(() => {
    if (!mapInstance.current || !isGoogleMapsLoaded) return

    if (!userMarkerRef.current) {
      userMarkerRef.current = new window.google.maps.Marker({
        map: mapInstance.current,
        icon: getSvgIconUrl("LocateFixed", "hsl(var(--destructive))", window.google.maps),
        zIndex: 10,
      })
    }

    if (userPosition) {
      userMarkerRef.current.setPosition(userPosition)
      mapInstance.current.panTo(userPosition)
    } else {
      userMarkerRef.current.setMap(null) // Hide marker if no user position
    }
  }, [userPosition, isGoogleMapsLoaded])

  return (
    <div className="relative w-full max-w-xl mx-auto bg-white rounded-lg shadow-md p-4">
      <h3 className="text-lg font-semibold mb-2">Station Layout Map</h3>
      <div
        ref={mapRef}
        className="w-full h-[400px] border rounded-md"
        role="application"
        aria-label="Interactive Google Map of Railway Station"
      >
        {!isGoogleMapsLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-200/70 text-gray-600">
            Loading Google Maps...
          </div>
        )}
      </div>
      <style jsx global>{`
        .map-label {
          font-family: sans-serif;
          white-space: nowrap;
          transform: translateY(-100%); /* Position label above marker */
        }
      `}</style>
    </div>
  )
}
