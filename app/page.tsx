"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface GeoData {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  altitudeAccuracy: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

interface TrackPoint {
  lat: number;
  lng: number;
  speed: number | null;
  timestamp: number;
}

function getDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatSpeed(metersPerSec: number | null): string {
  if (metersPerSec === null || metersPerSec < 0) return "—";
  const mph = metersPerSec * 2.237;
  return `${mph.toFixed(1)} mph`;
}

function formatHeading(degrees: number | null): string {
  if (degrees === null) return "—";
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round(degrees / 45) % 8;
  return `${directions[index]} (${degrees.toFixed(0)}°)`;
}

function formatAltitude(meters: number | null): string {
  if (meters === null) return "—";
  const feet = meters * 3.281;
  return `${feet.toFixed(0)} ft (${meters.toFixed(0)} m)`;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}

export default function Home() {
  const [geo, setGeo] = useState<GeoData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "requesting" | "tracking" | "error">("idle");
  const [track, setTrack] = useState<TrackPoint[]>([]);
  const [totalDistance, setTotalDistance] = useState(0);
  const [updateCount, setUpdateCount] = useState(0);
  const watchIdRef = useRef<number | null>(null);
  const lastPointRef = useRef<{ lat: number; lng: number } | null>(null);

  const handlePosition = useCallback((position: GeolocationPosition) => {
    const { latitude, longitude, accuracy, altitude, altitudeAccuracy, heading, speed } =
      position.coords;

    setGeo({
      latitude,
      longitude,
      accuracy,
      altitude,
      altitudeAccuracy,
      heading,
      speed,
      timestamp: position.timestamp,
    });

    setStatus("tracking");
    setUpdateCount((c) => c + 1);

    // Only add to track if moved more than 10 meters (reduces noise)
    const last = lastPointRef.current;
    if (!last || getDistance(last.lat, last.lng, latitude, longitude) > 10) {
      if (last) {
        const dist = getDistance(last.lat, last.lng, latitude, longitude);
        setTotalDistance((d) => d + dist);
      }
      lastPointRef.current = { lat: latitude, lng: longitude };
      setTrack((t) => [
        ...t.slice(-49), // Keep last 50 points
        { lat: latitude, lng: longitude, speed, timestamp: position.timestamp },
      ]);
    }
  }, []);

  const handleError = useCallback((err: GeolocationPositionError) => {
    setStatus("error");
    switch (err.code) {
      case err.PERMISSION_DENIED:
        setError("Location permission denied. Please allow location access in your browser settings.");
        break;
      case err.POSITION_UNAVAILABLE:
        setError("Location unavailable. GPS signal may be blocked.");
        break;
      case err.TIMEOUT:
        setError("Location request timed out. Retrying...");
        break;
      default:
        setError(`Location error: ${err.message}`);
    }
  }, []);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser.");
      setStatus("error");
      return;
    }

    setStatus("requesting");
    setError(null);

    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      handleError,
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      }
    );
  }, [handlePosition, handleError]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setStatus("idle");
  }, []);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const totalDistanceMiles = totalDistance * 0.000621371;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e0e0e0] p-4 font-[family-name:var(--font-geist-mono)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Tesla Geo Tracker</h1>
        <div className="flex items-center gap-3">
          <span
            className={`inline-block w-3 h-3 rounded-full ${
              status === "tracking"
                ? "bg-green-500 animate-pulse"
                : status === "requesting"
                ? "bg-yellow-500 animate-pulse"
                : status === "error"
                ? "bg-red-500"
                : "bg-gray-500"
            }`}
          />
          <span className="text-sm text-gray-400 uppercase tracking-wide">
            {status}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="mb-6">
        {status === "idle" || status === "error" ? (
          <button
            onClick={startTracking}
            className="w-full py-4 text-lg font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            Start Tracking
          </button>
        ) : (
          <button
            onClick={stopTracking}
            className="w-full py-4 text-lg font-semibold bg-red-700 hover:bg-red-600 text-white rounded-lg transition-colors"
          >
            Stop Tracking
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-300">
          {error}
        </div>
      )}

      {/* Main Data */}
      {geo && (
        <>
          {/* Coordinates - Big Display */}
          <div className="mb-6 p-5 bg-[#141414] rounded-lg border border-[#2a2a2a]">
            <div className="text-sm text-gray-500 uppercase tracking-wider mb-2">
              Current Position
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {geo.latitude.toFixed(6)}, {geo.longitude.toFixed(6)}
            </div>
            <div className="text-sm text-gray-500">
              Accuracy: ±{geo.accuracy.toFixed(0)}m &middot; Updated{" "}
              {formatTime(geo.timestamp)}
            </div>
          </div>

          {/* Data Grid */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <DataCard label="Speed" value={formatSpeed(geo.speed)} />
            <DataCard label="Heading" value={formatHeading(geo.heading)} />
            <DataCard label="Altitude" value={formatAltitude(geo.altitude)} />
            <DataCard
              label="Alt. Accuracy"
              value={
                geo.altitudeAccuracy !== null
                  ? `±${geo.altitudeAccuracy.toFixed(0)}m`
                  : "—"
              }
            />
          </div>

          {/* Trip Stats */}
          <div className="mb-6 p-5 bg-[#141414] rounded-lg border border-[#2a2a2a]">
            <div className="text-sm text-gray-500 uppercase tracking-wider mb-3">
              Trip Stats
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-xl font-bold text-white">
                  {totalDistanceMiles.toFixed(2)} mi
                </div>
                <div className="text-xs text-gray-500">Distance</div>
              </div>
              <div>
                <div className="text-xl font-bold text-white">
                  {updateCount}
                </div>
                <div className="text-xs text-gray-500">Updates</div>
              </div>
              <div>
                <div className="text-xl font-bold text-white">
                  {track.length}
                </div>
                <div className="text-xs text-gray-500">Track Points</div>
              </div>
            </div>
          </div>

          {/* Recent Track Points */}
          {track.length > 0 && (
            <div className="p-5 bg-[#141414] rounded-lg border border-[#2a2a2a]">
              <div className="text-sm text-gray-500 uppercase tracking-wider mb-3">
                Recent Positions (last {Math.min(track.length, 10)})
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {track
                  .slice(-10)
                  .reverse()
                  .map((pt, i) => (
                    <div
                      key={pt.timestamp}
                      className={`flex justify-between text-sm py-1 ${
                        i === 0
                          ? "text-green-400"
                          : "text-gray-400 border-t border-[#222]"
                      }`}
                    >
                      <span>
                        {pt.lat.toFixed(6)}, {pt.lng.toFixed(6)}
                      </span>
                      <span>
                        {formatSpeed(pt.speed)} &middot;{" "}
                        {formatTime(pt.timestamp)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Idle state */}
      {!geo && status === "idle" && (
        <div className="text-center text-gray-500 mt-20">
          <div className="text-6xl mb-4">&#x1F4E1;</div>
          <p className="text-lg">
            Tap &ldquo;Start Tracking&rdquo; to begin receiving GPS data
          </p>
          <p className="text-sm mt-2">
            Works best in the Tesla browser with a clear sky view
          </p>
        </div>
      )}

      {/* Requesting state */}
      {!geo && status === "requesting" && (
        <div className="text-center text-yellow-400 mt-20">
          <div className="text-6xl mb-4 animate-pulse">&#x1F50D;</div>
          <p className="text-lg">Acquiring GPS signal...</p>
          <p className="text-sm mt-2 text-gray-500">
            If prompted, allow location access
          </p>
        </div>
      )}
    </div>
  );
}

function DataCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 bg-[#141414] rounded-lg border border-[#2a2a2a]">
      <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className="text-xl font-semibold text-white">{value}</div>
    </div>
  );
}
