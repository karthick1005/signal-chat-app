import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import ChatStore from "./signal/ChatStore";
import { createSession, sendMessage, encryptReaction, encryptGroupReaction, encryptGroupMessage } from "./signal/signal";
import chatStoreInstance from "./chatStoreInstance";
import { v4 as uuidv4 } from "uuid";
import { whatsappSignalGroupService } from './whatsappSignalGroupServiceInstance';

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
   await chatStoreInstance.addChatMeta(userId,data?.username,data?.avatar)
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
    const isGroup = selectedChat?.isGroup;
    
    if (isGroup) {
      console.log('📤 Handling WhatsApp-style group message...');
      console.log('🔍 Debug selectedChat:', {
        chatId: selectedChat.chatId,
        isGroup: selectedChat.isGroup,
        hasGroupKey: !!selectedChat.groupKey,
        groupKeyLength: selectedChat.groupKey?.length,
        groupKeyFirst10: selectedChat.groupKey?.substring(0, 10),
        groupKeyIsString: typeof selectedChat.groupKey === 'string'
      });
      
      // Use WhatsApp Signal Protocol group message service
      const signalGroupService = whatsappSignalGroupService.initialize(socket);
      
      // Extract text if msgText is JSON
      let textToSend = msgText;
      try {
        const parsed = JSON.parse(msgText);
        textToSend = parsed.text || msgText;
      } catch {
        textToSend = msgText;
      }

      const currentUserId = localStorage.getItem("userId") || "0";
      const currentUsername = localStorage.getItem("username") || "You";
      
      // Debug: Let's also check what's in the ChatStore for this group
      const groupMetaFromStore = await chatStoreInstance.getGroupMeta(selectedChat.chatId);
      console.log('🔍 Debug group from ChatStore:', {
        found: !!groupMetaFromStore,
        hasGroupKey: !!groupMetaFromStore?.groupKey,
        keyLength: groupMetaFromStore?.groupKey?.length,
        keyFirst10: groupMetaFromStore?.groupKey?.substring(0, 10),
        keyIsString: typeof groupMetaFromStore?.groupKey === 'string'
      });
      
      console.log(`🔑 Using WhatsApp Signal Protocol for group: ${selectedChat.chatId}`);
      
      // Send through WhatsApp Signal Protocol service (Sender Keys)
      await signalGroupService.sendGroupMessage(
        selectedChat.chatId,
        textToSend,
        'text'
      );
      
      console.log('✅ WhatsApp Signal group message sent successfully');
      
    } else {
      // Direct message - existing logic
      const recipientid = await chatStoreInstance.getRegistrationId(selectedChat?.chatId);
      if (!recipientid) {
        throw new Error("Recipient not found");
      }
      const cipher_text = await sendMessage(
        recipientid,
       msgText,
        JSON.parse(localStorage.getItem("preKeyBundle") || "{}")
          .registrationId,
       selectedChat?.chatId,
       iscall
      );
      socket?.emit(path, {
        encryptedMessage: cipher_text,
        receiverId: selectedChat?.chatId,
        senderId: localStorage.getItem("userId"),
        senderName: localStorage.getItem("username"),
      });
      if(!iscall){
        await chatStoreInstance.updateMessage(cipher_text.messageId, {
          status: "sent",
        });
      }
    }
  }catch (error: any) {
    console.error("❌ Error sending message:", error);
    console.error("Error details:", {
      selectedChat: selectedChat?.chatId,
      isGroup: selectedChat?.isGroup,
      hasGroupKey: !!selectedChat?.groupKey,
      msgText: msgText?.substring(0, 50) + '...'
    });
    throw new Error(error.message || "Failed to send message");
  }
}

export const HandleSendReaction = async (messageId: string, reaction: { userId: string; emoji: string }, selectedChat: any, socket: any, isGroup: boolean, groupKey?: string) => {
  try {
    let encryptedReaction;
    if (isGroup && groupKey) {
      encryptedReaction = await encryptGroupReaction(reaction, groupKey);
    } else {
      const recipientid = await chatStoreInstance.getRegistrationId(selectedChat?.chatId);
      if (!recipientid) {
        throw new Error("Recipient not found");
      }
      encryptedReaction = await encryptReaction(reaction, recipientid, localStorage.getItem("userId")!);
    }

    socket?.emit("send_reaction", {
      messageId,
      encryptedReaction: JSON.stringify(encryptedReaction),
      senderId: localStorage.getItem("userId"),
      room: isGroup ? selectedChat.chatId : selectedChat.chatId,
    });
  } catch (error: any) {
    console.error("Error sending reaction:", error);
    throw new Error(error.message || "Failed to send reaction");
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

// 🛠️ Utility function to clear corrupted IndexedDB data
export const clearIndexedDBData = async (): Promise<void> => {
  try {
    const databases = ['signalstore', 'senderkeys', 'ChatStore'];
    
    for (const dbName of databases) {
      try {
        await new Promise<void>((resolve, reject) => {
          const deleteRequest = indexedDB.deleteDatabase(dbName);
          deleteRequest.onsuccess = () => {
            console.log(`✅ Cleared IndexedDB: ${dbName}`);
            resolve();
          };
          deleteRequest.onerror = () => {
            console.warn(`⚠️ Failed to clear IndexedDB: ${dbName}`);
            resolve(); // Don't fail completely if one DB fails
          };
          deleteRequest.onblocked = () => {
            console.warn(`🚫 IndexedDB deletion blocked: ${dbName}`);
            resolve();
          };
        });
      } catch (error) {
        console.warn(`Error clearing ${dbName}:`, error);
      }
    }
    
    // Also clear localStorage keys related to Signal
    const keysToRemove = ['preKeyBundle', 'username', 'userId', 'token'];
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);
        console.log(`✅ Cleared localStorage: ${key}`);
      } catch (error) {
        console.warn(`Failed to clear localStorage ${key}:`, error);
      }
    });
    
    console.log('🧹 IndexedDB and localStorage cleanup completed');
  } catch (error) {
    console.error('Failed to clear IndexedDB data:', error);
    throw error;
  }
};

// 🚀 Check if IndexedDB is available and working
export const checkIndexedDBSupport = async (): Promise<boolean> => {
  try {
    if (!window.indexedDB) {
      return false;
    }
    
    // Try to open a test database
    const testDB = await new Promise<boolean>((resolve) => {
      const request = indexedDB.open('test-db', 1);
      request.onsuccess = () => {
        request.result.close();
        indexedDB.deleteDatabase('test-db');
        resolve(true);
      };
      request.onerror = () => resolve(false);
      request.onblocked = () => resolve(false);
    });
    
    return testDB;
  } catch (error) {
    console.error('IndexedDB support check failed:', error);
    return false;
  }
};



