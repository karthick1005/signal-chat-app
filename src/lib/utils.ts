import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import ChatStore from "./signal/ChatStore";
import { createSession, sendMessage } from "./signal/signal";
import chatStoreInstance from "./chatStoreInstance";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}
export function base64ToUint8Array(base64: string): ArrayBuffer {
  const binary = atob(base64); // Throws if base64 is invalid
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i=0; i<bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
// Helper function if not already defined
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

export  const SessionCreation=async (userId) => {
      const url = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
       const response = await fetch(url+'/api/user/details', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId })
    });
    const data=await response.json()
    console.log("this is response",data)
    const reciepentid=await createSession(data as never)
   
   await chatStoreInstance.saveRegistrationId(data.userId,reciepentid)
    }
export const updatePreKeys = async (userId: string, preKeys: any[]) => {
  const url = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const response = await fetch(url + '/api/user/upload-prekeys', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId, preKeys })
  });
  const data = await response.json();
  console.log("this is response", data);
}


export function formatDate(date_ms: number) {
  // Convert milliseconds to seconds
  let date_seconds = date_ms / 1000

  // Convert to Date object
  let date_obj = new Date(date_seconds * 1000)

  // Get current date and time
  let current_date = new Date()
  current_date.setHours(0, 0, 0, 0) // Set hours, minutes, seconds, and milliseconds to 0
  let current_time = current_date.getTime()

  // Get the date part of the provided date
  let provided_date = new Date(date_obj)
  provided_date.setHours(0, 0, 0, 0) // Set hours, minutes, seconds, and milliseconds to 0

  // Check if it's today
  if (provided_date.getTime() === current_time) {
    return date_obj.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
  }

  // Check if it's yesterday
  let yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  yesterday.setHours(0, 0, 0, 0) // Set hours, minutes, seconds, and milliseconds to 0
  if (provided_date.getTime() === yesterday.getTime()) {
    return "Yesterday"
  }

  // Check if it's a different day of the week
  if (provided_date.getDay() < current_date.getDay()) {
    let days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ]
    return days[provided_date.getDay()]
  }

  // If none of the above conditions match, return in a different format
  return (
    provided_date.getMonth() +
    1 +
    "/" +
    provided_date.getDate() +
    "/" +
    provided_date.getFullYear()
  )
}

export const isSameDay = (timestamp1: number, timestamp2: number): boolean => {
  const date1 = new Date(timestamp1)
  const date2 = new Date(timestamp2)
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

// Define getRelativeDateTime function
export const getRelativeDateTime = (message: any, previousMessage: any) => {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const lastWeek = new Date(today)
  lastWeek.setDate(lastWeek.getDate() - 7)

  const messageDate = new Date(message._creationTime)

  if (
    !previousMessage ||
    !isSameDay(previousMessage._creationTime, messageDate.getTime())
  ) {
    if (isSameDay(messageDate.getTime(), today.getTime())) {
      return "Today"
    } else if (isSameDay(messageDate.getTime(), yesterday.getTime())) {
      return "Yesterday"
    } else if (messageDate.getTime() > lastWeek.getTime()) {
      const options: Intl.DateTimeFormatOptions = {
        weekday: "long",
      }
      return messageDate.toLocaleDateString(undefined, options)
    } else {
      const options: Intl.DateTimeFormatOptions = {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }
      return messageDate.toLocaleDateString(undefined, options)
    }
  }
}

export function randomID(len: number) {
  let result = ""
  if (result) return result
  var chars = "12345qwertyuiopasdfgh67890jklmnbvcxzMNBVCZXASDQWERTYHGFUIOLKJP",
    maxPos = chars.length,
    i
  len = len || 5
  for (i = 0; i < len; i++) {
    result += chars.charAt(Math.floor(Math.random() * maxPos))
  }
  return result
}

export function getMe() {
  if (typeof window === 'undefined') {
    return { _id: null, name: null }; // SSR-safe fallback
  }

  return {
    _id: localStorage.getItem("userId"),
    name: localStorage.getItem("username"),
  };
}

export const encryptFileAES = async (file: File) => {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV

  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  const fileBuffer = await file.arrayBuffer();

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    fileBuffer
  );

  // Export key to raw format and convert to base64
  const exportedKey = await crypto.subtle.exportKey("raw", key);
  const keyBase64 = btoa(String.fromCharCode(...new Uint8Array(exportedKey)));

  // Convert IV to base64
  const ivBase64 = btoa(String.fromCharCode(...iv));

  return {
    encryptedData: new Uint8Array(encrypted),
    iv: ivBase64,
    key: keyBase64,
  };
};

interface HandleMessage{
  ( selectedChat: any, msgText: string, socket: any,path:string): Promise<void>;
}
export const HandleSendMessage:HandleMessage=async(selectedChat,msgText,socket,path,iscall=false)=>{
  try{
     const recipientid = await chatStoreInstance.getRegistrationId(selectedChat?.chatId);
        const cipher_text = await sendMessage(
          recipientid,
         msgText,
          JSON.parse(localStorage.getItem("preKeyBundle") || "{}")
            .registrationId,
         selectedChat?.chatId,
         iscall
        //  "text"
        );
          socket?.emit(path, {
          encryptedMessage: cipher_text,
          receiverId: selectedChat?.chatId,
          senderId: localStorage.getItem("userId"),
          senderName: localStorage.getItem("username"),
          // messageType: "text"
        });
        if(!iscall){
    await chatStoreInstance.updateMessage(cipher_text.messageId, {
          status: "sent",
        });
      }
      }catch (error: any) {
        console.error("Error sending message:", error);
        throw new Error(error.message || "Failed to send message");
      }
}

export const decryptFileFromUrlAndGetUrl = async ({
  encryptedFileUrl,
  key,
  iv,
  mimeType = "application/octet-stream",
}: {
  encryptedFileUrl: string;
  key: string; // base64 string
  iv: string;  // base64 string
  mimeType?: string;
}): Promise<string> => {
  try {
    // Decode base64 key and iv
    const keyBuffer = Uint8Array.from(atob(key), c => c.charCodeAt(0));
    const ivBuffer = Uint8Array.from(atob(iv), c => c.charCodeAt(0));

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyBuffer,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );

    // Use backend proxy to bypass CORS
    const proxyUrl = `http://localhost:8000/api/user/proxy?url=${encodeURIComponent(encryptedFileUrl)}`;
    const response = await fetch(proxyUrl);
    const encryptedArrayBuffer = await response.arrayBuffer();

    // Decrypt
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: ivBuffer,
      },
      cryptoKey,
      encryptedArrayBuffer
    );

    const decryptedBlob = new Blob([decryptedBuffer], { type: mimeType });
    console.log("Decrypted Blob:", decryptedBlob);
    return URL.createObjectURL(decryptedBlob);
  } catch (error) {
    console.error("Decryption failed:", error);
    throw new Error("Decryption failed");
  }
};



