"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Image from "next/image"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  mockStationLayout,
  getPNRDetails,
  type PNRDetails,
  type PathInstruction,
  type StationPoint,
} from "@/lib/station-data"
import MapboxStationMap from "./mapbox-station-map"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Terminal, Volume2, VolumeX, Languages, Info } from "lucide-react"
import { useSpeechSynthesis } from "@/hooks/use-speech-synthesis"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { getDistanceBetweenPoints, getIntermediateLatLng } from "@/lib/utils"
import { ThemeToggle } from "./theme-toggle"

type Language = "en-US" | "hi-IN"

// Helper function to calculate bearing between two LatLng points
function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRadians = (deg: number) => (deg * Math.PI) / 180
  const toDegrees = (rad: number) => (rad * 180) / Math.PI

  const φ1 = toRadians(lat1)
  const φ2 = toRadians(lat2)
  const Δλ = toRadians(lng2 - lng1)

  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  const θ = Math.atan2(y, x) // Bearing in radians

  return (toDegrees(θ) + 360) % 360 // Normalize to 0-360 degrees
}

export default function RailwayNavigation() {
  const [pnr, setPnr] = useState("")
  const [pnrDetails, setPnrDetails] = useState<PNRDetails | null>(null)
  const [selectedEntryGateId, setSelectedEntryGateId] = useState<string | null>(null)
  const [pathInstructions, setPathInstructions] = useState<PathInstruction[]>([])
  const [pathPointsForMap, setPathPointsForMap] = useState<StationPoint[]>([])
  const [error, setError] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)
  const [userPosition, setUserPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [userBearing, setUserBearing] = useState<number | null>(null)
  const [currentInstructionIndex, setCurrentInstructionIndex] = useState<number>(0)
  const [isSimulating, setIsSimulating] = useState(false)
  const [language, setLanguage] = useState<Language>("en-US")

  const [liveLocationEnabled, setLiveLocationEnabled] = useState(false)
  const [actualUserLatLng, setActualUserLatLng] = useState<{ lat: number; lng: number } | null>(null)
  const [geolocationError, setGeolocationError] = useState<string | null>(null)
  const watchIdRef = useRef<number | null>(null)

  const simulationIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const { speak, cancel: cancelSpeech, isSpeaking } = useSpeechSynthesis()

  const totalDistanceTraveledRef = useRef(0)
  const currentInstructionIdxRef = useRef(0)

  const getPointById = useCallback((id: string) => mockStationLayout.points.find((p) => p.id === id), [])

  const generatePathPointsForMap = useCallback(
    (instructions: PathInstruction[], entryGateId: string | null) => {
      const points: StationPoint[] = []
      if (!entryGateId) return points

      const startPoint = getPointById(entryGateId)
      if (startPoint) {
        points.push(startPoint)
      }

      instructions.forEach((instruction) => {
        if (instruction.path_nodes) {
          instruction.path_nodes.forEach((nodeId) => {
            const node = getPointById(nodeId)
            if (node) points.push(node)
          })
        }
        const toPoint = getPointById(instruction.to)
        if (toPoint) {
          points.push(toPoint)
        }
      })

      let currentCumulativeDistance = 0
      for (let i = 0; i < points.length; i++) {
        if (i > 0) {
          currentCumulativeDistance += getDistanceBetweenPoints(points[i - 1], points[i])
        }
        points[i].cumulativeDistance = currentCumulativeDistance
      }

      instructions.forEach((inst) => {
        const targetPoint = points.find((p) => p.id === inst.to)
        if (targetPoint && targetPoint.cumulativeDistance !== undefined) {
          inst.cumulativeDistanceToTarget = targetPoint.cumulativeDistance
        }
      })

      return points
    },
    [getPointById],
  )

  const handlePNRLookup = () => {
    setError(null)
    setInfoMessage(null)
    cancelSimulation()
    setLiveLocationEnabled(false)
    const details = getPNRDetails(pnr)
    if (details) {
      setPnrDetails(details)
      setSelectedEntryGateId(null)
      setPathInstructions([])
      setPathPointsForMap([])
      setUserPosition(null)
      setUserBearing(null)
      setActualUserLatLng(null)
      setCurrentInstructionIndex(0)
    } else {
      setPnrDetails(null)
      setError("PNR not found. Please try a mock PNR like 1234567890, 0987654321, 1122334455, or 5544332211.")
    }
  }

  const handleEntryGateSelect = useCallback(
    (gateId: string) => {
      setSelectedEntryGateId(gateId)
      cancelSimulation()
      setLiveLocationEnabled(false)
      setInfoMessage(null)
      if (pnrDetails && gateId) {
        const pathKey = `${gateId}-${pnrDetails.destinationPlatformId}`
        const instructions = mockStationLayout.paths[pathKey]
        if (instructions) {
          setPathInstructions(instructions)
          const points = generatePathPointsForMap(instructions, gateId)
          setPathPointsForMap(points)
          setUserPosition(points[0]?.latLng || null)
          setUserBearing(null)
          setActualUserLatLng(null)
          setCurrentInstructionIndex(0)
          setError(null)
        } else {
          setPathInstructions([])
          setPathPointsForMap([])
          setUserPosition(null)
          setUserBearing(null)
          setActualUserLatLng(null)
          setCurrentInstructionIndex(0)
          setError("No path found for the selected gate and platform. Please try another gate.")
        }
      } else {
        setPathInstructions([])
        setPathPointsForMap([])
        setUserPosition(null)
        setUserBearing(null)
        setActualUserLatLng(null)
        setCurrentInstructionIndex(0)
      }
    },
    [pnrDetails, generatePathPointsForMap],
  )

  const simulationSpeed = 2 // meters per second
  const simulationIntervalDuration = 50 // milliseconds

  const startSimulation = useCallback(() => {
    if (isSimulating || pathPointsForMap.length < 2 || liveLocationEnabled) return

    setIsSimulating(true)
    setInfoMessage(null)

    if (!userPosition || totalDistanceTraveledRef.current === 0) {
      totalDistanceTraveledRef.current = 0
      currentInstructionIdxRef.current = 0
      setUserPosition(pathPointsForMap[0]?.latLng || null)
      setUserBearing(null)
    }

    if (pathInstructions.length > 0 && currentInstructionIdxRef.current < pathInstructions.length) {
      const instructionText =
        language === "en-US"
          ? pathInstructions[currentInstructionIdxRef.current].text
          : pathInstructions[currentInstructionIdxRef.current].hindiText
      speak(instructionText, language)
    }

    simulationIntervalRef.current = setInterval(() => {
      const distanceToAdvance = simulationSpeed * (simulationIntervalDuration / 1000)
      totalDistanceTraveledRef.current += distanceToAdvance

      const totalPathLength = pathPointsForMap[pathPointsForMap.length - 1]?.cumulativeDistance || 0

      if (totalDistanceTraveledRef.current >= totalPathLength) {
        totalDistanceTraveledRef.current = totalPathLength
        const destinationMessage =
          language === "en-US"
            ? `You have reached Platform ${pnrDetails?.platformNumber}, Coach ${pnrDetails?.coachDetails}.`
            : `आप प्लेटफॉर्म ${pnrDetails?.platformNumber}, कोच ${pnrDetails?.coachDetails} पर पहुंच गए हैं।`
        speak(destinationMessage, language)
        cancelSimulation()
        return
      }

      let currentSegmentStartPoint: StationPoint | undefined
      let currentSegmentEndPoint: StationPoint | undefined
      let fractionInSegment = 0

      for (let i = 0; i < pathPointsForMap.length - 1; i++) {
        const p1 = pathPointsForMap[i]
        const p2 = pathPointsForMap[i + 1]

        const segmentStartDist = p1.cumulativeDistance || 0
        const segmentEndDist = p2.cumulativeDistance || 0

        if (
          totalDistanceTraveledRef.current >= segmentStartDist &&
          totalDistanceTraveledRef.current <= segmentEndDist
        ) {
          currentSegmentStartPoint = p1
          currentSegmentEndPoint = p2
          const distanceInThisSegment = totalDistanceTraveledRef.current - segmentStartDist
          const segmentLength = segmentEndDist - segmentStartDist
          fractionInSegment = segmentLength > 0 ? distanceInThisSegment / segmentLength : 0
          break
        }
      }

      if (
        currentSegmentStartPoint &&
        currentSegmentEndPoint &&
        currentSegmentStartPoint.latLng &&
        currentSegmentEndPoint.latLng
      ) {
        const interpolatedPosition = getIntermediateLatLng(
          currentSegmentStartPoint.latLng,
          currentSegmentEndPoint.latLng,
          fractionInSegment,
        )
        setUserPosition(interpolatedPosition)

        setUserBearing(
          calculateBearing(
            currentSegmentStartPoint.latLng.lat,
            currentSegmentStartPoint.latLng.lng,
            currentSegmentEndPoint.latLng.lat,
            currentSegmentEndPoint.latLng.lng,
          ),
        )
      }

      const currentInstruction = pathInstructions[currentInstructionIdxRef.current]
      if (currentInstruction && currentInstruction.cumulativeDistanceToTarget !== undefined) {
        if (totalDistanceTraveledRef.current >= currentInstruction.cumulativeDistanceToTarget) {
          currentInstructionIdxRef.current++
          setCurrentInstructionIndex(currentInstructionIdxRef.current)
          if (currentInstructionIdxRef.current < pathInstructions.length) {
            const nextInstructionText =
              language === "en-US"
                ? pathInstructions[currentInstructionIdxRef.current].text
                : pathInstructions[currentInstructionIdxRef.current].hindiText
            speak(nextInstructionText, language)
          }
        }
      }
    }, simulationIntervalDuration)
  }, [isSimulating, pathPointsForMap, pathInstructions, liveLocationEnabled, pnrDetails, language, speak, userPosition])

  const cancelSimulation = useCallback(() => {
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current)
      simulationIntervalRef.current = null
    }
    setIsSimulating(false)
    cancelSpeech()
    setUserBearing(null)
  }, [cancelSpeech])

  const handleRecalculateRoute = () => {
    cancelSimulation()
    setLiveLocationEnabled(false)
    setError(null)
    if (selectedEntryGateId && pnrDetails) {
      handleEntryGateSelect(selectedEntryGateId)
      setInfoMessage("Route recalculated from your last known position.")
    } else {
      setError("Please select an entry gate first to recalculate route.")
    }
  }

  const entryGates = mockStationLayout.points.filter((p) => p.type === "gate")

  useEffect(() => {
    if (liveLocationEnabled) {
      setGeolocationError(null)
      setInfoMessage(null)
      cancelSimulation()

      if (!navigator.geolocation) {
        setGeolocationError("Geolocation is not supported by your browser.")
        return
      }

      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const newLatLng = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          }
          setActualUserLatLng(newLatLng)
          setGeolocationError(null)

          if (userPosition) {
            setUserBearing(calculateBearing(userPosition.lat, userPosition.lng, newLatLng.lat, newLatLng.lng))
          } else {
            setUserBearing(null)
          }
        },
        (error) => {
          let errorMessage = "Error getting your location."
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = "Location access denied. Please enable location services for this site."
              break
            case error.POSITION_UNAVAILABLE:
              errorMessage = "Location information is unavailable."
              break
            case error.TIMEOUT:
              errorMessage = "The request to get user location timed out."
              break
            default:
              errorMessage = `An unknown error occurred: ${error.message}`
              break
          }
          setGeolocationError(errorMessage)
          setActualUserLatLng(null)
          setUserBearing(null)
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        },
      )
    } else {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      setActualUserLatLng(null)
      setGeolocationError(null)
      setUserBearing(null)
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [liveLocationEnabled, cancelSimulation, userPosition])

  useEffect(() => {
    if (liveLocationEnabled && actualUserLatLng) {
      setUserPosition(actualUserLatLng)
    } else if (!liveLocationEnabled && pathPointsForMap.length > 0) {
      if (!isSimulating && !userPosition) {
        setUserPosition(pathPointsForMap[0]?.latLng || null)
      }
    } else {
      setUserPosition(null)
    }
  }, [liveLocationEnabled, actualUserLatLng, pathPointsForMap, isSimulating, userPosition])

  useEffect(() => {
    return () => {
      cancelSimulation()
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [cancelSimulation])

  useEffect(() => {
    totalDistanceTraveledRef.current = 0
    currentInstructionIdxRef.current = 0
    setCurrentInstructionIndex(0)
  }, [pnrDetails, selectedEntryGateId])

  return (
    <Card className="w-full max-w-3xl">
      <CardHeader className="flex items-start p-4 bg-white rounded-t-lg">
        <div className="flex items-center gap-4">
          {" "}
          {/* Grouping logo, title, and theme toggle */}
          <ThemeToggle /> {/* Theme toggle moved to the left */}
          <Image
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/ChatGPT%20Image%20Jul%2017%2C%202025%2C%2011_48_13%20AM-kw23VPyTpsopdd7eO7eae8uMOFpjC1.png" // Using the new Source URL
            alt="Smart Railway Navigation Logo"
            width={100} // Increased width
            height={100} // Increased height
            priority
            className="object-contain mr-2"
          />
          <div className="flex flex-col items-start">
            {" "}
            {/* Align text to start */}
            <h1 className="text-4xl font-bold text-gray-800">Smart Railway Navigation</h1>
            <p className="text-sm text-gray-600">Navigate railway stations with ease.</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <Input
            placeholder="Enter PNR Number (e.g., 1234567890)"
            value={pnr}
            onChange={(e) => setPnr(e.target.value)}
            className="flex-1"
            aria-label="PNR Number"
          />
          <Button onClick={handlePNRLookup} aria-label="Fetch Details">
            Fetch Details
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {geolocationError && (
          <Alert variant="destructive">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Geolocation Error</AlertTitle>
            <AlertDescription>{geolocationError}</AlertDescription>
          </Alert>
        )}
        {infoMessage && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Information</AlertTitle>
            <AlertDescription>{infoMessage}</AlertDescription>
          </Alert>
        )}

        {pnrDetails && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Train Details:</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div>
                <strong>Train Number:</strong> {pnrDetails.trainNumber}
              </div>
              <div>
                <strong>Platform Number:</strong> {pnrDetails.platformNumber}
              </div>
              <div>
                <strong>Coach Details:</strong> {pnrDetails.coachDetails}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Select Entry Gate:</h3>
              <Select
                onValueChange={handleEntryGateSelect}
                value={selectedEntryGateId || ""}
                aria-label="Select Entry Gate"
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose your entry gate" />
                </SelectTrigger>
                <SelectContent>
                  {entryGates.map((gate) => (
                    <SelectItem key={gate.id} value={gate.id}>
                      {gate.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedEntryGateId && pnrDetails.destinationPlatformId && (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Route Map:</h3>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Languages className="h-5 w-5 text-gray-600" />
                      <Label htmlFor="language-toggle" className="sr-only">
                        Toggle Language
                      </Label>
                      <Switch
                        id="language-toggle"
                        checked={language === "hi-IN"}
                        onCheckedChange={(checked) => setLanguage(checked ? "hi-IN" : "en-US")}
                        aria-label="Toggle language between English and Hindi"
                      />
                      <span className="text-sm text-gray-600">{language === "en-US" ? "English" : "हिंदी"}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="live-location-toggle">Live Location</Label>
                      <Switch
                        id="live-location-toggle"
                        checked={liveLocationEnabled}
                        onCheckedChange={setLiveLocationEnabled}
                        aria-label="Toggle live location tracking"
                      />
                    </div>
                  </div>
                </div>
                <MapboxStationMap
                  layout={mockStationLayout}
                  selectedEntryGateId={selectedEntryGateId}
                  destinationPlatformId={pnrDetails.destinationPlatformId}
                  onSelectEntryGate={handleEntryGateSelect}
                  pathPoints={pathPointsForMap}
                  userPosition={userPosition}
                  userBearing={userBearing}
                  currentInstructionIndex={currentInstructionIndex}
                  pathInstructions={pathInstructions}
                />

                {pathInstructions.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold">Turn-by-Turn Instructions:</h3>
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      {pathInstructions.map((instruction, index) => (
                        <li
                          key={instruction.id}
                          className={index === currentInstructionIndex ? "font-bold text-primary" : ""}
                          aria-current={index === currentInstructionIndex ? "step" : undefined}
                        >
                          {language === "en-US" ? instruction.text : instruction.hindiText}
                        </li>
                      ))}
                      {currentInstructionIndex >= pathInstructions.length && (
                        <li className="font-bold text-primary">
                          {language === "en-US"
                            ? `You have reached Platform ${pnrDetails.platformNumber}, Coach ${pnrDetails.coachDetails}.`
                            : `आप प्लेटफॉर्म ${pnrDetails.platformNumber}, कोच ${pnrDetails.coachDetails} पर पहुंच गए हैं।`}
                        </li>
                      )}
                    </ol>
                    <div className="flex gap-2 mt-4">
                      <Button
                        onClick={isSimulating ? cancelSimulation : startSimulation}
                        disabled={pathPointsForMap.length === 0 || liveLocationEnabled}
                        aria-label={isSimulating ? "Pause Navigation" : "Start Navigation"}
                      >
                        {isSimulating ? (
                          <>
                            <VolumeX className="h-4 w-4 mr-2" /> Pause Navigation
                          </>
                        ) : (
                          <>
                            <Volume2 className="h-4 w-4 mr-2" /> Start Navigation
                          </>
                        )}
                      </Button>
                      <Button onClick={handleRecalculateRoute} variant="outline" aria-label="Recalculate Route">
                        Recalculate Route
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
