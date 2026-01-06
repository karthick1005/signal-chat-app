"use client";
import chatStoreInstance from "@/lib/chatStoreInstance";
import { LibSignal } from "@/lib/signal/interface";
import { decryptMessage, generatePreKey, decryptReaction, decryptGroupMessage, decryptGroupReaction } from "@/lib/signal/signal";
import SignalProtocolStore from "@/lib/signal/SignalProtocolStore";
import { SocketInterface } from "@/lib/types";
import { SessionCreation, updatePreKeys } from "@/lib/utils";
import React, { createContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

export const SocketContext = createContext<SocketInterface | null>(null);

export const SocketConsumer = SocketContext.Consumer;

// const serverContext = createContext({
//   chatServer: null,
//   setChatServer: (p0?: unknown) => null,
// });

const SocketProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [handlemessage, setMessages] = useState<number | null>(null);
  // const chatServerContext = useContext(serverContext);

  const connectSocket = () => {
    if (socket||localStorage.getItem("userId")===null) return; // Prevent multiple connections
    console.log("🛜 Connecting to WebSocket...");

    const newSocket = io(process.env.NEXT_PUBLIC_WS || "ws://localhost:8000", {
      path: "/websocket",
      withCredentials: false,
      reconnection: true,
      transports: ["websocket"], // Force WebSocket transport
    });
    newSocket.on("generate_prekey",async(data)=>{
      console.log("🔑 Generating prekey for user:");
      const prekeys=await generatePreKey(Math.floor(Math.random() * 1000000),20)
      await updatePreKeys(localStorage.getItem("userId") || "", prekeys)
    })
    newSocket.on("acknowledge_message",async(data)=>{
      console.log("📬 Message acknowledged:", data);
      if(data.messageId)
      {
      await chatStoreInstance.updateMessage(data.messageId, {
        status: data.status
      });
    }
    else{
      if(data.status === "session_not_found")
      {
        console.error("❌ Session not found for user:", data.senderId);
        let recipient = await chatStoreInstance.getRegistrationId(data.senderId);
        if (recipient) {
          const signalstore = new SignalProtocolStore();
          const libsignal: LibSignal = window.libsignal;
          const address = new libsignal.SignalProtocolAddress(recipient, 1);

          await signalstore.removeSession(address.toString());
          await signalstore.removeIdentityKey(address.toString());
          SessionCreation(data.senderId);
        }
      }
    }
       setMessages(Date.now());
    })
    newSocket.on("new_reaction", async (data) => {
      console.log("📬 New reaction received:", data);
      try {
        const { messageId, encryptedReaction, senderId, room } = data;
        const selectedChat = JSON.parse(localStorage.getItem("selectedChat") || "{}");
        
        let decryptedReaction;
        if (room.startsWith("group_") && selectedChat.groupKey) {
          // Group reaction
          decryptedReaction = await decryptGroupReaction(JSON.parse(encryptedReaction), selectedChat.groupKey);
        } else {
          // Direct reaction
          decryptedReaction = await decryptReaction(JSON.parse(encryptedReaction), senderId);
        }
        
        console.log("📬 Decrypted reaction:", decryptedReaction);
        // Update the message with the reaction in IndexedDB
        // This would require updating the message in the store
      } catch (error) {
        console.error("❌ Error decrypting reaction:", error);
      }
      setMessages(Date.now());
    })
    newSocket.on("group_message", async (data) => {
      console.log("📬 WhatsApp Signal group message received:", data);
      
      // Use the WhatsApp Signal Protocol service to handle incoming messages
      try {
        // Import the service dynamically to avoid circular dependencies
        const { whatsappSignalGroupService } = await import('../lib/whatsappSignalGroupServiceInstance');
        
        // Initialize the service with the socket
        const signalService = whatsappSignalGroupService.initialize(newSocket);
        
        // Handle the incoming group message with Sender Key decryption
        await signalService.handleIncomingGroupMessage(data);
        
        console.log("✅ WhatsApp Signal group message processed successfully");
        
      } catch (error) {
        console.error("❌ Error handling WhatsApp-style group message:", error);
        
        // Fallback to legacy handling for compatibility
        try {
          const { encryptedMessage, senderId, room, messageId, senderName, timestamp } = data;
          const currentUserId = localStorage.getItem("userId");

          // Skip processing sender's own messages (already saved locally)
          if (senderId === currentUserId) {
            console.log("📤 Skipping own group message");
            setMessages(Date.now());
            return;
          }

          console.log("� Using fallback group message handling");
          
          // Save as encrypted placeholder if we can't decrypt
          await chatStoreInstance.saveMessage({
            id: messageId,
            chatId: room,
            senderId: parseInt(senderId),
            text: "[Encrypted Group Message]",
            _creationTime: timestamp || Date.now(),
            read: false,
            sender: {
              _id: senderId,
              name: senderName || "Unknown"
            }
          });
          
        } catch (fallbackError) {
          console.error("❌ Fallback group message handling also failed:", fallbackError);
        }
      }
      
      setMessages(Date.now());
    })
    newSocket.on("message_deleted", async (data) => {
      console.log("📬 Message deleted:", data);
      // Remove the message from the store
      setMessages(Date.now());
    })
    
    // Handle both Sender Key messages and regular direct messages
    newSocket.on("direct_message", async (data) => {
      console.log("📬 Direct message received:", data);
      
      // Check if this is a Sender Key related message by parsing the encryptedMessage
      let isSignalKeyMessage = false;
      try {
        const messageData = JSON.parse(data.encryptedMessage);
        if (messageData.type === 'sender_key_distribution' || messageData.type === 'sender_key_request') {
          console.log(`🔑 Received ${messageData.type}:`, data);
          
          try {
            const { whatsappSignalGroupService } = await import('../lib/whatsappSignalGroupServiceInstance');
            const signalService = whatsappSignalGroupService.initialize(newSocket);
            
            if (messageData.type === 'sender_key_distribution') {
              await signalService.handleSenderKeyDistribution(data);
            } else if (messageData.type === 'sender_key_request') {
              await signalService.handleSenderKeyRequest(data);
            }
            
            console.log(`✅ ${messageData.type} processed successfully`);
            return; // Don't process as regular direct message
            
          } catch (error) {
            console.error(`❌ Error handling ${messageData.type}:`, error);
          }
          isSignalKeyMessage = true;
        }
      } catch (parseError) {
        // Not JSON or not a Sender Key message, continue with regular processing
      }
      
      if (isSignalKeyMessage) {
        return; // Already processed as Sender Key message
      }
      
      // Regular direct message handling
      let recipient = await chatStoreInstance.getRegistrationId(data.senderId);
      console.log("this is recipient before", recipient);
      if (recipient === null || recipient === undefined) {
        const url = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const response = await fetch(url + "/api/user/get-user", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userId: data.senderId }),
        });

        const datas = await response.json();
        await chatStoreInstance.saveRegistrationId(data.senderId, datas.registrationId);
        recipient = datas.registrationId; // update recipient after saving
      }

      console.log("this is recipient", recipient);

      if (recipient !== null && recipient !== undefined) {
        decryptMessage(
          data.encryptedMessage,
          (recipient as number).toString(),
          data.senderName,
          data.senderId
        )
        .then((result) => {
          if (!result) {
            console.error("❌ Decryption returned undefined");
            return;
          }

          const { decryptedText, messageId } = result;
          console.log("📬 New message received:", decryptedText);

          newSocket.emit("acknowledge_message", {
            messageId: messageId,
            senderId: localStorage.getItem("userId"),
            receiverId: data.senderId,
            status: "delivered",
          });

          setMessages(Date.now());
        })
        .catch((error) => {
          const errorMsg = error?.message || "";

          const sessionIssues = [
            "Missing Signed PreKey",
            "Bad MAC",
            "Untrusted identity key",
            "No record",
            "Session key not found"
          ];

          const isSessionIssue = sessionIssues.some(issue => errorMsg.includes(issue));

          if (isSessionIssue) {
            console.warn("⚠️ Session issue detected, notifying sender...");

            newSocket.emit("acknowledge_message", {
              messageId: null,
              senderId: localStorage.getItem("userId"),
              receiverId: data.senderId,
              status: "session_not_found",
            });
          } else {
            console.error("❌ Decryption failed:", errorMsg);
          }
        });
      }

      console.log("📬 Raw message data:", data);

      // Optionally trigger state updates or UI here
    });

    newSocket.on("connect", async () => {
      console.log("✅ Connected to WebSocket");
      const mydata = JSON.parse(localStorage.getItem("preKeyBundle") || "{}");
      newSocket.emit("user_connected", {
        userId: localStorage.getItem("userId"),
        username: localStorage.getItem("username"),
      });

      // Announce user's groups so they can join group rooms (WhatsApp-style)
      try {
        console.log("📢 Announcing user's groups to server...");
        const userGroups = await chatStoreInstance.getAllGroups();
        const groupAnnouncements = userGroups.map((group: any) => ({
          groupId: group.groupId,
          name: group.name
        }));
        
        if (groupAnnouncements.length > 0) {
          newSocket.emit("announce_groups", {
            groups: groupAnnouncements
          });
          console.log(`📢 Announced ${groupAnnouncements.length} groups to server`);
        } else {
          console.log("📢 No groups to announce");
        }
      } catch (error) {
        console.error("❌ Failed to announce groups:", error);
      }
    });
    newSocket.on("disconnect", () =>
      console.log("❌ Disconnected from WebSocket")
    );
    newSocket.on("connect_error", (err) =>
      console.error("⚠️ Connection Error:", err)
    );
    console.log("🛜 WebSocket connected:", newSocket);
    setSocket(newSocket);
  };

  const reconnectSocket = () => {
    if (socket) {
      console.log("🔄 Reconnecting...");
      socket.disconnect();
      setSocket(null);
      connectSocket();
    }
  };

  useEffect(() => {
    connectSocket();

    return () => {
      console.log("🛑 Cleaning up socket...");
      socket?.disconnect();
      setSocket(null);
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    console.log("🚪 Joining room...");
    const data = JSON.parse(localStorage.getItem("preKeyBundle") || "{}");
    if (data) {
      socket.emit("join_room", {
        userId: data.registrationId,
        username: localStorage.getItem("username"),
        room: "hello_girish_udhaya",
      });
    }
    return () => {
      socket.off("join_room"); // Clean up listener to avoid duplication
    };
  }, [socket]);

  return (
    <SocketContext.Provider
      value={{
        socket,
        setSocket,
        reconnectSocket,
        connectSocket,
        handlemessage,
        setMessages,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export default SocketProvider;
