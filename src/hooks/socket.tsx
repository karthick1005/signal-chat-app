"use client";
import chatStoreInstance from "@/lib/chatStoreInstance";
import { LibSignal } from "@/lib/signal/interface";
import { decryptMessage, generatePreKey } from "@/lib/signal/signal";
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
      await updatePreKeys(localStorage.getItem("userId"),prekeys)
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
        const signalstore=new SignalProtocolStore()
          const libsignal: LibSignal =window.libsignal;
        const address = new libsignal.SignalProtocolAddress(recipient, 1);

        await signalstore.removeSession(address.toString());
        await signalstore.removeIdentityKey(address.toString());
        SessionCreation(data.senderId)
      }
    }
       setMessages(Date.now());
    })
    newSocket.on("direct_message", async (data) => {
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

      // decryptMessage(
      //   data.encryptedMessage,
      //   recipient,
      //   data.senderName,
      //   data.senderId
      // )
      //   .then((result) => {
      //     if (!result) {
      //       console.error("❌ Decryption returned undefined");
      //       return;
      //     }
      //     const { decryptedText, messageId } = result;
      //     console.log("📬 New message received:", decryptedText);
      //     newSocket.emit("acknowledge_message", {
      //       messageId: messageId,
      //       senderId:localStorage.getItem("userId"),
      //       receiverId: data.senderId,
      //       status: "delivered",
      //     });
      //     setMessages(Date.now());
      //   })
      //   .catch((error) => {

      //     console.log(typeof error, error.message);
      //     if(error.message.includes("No record") || error.message.includes("Missing Signed PreKey for PreKeyWhisperMessage"))
      //     {
      //       console.log("hello sending back")
      //        newSocket.emit("acknowledge_message", {
      //       messageId: null,
      //       senderId:localStorage.getItem("userId"),
      //       receiverId: data.senderId,
      //       status: "session_not_found",
      //     });

      //     }
      //   });
decryptMessage(
  data.encryptedMessage,
  recipient,
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

      console.log("📬 Raw message data:", data);

      // Optionally trigger state updates or UI here
    });

    newSocket.on("connect", () => {
      console.log("✅ Connected to WebSocket");
      const mydata = JSON.parse(localStorage.getItem("preKeyBundle") || "{}");
      newSocket.emit("user_connected", {
        userId: localStorage.getItem("userId"),
        username: localStorage.getItem("username"),
      });
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
