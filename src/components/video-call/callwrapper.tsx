import { useContext, useEffect, useRef, useState } from "react";
import { SocketContext } from "@/hooks/socket";
import VideoCall from "./video-ui-kit";
import { HandleSendMessage } from "@/lib/utils";
import { useConversationStore } from "@/store/chat-store";
import { decryptMessage } from "@/lib/signal/signal";
import chatStoreInstance from "@/lib/chatStoreInstance";
import { Phone, PhoneOff } from "lucide-react";

export default function CallWrapper({ userId }: { userId: string }) {
  const { socket } = useContext(SocketContext) || {};
  const { selectedChat, setSelectedChat } = useConversationStore();

  const [remoteSDP, setRemoteSDP] = useState<RTCSessionDescriptionInit>();
  const [isCaller, setIsCaller] = useState(false);
  const [callVisible, setCallVisible] = useState(false);
  const [incomingCall, setIncomingCall] = useState<any | null>(null);
  const [incomingChatInfo, setIncomingChatInfo] = useState<any | null>(null);
  const [peerId, setPeerId] = useState("");
  const [callId, setCallId] = useState("");

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const iceCandidateQueue = useRef<RTCIceCandidateInit[]>([]);
  const addedCandidates = useRef<Set<string>>(new Set());

  // Trigger outgoing call via global event
  useEffect(() => {
    const onStartCall = () => {
      if (!selectedChat) return;
      setPeerId(selectedChat.chatId);
      setIsCaller(true);
      setCallVisible(true);
      setCallId(crypto.randomUUID());
    };
    window.addEventListener("start-call", onStartCall);
    return () => window.removeEventListener("start-call", onStartCall);
  }, [selectedChat]);

  // Handle incoming socket signal
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
        console.log("🔔 Received direct_call message:", message);
        if (message.messageType === "decline") {
          console.log("Call declined by peer");
         handleCallEnd()
         return
        }
        setPeerId(message.from);

       
        if (message.type === "offer") {
          setIncomingCall(message);
          setCallId(message.callId);

          // Set fallback chat info
          setIncomingChatInfo({
            chatId: message.from,
            name: data.senderName,
            image: data.senderImage || "/placeholder.png",
            isGroup: false,
          });
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

  // Send signal (offer/answer/ICE)
  const handleSignal = (data: any) => {
    const targetChat = selectedChat || incomingChatInfo;
    if (!peerId || !targetChat) {
      console.warn("No peer or chat context found");
      return;
    }

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

    HandleSendMessage(targetChat, JSON.stringify(message), socket, "direct_call", true);
  };

  const handleCallEnd = () => {
      const targetChat = selectedChat || incomingChatInfo;
     HandleSendMessage(targetChat, JSON.stringify({messageType:"decline"}), socket, "direct_call", true);
    setCallVisible(false);
    setRemoteSDP(undefined);
    setIsCaller(false);
    setIncomingCall(null);
    setIncomingChatInfo(null);
    setPeerId("");
    setCallId("");
    pcRef.current = null;
    iceCandidateQueue.current = [];
    addedCandidates.current.clear();
  };

  const handleAnswer = () => {
    if (!incomingCall) return;

    setRemoteSDP(incomingCall.sdp);
    setIsCaller(false);
    setCallVisible(true);
    setIncomingCall(null);

    // If user hasn't selected the chat yet, preload it
    if (!selectedChat && incomingChatInfo) {
      setSelectedChat(incomingChatInfo);
    }
  };

  const handleDecline = () => {
    setIncomingCall(null);
    setIncomingChatInfo(null);
    setPeerId("");
     const targetChat = selectedChat || incomingChatInfo;
     HandleSendMessage(targetChat, JSON.stringify({messageType:"decline"}), socket, "direct_call", true);
  };

  return (
    <div className="z-[51]">
      {/* Incoming Call UI */}
      {incomingCall && !callVisible && (
<div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 border border-white bg-[#111B22] shadow-md rounded-md p-4 z-50">
          <p className="mb-2">
            📞 Incoming call from {incomingChatInfo?.name || "Unknown"}
          </p>
          <div className="flex gap-3">
            <button
              className="bg-green-500 text-white px-4 py-1 rounded-md flex items-center gap-2"
              onClick={handleAnswer}
            >
              <Phone size={16} /> Answer
            </button>
            <button
              className="bg-red-500 text-white px-4 py-1 rounded-md flex items-center gap-2"
              onClick={handleDecline}
            >
              <PhoneOff size={16} /> Decline
            </button>
          </div>
        </div>
      )}

      {/* Video Call UI */}
      {callVisible && (
        <div className="h-full flex flex-col justify-center items-center absolute top-0 left-0 w-full bg-black bg-opacity-50 z-50">
          <VideoCall
            isCaller={isCaller}
            remoteSDP={remoteSDP}
            onSignal={handleSignal}
            onEnd={handleCallEnd}
            queuedCandidates={iceCandidateQueue.current}
            onPeerConnection={(pc) => (pcRef.current = pc)}
          />
        </div>
      )}
    </div>
  );
}
