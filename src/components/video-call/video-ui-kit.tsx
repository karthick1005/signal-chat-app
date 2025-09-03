import { useEffect, useRef, useState } from "react";
import { getLocalStream, stopLocalStream } from "./mediaManager";

type Props = {
  isCaller: boolean;
  remoteSDP?: RTCSessionDescriptionInit;
  onSignal: (data: any) => void;
  onEnd: () => void;
  queuedCandidates: RTCIceCandidateInit[];
  onPeerConnection: (pc: RTCPeerConnection) => void;
};

export default function VideoCall({
  isCaller,
  remoteSDP,
  onSignal,
  onEnd,
  queuedCandidates,
  onPeerConnection,
}: Props) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const [hasAnswered, setHasAnswered] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [connectionState, setConnectionState] = useState("");
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);

  const debugLog = (label: string, extra: object = {}) => {
    const pc = pcRef.current;
    console.log(`🧩 DEBUG — ${label}`, {
      connection: pc?.connectionState,
      signaling: pc?.signalingState,
      ice: pc?.iceConnectionState,
      isCaller,
      ...extra,
    });
  };

  useEffect(() => {
    let cancelled = false;

    const pc = new RTCPeerConnection({
      iceTransportPolicy: "relay",
    iceServers: [
      {
        urls: "stun:stun.relay.metered.ca:80",
      },
      {
        urls: "turn:global.relay.metered.ca:80",
        username: "4bc5bb24fafe245054612a8a",
        credential: "cVV8EzFHMb2sLLEg",
      },
      {
        urls: "turn:global.relay.metered.ca:80?transport=tcp",
        username: "4bc5bb24fafe245054612a8a",
        credential: "cVV8EzFHMb2sLLEg",
      },
      {
        urls: "turn:global.relay.metered.ca:443",
        username: "4bc5bb24fafe245054612a8a",
        credential: "cVV8EzFHMb2sLLEg",
      },
      {
        urls: "turns:global.relay.metered.ca:443?transport=tcp",
        username: "4bc5bb24fafe245054612a8a",
        credential: "cVV8EzFHMb2sLLEg",
      },
  ],
    });

    pcRef.current = pc;
    onPeerConnection(pc);
    debugLog("PeerConnection created");

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        debugLog("Sending ICE candidate", { candidate: event.candidate });
        onSignal({ type: "ice-candidate", candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      debugLog("Received remote track", { streams: event.streams });
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
      setHasRemoteVideo(true);
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      setConnectionState(state);
      debugLog("ICE connection state changed", { state });
    };

    pc.onsignalingstatechange = () => {
      debugLog("Signaling state changed");
    };

    getLocalStream()
      .then((stream) => {
        if (cancelled) return;
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        setIsInitialized(true);
      })
      .catch((err) => {
        console.error("❌ Error accessing media devices", err);
      });

    return () => {
      cancelled = true;
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      stopLocalStream();
      pc.close();
      pcRef.current = null;
      debugLog("PeerConnection closed");
    };
  }, []);

  useEffect(() => {
    const pc = pcRef.current;
    if (!remoteSDP || !pc || !isInitialized) return;

    const alreadySet = pc.remoteDescription?.sdp === remoteSDP.sdp;
    if (alreadySet) return;

    const handleRemote = async () => {
      try {
        if (
          pc.signalingState === "have-local-offer" &&
          remoteSDP.type === "answer"
        ) {
          await pc.setRemoteDescription(new RTCSessionDescription(remoteSDP));
          debugLog("✅ Applied remote answer");
        } else if (
          pc.signalingState === "stable" &&
          remoteSDP.type === "offer" &&
          !isCaller &&
          !hasAnswered
        ) {
          await pc.setRemoteDescription(new RTCSessionDescription(remoteSDP));
          debugLog("✅ Applied remote offer, creating answer");

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          onSignal({ type: "answer", sdp: answer });
          setHasAnswered(true);
          debugLog("✅ Sent answer", { answer });
        } else {
          debugLog("❌ Skipped setRemoteDescription", {
            signaling: pc.signalingState,
            type: remoteSDP.type,
          });
        }

        if (pc.remoteDescription) {
          for (const candidate of queuedCandidates) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
              debugLog("✅ Drained ICE candidate", { candidate });
            } catch (err) {
              console.error("❌ Failed to add ICE candidate", err);
            }
          }
          queuedCandidates.length = 0;
        }
      } catch (err) {
        console.error("❌ Failed to apply remote SDP:", err);
      }
    };

    handleRemote();
  }, [remoteSDP, isCaller, isInitialized, onSignal, hasAnswered]);

  // ✅ UPDATED: Send offer immediately, don't wait for full ICE gathering
  useEffect(() => {
    const startCallerFlow = async () => {
      if (!isCaller || !isInitialized) return;
      const pc = pcRef.current;
      if (!pc) return;

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        debugLog("📤 Offer created and sent", { sdp: offer });

        onSignal({ type: "offer", sdp: offer }); // ✅ Send immediately
      } catch (err) {
        console.error("❌ Failed to create/send offer", err);
      }
    };

    startCallerFlow();
  }, [isCaller, isInitialized, onSignal]);

  const toggleVideo = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setVideoEnabled(track.enabled);
    }
  };

  const toggleAudio = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setAudioEnabled(track.enabled);
    }
  };

  const endCall = () => {
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    stopLocalStream();
    const pc = pcRef.current;
    if (pc) {
      pc.getSenders().forEach((sender) => {
        if (sender.track) {
          sender.track.stop();
          pc.removeTrack(sender);
        }
      });
      pc.close();
      pcRef.current = null;
    }
    onEnd?.();
  };

  return (
    <div className="flex flex-col items-center w-full h-screen justify-evenly">
      <div className="grid grid-cols-2 gap-4 w-full h-2/3">
        <div className="relative">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full rounded-2xl shadow-lg object-cover bg-gray-900"
          />
          <div className="absolute top-2 left-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-sm">
            Local {videoEnabled ? "📹" : "📹❌"}
          </div>
        </div>
        <div className="relative">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full rounded-2xl shadow-lg object-cover bg-gray-900"
          />
          <div className="absolute top-2 left-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-sm">
            Remote {hasRemoteVideo ? "📹" : "📹❌"}
          </div>
          {!hasRemoteVideo && (
            <div className="absolute inset-0 flex items-center justify-center text-white text-lg">
              {connectionState === "connected"
                ? "Waiting for remote video..."
                : "Connecting..."}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-4 mt-4 flex-wrap">
        <button
          onClick={toggleVideo}
          className={`px-4 py-2 text-white rounded-xl shadow ${
            videoEnabled ? "bg-blue-500" : "bg-gray-500"
          }`}
        >
          {videoEnabled ? "📹 Camera On" : "📹 Camera Off"}
        </button>
        <button
          onClick={toggleAudio}
          className={`px-4 py-2 text-white rounded-xl shadow ${
            audioEnabled ? "bg-green-500" : "bg-gray-500"
          }`}
        >
          {audioEnabled ? "🎙️ Mic On" : "🎙️ Mic Off"}
        </button>
        <button
          onClick={endCall}
          className="px-4 py-2 bg-red-600 text-white rounded-xl shadow"
        >
          📞 End Call
        </button>
      </div>
    </div>
  );
}
