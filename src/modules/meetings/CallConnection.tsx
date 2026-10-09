"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { LiveKitRoom, VideoConference, useConnectionState } from "@livekit/components-react";
import { ConnectionState, DisconnectReason } from "livekit-client";
import "@livekit/components-styles";

function ConnectionStatus() {
  const state = useConnectionState();
  if (state === ConnectionState.Connected) return null;
  return <p role="status" className="absolute left-4 top-4 z-50 rounded bg-black/80 px-3 py-2 text-sm text-white">{state === ConnectionState.Reconnecting || state === ConnectionState.SignalReconnecting ? "Reconnecting to the call..." : "Connecting to the call..."}</p>;
}

// Mount once per room/attempt so stale token requests cannot replace an active join.
export default function CallConnection(props: {
  roomName: string;
  audio?: boolean;
  video?: boolean;
  onLeave: () => void;
  children?: ReactNode;
}) {
  const [attempt, setAttempt] = useState(0);
  return <ConnectionAttempt key={`${props.roomName}:${attempt}`} {...props} onRetry={() => setAttempt(value => value + 1)} />;
}

function ConnectionAttempt({ roomName, audio = true, video = true, onLeave, onRetry, children }: {
  roomName: string; audio?: boolean; video?: boolean; onLeave: () => void; onRetry: () => void; children?: ReactNode;
}) {
  const [credentials, setCredentials] = useState<{ token: string; serverUrl: string } | null>(null);
  const [error, setError] = useState("");
  const [ended, setEnded] = useState(false);
  const [mediaWarning, setMediaWarning] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/livekit?${new URLSearchParams({ room: roomName })}`, { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to join the call.");
        if (!data.token || !data.serverUrl) throw new Error("The calling server did not return connection details.");
        if (!controller.signal.aborted) setCredentials(data);
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Unable to join the call.");
      }
    }
    void load();
    return () => controller.abort();
  }, [roomName]);

  const handleError = useCallback((err: Error) => {
    if (["NotAllowedError", "NotFoundError", "NotReadableError", "OverconstrainedError", "AbortError"].includes(err.name)) {
      setMediaWarning("Your camera or microphone could not start. You can stay in the call and enable them from the controls after checking browser permissions.");
      return;
    }
    setError("Could not connect to the calling server. Check your connection and retry. If this continues, ask your administrator to check the LiveKit configuration.");
  }, []);
  const handleMediaFailure = useCallback(() => {
    setMediaWarning("Your camera or microphone is unavailable. Check browser permissions and use the call controls to enable it.");
  }, []);
  const handleDisconnected = useCallback((reason?: DisconnectReason) => {
    if (reason === DisconnectReason.CLIENT_INITIATED) {
      setEnded(true);
      return;
    }
    setError(previous => previous || (reason === DisconnectReason.DUPLICATE_IDENTITY
      ? "This account joined the call in another tab or device. Close that call before rejoining here."
      : "The call disconnected. Check your connection and try joining again."));
  }, []);

  if (error || ended) return (
    <div className="flex h-full min-h-80 flex-col items-center justify-center gap-5 p-6 text-center text-white">
      <p role={error ? "alert" : "status"}>{error || "You left the call."}</p>
      <div className="flex gap-3">
        <button onClick={onRetry} className="rounded-lg bg-[#00DF73] px-5 py-2 font-semibold text-black">{ended ? "Rejoin" : "Retry"}</button>
        <button onClick={onLeave} className="rounded-lg border border-gray-600 px-5 py-2">Back to meetings</button>
      </div>
    </div>
  );
  if (!credentials) return <div role="status" className="grid h-full min-h-80 place-items-center text-gray-300">Preparing your call...</div>;
  return (
    <LiveKitRoom token={credentials.token} serverUrl={credentials.serverUrl} connect audio={audio} video={video}
      onError={handleError} onMediaDeviceFailure={handleMediaFailure} onDisconnected={handleDisconnected}
      data-lk-theme="default" style={{ height: "100%", width: "100%" }}>
      <VideoConference />
      <ConnectionStatus />
      {mediaWarning && <div role="alert" className="absolute left-4 right-4 top-16 z-50 rounded-lg bg-amber-950 p-3 text-sm text-amber-100">{mediaWarning}<button onClick={() => setMediaWarning("")} className="ml-3 underline">Dismiss</button></div>}
      {children}
    </LiveKitRoom>
  );
}
