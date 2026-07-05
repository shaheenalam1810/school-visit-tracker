"use client";

import { useState } from "react";
import {
  MapPin,
  LocateFixed,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import Card from "./Card";

export interface CapturedLocation {
  latitude: string;
  longitude: string;
  accuracy: string;
  google_map: string;
}

interface LocationCaptureProps {
  value: CapturedLocation | null;
  onCapture: (location: CapturedLocation) => void;
}

type Status = "idle" | "loading" | "success" | "error";

export default function LocationCapture({
  value,
  onCapture,
}: LocationCaptureProps) {
  const [status, setStatus] = useState<Status>(
    value ? "success" : "idle"
  );
  const [errorMessage, setErrorMessage] = useState("");

  function handleGetLocation() {
    if (!("geolocation" in navigator)) {
      setStatus("error");
      setErrorMessage("Geolocation is not supported by this browser.");
      return;
    }

    setStatus("loading");
    setErrorMessage("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;

        const lat = latitude.toFixed(6);
        const lng = longitude.toFixed(6);

        const mapUrl = `https://www.google.com/maps?q=${lat},${lng}`;

        onCapture({
          latitude: lat,
          longitude: lng,
          accuracy: Math.round(accuracy).toString(),
          google_map: mapUrl,
        });

        setStatus("success");
      },
      (error) => {
        setStatus("error");

        switch (error.code) {
          case error.PERMISSION_DENIED:
            setErrorMessage(
              "Location permission denied. Please allow location access."
            );
            break;

          case error.POSITION_UNAVAILABLE:
            setErrorMessage("Location unavailable.");
            break;

          case error.TIMEOUT:
            setErrorMessage("Location request timed out.");
            break;

          default:
            setErrorMessage("Unable to get your location.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  }

  return (
    <div className="w-full">
      <span className="mb-2 block text-sm font-medium">
        School Location
      </span>

      <button
        type="button"
        onClick={handleGetLocation}
        disabled={status === "loading"}
        className={`flex w-full items-center justify-center gap-2 rounded-xl border-2 py-3 transition ${
          status === "success"
            ? "border-green-500 bg-green-50 text-green-700"
            : status === "error"
            ? "border-red-400 bg-red-50 text-red-700"
            : "border-gray-300 bg-white"
        }`}
      >
        {status === "loading" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Getting Location...
          </>
        ) : status === "success" ? (
          <>
            <CheckCircle2 className="h-4 w-4" />
            Location Captured (Tap Again to Refresh)
          </>
        ) : (
          <>
            <LocateFixed className="h-4 w-4" />
            📍 Get Current Location
          </>
        )}
      </button>

      {status === "error" && (
        <div className="mt-3 flex gap-2 rounded-lg bg-red-50 p-3">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <p className="text-sm text-red-600">{errorMessage}</p>
        </div>
      )}

      {status === "success" && value && (
        <Card className="mt-3 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4" />

            <span>
              Latitude: <strong>{value.latitude}</strong>
            </span>
          </div>

          <div className="text-sm">
            Longitude: <strong>{value.longitude}</strong>
          </div>

          <div className="text-sm">
            Accuracy: ±{value.accuracy} meters
          </div>

          <a
            href={value.google_map}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-sm text-blue-600 underline"
          >
            Open in Google Maps
          </a>
        </Card>
      )}

      {status === "idle" && (
        <p className="mt-2 text-xs text-gray-500">
          Tap the button above to capture the school's exact GPS location.
        </p>
      )}
    </div>
  );
}