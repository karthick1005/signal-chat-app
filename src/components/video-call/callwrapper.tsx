import { useContext, useEffect, useRef, useState } from "react";
import { SocketContext } from "@/hooks/socket";
import VideoCall from "./video-ui-kit";
import { HandleSendMessage } from "@/lib/utils";
import { useConversationStore } from "@/store/chat-store";
import { decryptMessage } from "@/lib/signal/signal";
import chatStoreInstance from "@/lib/chatStoreInstance";

export default function CallWrapper({ userId, callId, onCallEnd,startcall=false,stopcall }: any) {
  const { socket } = useContext(SocketContext) || {};
  const { selectedChat } = useConversationStore();

  const [remoteSDP, setRemoteSDP] = useState<RTCSessionDescriptionInit>();
  const [isCaller, setIsCaller] = useState(false);
  const [startCallUI, setStartCallUI] = useState(false);
  const [peerId, setPeerId] = useState("");

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const iceCandidateQueue = useRef<RTCIceCandidateInit[]>([]);
  const addedCandidates = useRef<Set<string>>(new Set());
const activeStreams: MediaStream[] = [];
let cachedStream: MediaStream | null = null;

// navigator.mediaDevices.getUserMedia = (originalGetUserMedia => {
//   return function (constraints) {
//     console.trace("🎥 getUserMedia called with:", constraints);

//     if (cachedStream) {
//       console.log("🔁 Reusing existing MediaStream:", cachedStream.id);
//       return Promise.resolve(cachedStream);
//     }

//     return originalGetUserMedia.call(this, constraints).then(stream => {
//       cachedStream = stream;
//       activeStreams.push(stream);

//       console.log("🎥 New MediaStream created:", stream.id);
//       stream.getTracks().forEach(track => {
//         console.log(`  📡 ${track.kind} track created:`, track.id);
//       });

//       return stream;
//     });
//   };
// })(navigator.mediaDevices.getUserMedia);

  useEffect(() => {
    if (!socket) return;

    const handleIncomingSignal = async (data: any) => {
      try {
     
        const recipient = await chatStoreInstance.getRegistrationId(data.senderId);
        const result = await decryptMessage(
          data.encryptedMessage,
          recipient,
          data.senderName,
          data.senderId,
          true
        );
        const message = JSON.parse(result.decryptedText);

        setPeerId(message.from);

        if (message.type === "offer") {
          setIsCaller(false);
  setStartCallUI(true);
  setTimeout(() => {
    setRemoteSDP(message.sdp);
  }, 0);
        }

        if (message.type === "answer") {
          setRemoteSDP(message.sdp);
        }

        if (message.type === "ice-candidate") {
          const key = JSON.stringify(message.candidate);
          if (!addedCandidates.current.has(key)) {
            addedCandidates.current.add(key);
            if (pcRef.current?.remoteDescription) {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(message.candidate));
            } else {
              iceCandidateQueue.current.push(message.candidate);
            }
          }
        }
      } catch (err) {
        console.error("Error handling direct_call:", err);
      }
    };

    socket.on("direct_call", handleIncomingSignal);
    return () => socket.off("direct_call", handleIncomingSignal);
  }, [socket]);

  const handleSignal = (data: any) => {
    if (!peerId || !selectedChat) return;
    console.log("Sending signal:", data.type);
    const message = {
      type: data.type,
      sdp: data.sdp,
      candidate: data.candidate,
      from: userId,
      to: peerId,
      callId,
      timestamp: Date.now(),
      messageType: "call",
    };

    HandleSendMessage(selectedChat, JSON.stringify(message), socket, "direct_call", true);
  };

  const handleCallEnd = () => {
    setRemoteSDP(undefined);
    setIsCaller(false);
    setStartCallUI(false);
    setPeerId("");
    iceCandidateQueue.current = [];
    addedCandidates.current.clear();
    pcRef.current = null;
    console.log("Ending call and cleaning up...",activeStreams);
    stopcall(false)
  //    activeStreams.forEach(stream => {
  //   stream.getTracks().forEach(track => {
  //     track.stop();
  //     console.log(`🛑 Stopped ${track.kind} track:`, track.id);
  //   });
  // });
  // activeStreams.length = 0; // Clear the tracker
    onCallEnd?.();
    // forceIndicatorUpdate();
  };
  useEffect(()=>{
    if (!startcall) return;
    handleStartCall()
  },[startcall])
  const handleStartCall = () => {
    if (!selectedChat?.chatId) return;
    setPeerId(selectedChat.chatId);
    setIsCaller(true);
    setStartCallUI(true);
  };

  return (
    <div className="h-full flex flex-col justify-center items-center absolute top-0 left-0 w-full bg-black bg-opacity-50 z-50">
      {startCallUI &&
        <VideoCall
          isCaller={isCaller}
          remoteSDP={remoteSDP}
          onSignal={handleSignal}
          onEnd={handleCallEnd}
          queuedCandidates={iceCandidateQueue.current}
          onPeerConnection={(pc) => (pcRef.current = pc)}
        />
      }
    </div>
  );
}
