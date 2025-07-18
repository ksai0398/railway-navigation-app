import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// lib/utils.ts
import type { StationPoint } from "./station-data"

// Helper to calculate distance between two StationPoints (using x,y for simplicity)
export function getDistanceBetweenPoints(p1: StationPoint, p2: StationPoint): number {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  return Math.sqrt(dx * dx + dy * dy) // Assuming 1 unit = 1 meter
}

// Helper to interpolate LatLng
export function getIntermediateLatLng(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
  fraction: number,
): { lat: number; lng: number } {
  const lat = start.lat + (end.lat - start.lat) * fraction
  const lng = start.lng + (end.lng - start.lng) * fraction
  return { lat, lng }
}
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
