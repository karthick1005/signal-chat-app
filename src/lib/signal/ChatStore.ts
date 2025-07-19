// class ChatStore {
//   private dbName = "ChatStore";
//   private messageStore = "Messages";
//   private chatMetaStore = "ChatMeta";
//   private registrationMapStore = "UserRegistrationMap";
//   private encryptionKey: CryptoKey | null = null;

//   constructor() {
//     this.initDB();
//     this.generateKey();
//   }

//   // Generate and store encryption key
//   private async saveKey(key: CryptoKey) {
//     const raw = await crypto.subtle.exportKey("raw", key);
//     const base64Key = this.arrayBufferToBase64(raw);
//     localStorage.setItem("chatEncryptionKey", base64Key);
//   }

//   private async loadKey(): Promise<CryptoKey | null> {
//     const base64Key = localStorage.getItem("chatEncryptionKey");
//     if (!base64Key) return null;
//     const raw = this.base64ToArrayBuffer(base64Key);
//     return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
//   }

//   private async generateKey() {
//     const storedKey = await this.loadKey();
//     if (storedKey) {
//       this.encryptionKey = storedKey;
//     } else {
//       this.encryptionKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
//       await this.saveKey(this.encryptionKey);
//     }
//   }

//   // IndexedDB init with registrationMap store
//   private async initDB(): Promise<IDBDatabase> {
//     return new Promise((resolve, reject) => {
//       const request = indexedDB.open(this.dbName, 1);

//       request.onupgradeneeded = (event) => {
//         const db = (event.target as IDBOpenDBRequest).result;
//         if (!db.objectStoreNames.contains(this.messageStore)) {
//           db.createObjectStore(this.messageStore, { keyPath: "id" });
//         }
//         if (!db.objectStoreNames.contains(this.chatMetaStore)) {
//           db.createObjectStore(this.chatMetaStore, { keyPath: "chatId" });
//         }
//         if (!db.objectStoreNames.contains(this.registrationMapStore)) {
//           db.createObjectStore(this.registrationMapStore, { keyPath: "userId" });
//         }
//       };

//       request.onsuccess = () => resolve(request.result);
//       request.onerror = () => reject(request.error);
//     });
//   }

//   private async getDB(): Promise<IDBDatabase> {
//     return this.initDB();
//   }

//   // ----------- 🔐 Encryption Helpers -----------

//   private arrayBufferToBase64(buffer: ArrayBuffer): string {
//     const bytes = new Uint8Array(buffer);
//     let binary = "";
//     for (const b of bytes) binary += String.fromCharCode(b);
//     return btoa(binary);
//   }

//   private base64ToArrayBuffer(base64: string): ArrayBuffer {
//     const binary = atob(base64);
//     const bytes = new Uint8Array(binary.length);
//     for (let i = 0; i < binary.length; i++) {
//       bytes[i] = binary.charCodeAt(i);
//     }
//     return bytes.buffer;
//   }

//   private async encryptText(text: string): Promise<{ ciphertext: string; iv: string }> {
//     if (!this.encryptionKey) throw new Error("Encryption key not ready");
//     const iv = crypto.getRandomValues(new Uint8Array(12));
//     const encoded = new TextEncoder().encode(text);
//     const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, this.encryptionKey, encoded);
//     return {
//       ciphertext: this.arrayBufferToBase64(encrypted),
//       iv: this.arrayBufferToBase64(iv.buffer),
//     };
//   }

//   private async decryptText(ciphertext: string, iv: string): Promise<string> {
//     if (!this.encryptionKey) throw new Error("Encryption key not ready");
//     const encryptedBuffer = this.base64ToArrayBuffer(ciphertext);
//     const ivBuffer = this.base64ToArrayBuffer(iv);
//     const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: ivBuffer }, this.encryptionKey, encryptedBuffer);
//     return new TextDecoder().decode(decrypted);
//   }

//   // ----------- 💬 Message & Chat Meta -----------
// //   // Get chat meta by id, decrypt lastMessage
//   async getChatMeta(chatId: string): Promise<{
//     chatId: string;
//     lastMessage: string;
//     lastTimestamp: number;
//     unreadCount: number;
//     name: string;
//     avatar: string;
//   } | null> {
//     if (!this.encryptionKey) await this.generateKey();

//     const db = await this.getDB();

//     return new Promise((resolve, reject) => {
//       const tx = db.transaction(this.chatMetaStore, "readonly");
//       const store = tx.objectStore(this.chatMetaStore);

//       const request = store.get(chatId);

//       request.onsuccess = async () => {
//         if (request.result) {
//           try {
//             const meta = request.result;
//             if (meta.lastMessage && meta.lastMessageIV) {
//               meta.lastMessage = await this.decryptText(meta.lastMessage, meta.lastMessageIV);
//             }
//             resolve(meta);
//           } catch (e) {
//             reject(e);
//           }
//         } else {
//           resolve(null);
//         }
//       };

//       request.onerror = () => reject(request.error);
//     });
//   }
//   async saveMessage(message: {
//     id:string
//     chatId: string;
//     senderId: number;
//     text: string;
//     timestamp: number;
//     read?: boolean;
//     senderName?: string;
//     status?: "sent" | "delivered" | "read";
//   }): Promise<void> {
//     if (!this.encryptionKey) await this.generateKey();
//     const db = await this.getDB();
//     const { ciphertext: encryptedText, iv: messageIV } = await this.encryptText(message.text);
//     const { ciphertext: lastMessageCiphertext, iv: lastMessageIV } = await this.encryptText(message.text);

//     return new Promise((resolve, reject) => {
//       const tx = db.transaction([this.messageStore, this.chatMetaStore], "readwrite");
//       const messageStore = tx.objectStore(this.messageStore);
//       const chatMetaStore = tx.objectStore(this.chatMetaStore);

//       const messageWithRead = {
//         ...message,
//         text: encryptedText,
//         iv: messageIV,
//         read: message.read ?? false,
//       };

//       const addRequest = messageStore.add(messageWithRead);
//       addRequest.onsuccess = () => {
//         const getMetaRequest = chatMetaStore.get(message.chatId);
//         getMetaRequest.onsuccess = () => {
//           let meta = getMetaRequest.result;
//           if (!meta) {
//             meta = {
//               chatId: message.chatId,
//               lastMessage: lastMessageCiphertext,
//               lastMessageIV,
//               lastTimestamp: message.timestamp,
//               unreadCount: message.read ? 0 : 1,
//               name: message.senderName || "Unknown",
//               avatar: "/placeholder.svg",
//             };
//           } else {
//             meta.lastMessage = lastMessageCiphertext;
//             meta.lastMessageIV = lastMessageIV;
//             meta.lastTimestamp = message.timestamp;
//             if (!message.read) {
//               meta.unreadCount = (meta.unreadCount || 0) + 1;
//             }
//           }
//           chatMetaStore.put(meta);
//           resolve();
//         };
//         getMetaRequest.onerror = () => reject(getMetaRequest.error);
//       };
//       addRequest.onerror = () => reject(addRequest.error);
//     });
//   }
// async updateMessage(
//   messageId: string,
//   updates: Partial<{
//     text: string;
//     iv: string;
//     timestamp: number;
//     read: boolean;
//     senderName: string;
//     status: "sent" | "delivered" | "read";
//   }>
// ): Promise<void> {
//   const db = await this.getDB();

//   return new Promise((resolve, reject) => {
//     const tx = db.transaction([this.messageStore], "readwrite");
//     const messageStore = tx.objectStore(this.messageStore);

//     const getRequest = messageStore.get(messageId);

//     getRequest.onsuccess = () => {
//       const existing = getRequest.result;

//       if (!existing) {
//         reject(new Error("Message not found"));
//         return;
//       }

//       const updatedMessage = { ...existing, ...updates };

//       const putRequest = messageStore.put(updatedMessage);

//       putRequest.onsuccess = () => resolve();
//       putRequest.onerror = () => reject(putRequest.error);
//     };

//     getRequest.onerror = () => reject(getRequest.error);
//   });
// }

//   async updateChatMetaCount(chatId: string, unreadCountDelta: number): Promise<void> {
//     const db = await this.getDB();
//     return new Promise((resolve, reject) => {
//       const tx = db.transaction(this.chatMetaStore, "readwrite");
//       const store = tx.objectStore(this.chatMetaStore);
//       const request = store.get(chatId);
//       request.onsuccess = () => {
//         const meta = request.result;
//         if (meta) {
//           meta.unreadCount = unreadCountDelta;
//           store.put(meta);
//         }
//         resolve();
//       };
//       request.onerror = () => reject(request.error);
//     });
//   }

//   async updateChatMeta(
//     chatId: string,
//     lastMessage: string,
//     timestamp: number,
//     unreadCountDelta: number
//   ): Promise<void> {
//     if (!this.encryptionKey) await this.generateKey();
//     const db = await this.getDB();
//     const { ciphertext, iv } = await this.encryptText(lastMessage);
//     return new Promise((resolve, reject) => {
//       const tx = db.transaction(this.chatMetaStore, "readwrite");
//       const store = tx.objectStore(this.chatMetaStore);
//       const getRequest = store.get(chatId);
//       getRequest.onsuccess = () => {
//         let meta = getRequest.result || {
//           chatId,
//           lastMessage: ciphertext,
//           lastMessageIV: iv,
//           lastTimestamp: timestamp,
//           unreadCount: unreadCountDelta,
//         };
//         meta.lastMessage = ciphertext;
//         meta.lastMessageIV = iv;
//         meta.lastTimestamp = timestamp;
//         meta.unreadCount = Math.max((meta.unreadCount || 0) + unreadCountDelta, 0);
//         store.put(meta);
//       };
//       tx.oncomplete = () => resolve();
//       tx.onerror = () => reject(tx.error);
//     });
//   }

//   async getAllChats() {
//     if (!this.encryptionKey) await this.generateKey();
//     const db = await this.getDB();
//     return new Promise((resolve, reject) => {
//       const tx = db.transaction(this.chatMetaStore, "readonly");
//       const store = tx.objectStore(this.chatMetaStore);
//       const chats: any[] = [];
//       const request = store.openCursor();

//       request.onsuccess = async (event) => {
//         const cursor = (event.target as IDBRequest).result;
//         if (cursor) {
//           chats.push(cursor.value);
//           cursor.continue();
//         } else {
//           try {
//             for (const chat of chats) {
//               if (chat.lastMessage && chat.lastMessageIV) {
//                 chat.lastMessage = await this.decryptText(chat.lastMessage, chat.lastMessageIV);
//               }
//             }
//             chats.sort((a, b) => b.lastTimestamp - a.lastTimestamp);
//             resolve(chats);
//           } catch (e) {
//             reject(e);
//           }
//         }
//       };
//       request.onerror = () => reject(request.error);
//     });
//   }

//   async getMessages(chatId: string) {
//     if (!this.encryptionKey) await this.generateKey();
//     const db = await this.getDB();
//     return new Promise((resolve, reject) => {
//       const tx = db.transaction(this.messageStore, "readonly");
//       const store = tx.objectStore(this.messageStore);
//       const messages: any[] = [];
//       const request = store.openCursor();
//       request.onsuccess = async (event) => {
//         const cursor = (event.target as IDBRequest).result;
//         if (cursor) {
//           const message = cursor.value;
//           if (message.chatId === chatId) {
//             messages.push(message);
//           }
//           cursor.continue();
//         } else {
//           try {
//             for (const msg of messages) {
//               if (msg.text && msg.iv) {
//                 msg.text = await this.decryptText(msg.text, msg.iv);
//               }
//             }
//             messages.sort((a, b) => a.timestamp - b.timestamp);
//             resolve(messages);
//           } catch (e) {
//             reject(e);
//           }
//         }
//       };
//       request.onerror = () => reject(request.error);
//     });
//   }

//   async markMessagesRead(chatId: string): Promise<void> {
//     const db = await this.getDB();
//     return new Promise((resolve, reject) => {
//       const tx = db.transaction(this.messageStore, "readwrite");
//       const store = tx.objectStore(this.messageStore);
//       const request = store.openCursor();
//       request.onsuccess = (event) => {
//         const cursor = (event.target as IDBRequest).result;
//         if (cursor) {
//           const message = cursor.value;
//           if (message.chatId === chatId && !message.read) {
//             message.read = true;
//             cursor.update(message);
//           }
//           cursor.continue();
//         } else {
//           resolve();
//         }
//       };
//       request.onerror = () => reject(request.error);
//     });
//   }

//   // ----------- ✅ Registration ID Mapping -----------

//   async saveRegistrationId(userId: string, registrationId: number): Promise<void> {
//     const db = await this.getDB();
//     return new Promise((resolve, reject) => {
//       const tx = db.transaction(this.registrationMapStore, "readwrite");
//       const store = tx.objectStore(this.registrationMapStore);
//       const putRequest = store.put({ userId, registrationId });
//       putRequest.onsuccess = () => resolve();
//       putRequest.onerror = () => reject(putRequest.error);
//     });
//   }

//   async getRegistrationId(userId: string): Promise<number | null> {
//     const db = await this.getDB();
//     return new Promise((resolve, reject) => {
//       const tx = db.transaction(this.registrationMapStore, "readonly");
//       const store = tx.objectStore(this.registrationMapStore);
//       const getRequest = store.get(userId);
//       getRequest.onsuccess = () => {
//         if (getRequest.result) {
//           resolve(getRequest.result.registrationId);
//         } else {
//           resolve(null);
//         }
//       };
//       getRequest.onerror = () => reject(getRequest.error);
//     });
//   }
// }

// export default ChatStore;
// lib/ChatStore.ts

type ChatStoreListener = () => void;

export default class ChatStore {
  private dbName = "ChatStore";
  private messageStore = "Messages";
  private chatMetaStore = "ChatMeta";
  private registrationMapStore = "UserRegistrationMap";
  private encryptionKey: CryptoKey | null = null;

  private listeners: ChatStoreListener[] = [];

  constructor() {
    this.initDB();
    this.generateKey();
  }

  // --- 🔔 Subscription System ---
  subscribe(listener: ChatStoreListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    console.log("📣 ChatStore.notify() called — listeners:", this.listeners.length);
    for (const listener of this.listeners) {
      
      listener();
    }
  }

  // --- 🔐 Encryption Key Handling ---
  private async saveKey(key: CryptoKey) {
    const raw = await crypto.subtle.exportKey("raw", key);
    const base64Key = this.arrayBufferToBase64(raw);
    localStorage.setItem("chatEncryptionKey", base64Key);
  }

  private async loadKey(): Promise<CryptoKey | null> {
    const base64Key = localStorage.getItem("chatEncryptionKey");
    if (!base64Key) return null;
    const raw = this.base64ToArrayBuffer(base64Key);
    return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
  }

  private async generateKey() {
    const storedKey = await this.loadKey();
    if (storedKey) {
      this.encryptionKey = storedKey;
    } else {
      this.encryptionKey = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
      );
      await this.saveKey(this.encryptionKey);
    }
  }

  private async initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.messageStore)) {
          db.createObjectStore(this.messageStore, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(this.chatMetaStore)) {
          db.createObjectStore(this.chatMetaStore, { keyPath: "chatId" });
        }
        if (!db.objectStoreNames.contains(this.registrationMapStore)) {
          db.createObjectStore(this.registrationMapStore, { keyPath: "userId" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async getDB(): Promise<IDBDatabase> {
    return this.initDB();
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  private async encryptText(text: string): Promise<{ ciphertext: string; iv: string }> {
    if (!this.encryptionKey) throw new Error("Encryption key not ready");
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(text);
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, this.encryptionKey, encoded);
    return {
      ciphertext: this.arrayBufferToBase64(encrypted),
      iv: this.arrayBufferToBase64(iv.buffer),
    };
  }

  private async decryptText(ciphertext: string, iv: string): Promise<string> {
    if (!this.encryptionKey) throw new Error("Encryption key not ready");
    const encryptedBuffer = this.base64ToArrayBuffer(ciphertext);
    const ivBuffer = this.base64ToArrayBuffer(iv);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: ivBuffer }, this.encryptionKey, encryptedBuffer);
    return new TextDecoder().decode(decrypted);
  }

  async getChatMeta(chatId: string): Promise<any | null> {
    if (!this.encryptionKey) await this.generateKey();
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.chatMetaStore, "readonly");
      const store = tx.objectStore(this.chatMetaStore);
      const request = store.get(chatId);
      request.onsuccess = async () => {
        if (request.result) {
          try {
            const meta = request.result;
            if (meta.lastMessage && meta.lastMessageIV) {
              meta.lastMessage = await this.decryptText(meta.lastMessage, meta.lastMessageIV);
            }
            resolve(meta);
          } catch (e) {
            reject(e);
          }
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }
  async addChatMeta(chatId: string, name: string, avatar: string): Promise<void> {
    if (!this.encryptionKey) await this.generateKey();
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.chatMetaStore, "readwrite");
      const chatMetaStore = tx.objectStore(this.chatMetaStore);
      const getMetaRequest = chatMetaStore.get(chatId);
      getMetaRequest.onsuccess = () => {
        let meta = getMetaRequest.result;
        if (!meta) {
          meta = {
            chatId: chatId,
            lastMessage: null,
            lastMessageIV: null,
            lastTimestamp: null,
            unreadCount: 0,
            name: name || "Unknown",
            avatar: avatar || "/placeholder.svg",
          };

          chatMetaStore.put(meta);
          tx.oncomplete = () => {
            this.notify(); // 🔔 notify after write
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        }
        };
        getMetaRequest.onerror = () => reject(getMetaRequest.error);
    });
  }
  async saveMessage(message: {
    id: string;
    chatId: string;
    senderId: number;
    text: string;
    _creationTime: number;
    read?: boolean;
    sender:{
      _id:string
      name:string
    };
    status?: "sent" | "delivered" | "read";
  }): Promise<void> {
    if (!this.encryptionKey) await this.generateKey();
    const db = await this.getDB();
    const { ciphertext: encryptedText, iv: messageIV } = await this.encryptText(message.text);
    const { ciphertext: lastMessageCiphertext, iv: lastMessageIV } = await this.encryptText(message.text);

    return new Promise((resolve, reject) => {
      const tx = db.transaction([this.messageStore, this.chatMetaStore], "readwrite");
      const messageStore = tx.objectStore(this.messageStore);
      const chatMetaStore = tx.objectStore(this.chatMetaStore);

      const messageWithRead = {
        ...message,
        text: encryptedText,
        iv: messageIV,
        read: message.read ?? false,
      };

      const addRequest = messageStore.add(messageWithRead);
      addRequest.onsuccess = () => {
        const getMetaRequest = chatMetaStore.get(message.chatId);
        getMetaRequest.onsuccess = () => {
          let meta = getMetaRequest.result;
          if (!meta) {
            meta = {
              chatId: message.chatId,
              lastMessage: lastMessageCiphertext,
              lastMessageIV,
              lastTimestamp: message._creationTime,
              unreadCount: message.read ? 0 : 1,
              name: message.sender.name || "Unknown",
              avatar: "/placeholder.svg",
            };
          } else {
            meta.lastMessage = lastMessageCiphertext;
            meta.lastMessageIV = lastMessageIV;
            meta.lastTimestamp = message._creationTime;
            if (!message.read) {
              meta.unreadCount = (meta.unreadCount || 0) + 1;
            }
          }
          chatMetaStore.put(meta);
          tx.oncomplete = () => {
            this.notify(); // 🔔 notify after write
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
        getMetaRequest.onerror = () => reject(getMetaRequest.error);
      };
      addRequest.onerror = () => reject(addRequest.error);
    });
  }

  async updateMessage(messageId: string, updates: Partial<any>): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([this.messageStore], "readwrite");
      const messageStore = tx.objectStore(this.messageStore);
      const getRequest = messageStore.get(messageId);
      getRequest.onsuccess = () => {
        const existing = getRequest.result;
        if (!existing) return reject(new Error("Message not found"));
        const updatedMessage = { ...existing, ...updates };
        const putRequest = messageStore.put(updatedMessage);
        putRequest.onsuccess = () => {
          this.notify(); // 🔔 notify on update
          resolve();
        };
        putRequest.onerror = () => reject(putRequest.error);
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async updateChatMetaCount(chatId: string, unreadCountDelta: number): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.chatMetaStore, "readwrite");
      const store = tx.objectStore(this.chatMetaStore);
      const request = store.get(chatId);
      request.onsuccess = () => {
        const meta = request.result;
        if (meta) {
          meta.unreadCount = unreadCountDelta;
          store.put(meta);
        }
        tx.oncomplete = () => {
          this.notify(); // 🔔
          resolve();
        };
      };
      request.onerror = () => reject(request.error);
    });
  }

  async updateChatMeta(chatId: string, lastMessage: string, timestamp: number, unreadCountDelta: number): Promise<void> {
    if (!this.encryptionKey) await this.generateKey();
    const db = await this.getDB();
    const { ciphertext, iv } = await this.encryptText(lastMessage);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.chatMetaStore, "readwrite");
      const store = tx.objectStore(this.chatMetaStore);
      const getRequest = store.get(chatId);
      getRequest.onsuccess = () => {
        let meta = getRequest.result || { chatId, unreadCount: 0 };
        meta.lastMessage = ciphertext;
        meta.lastMessageIV = iv;
        meta.lastTimestamp = timestamp;
        meta.unreadCount = Math.max((meta.unreadCount || 0) + unreadCountDelta, 0);
        store.put(meta);
      };
      tx.oncomplete = () => {
        this.notify(); // 🔔
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllChats() {
    if (!this.encryptionKey) await this.generateKey();
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.chatMetaStore, "readonly");
      const store = tx.objectStore(this.chatMetaStore);
      const chats: any[] = [];
      const request = store.openCursor();
      request.onsuccess = async (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          chats.push(cursor.value);
          cursor.continue();
        } else {
          try {
            for (const chat of chats) {
              if (chat.lastMessage && chat.lastMessageIV) {
                chat.lastMessage = await this.decryptText(chat.lastMessage, chat.lastMessageIV);
              }
            }
            chats.sort((a, b) => b.lastTimestamp - a.lastTimestamp);
            resolve(chats);
          } catch (e) {
            reject(e);
          }
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getMessages(chatId: string) {
    if (!this.encryptionKey) await this.generateKey();
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.messageStore, "readonly");
      const store = tx.objectStore(this.messageStore);
      const messages: any[] = [];
      const request = store.openCursor();
      request.onsuccess = async (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const message = cursor.value;
          if (message.chatId === chatId) {
            messages.push(message);
          }
          cursor.continue();
        } else {
          try {
            for (const msg of messages) {
              if (msg.text && msg.iv) {
                // msg.messageType="text"
                msg.text = await this.decryptText(msg.text, msg.iv);
              }
            }
            // messages.messageType="text"
            messages.sort((a, b) => a._creationTime - b._creationTime);
            resolve(messages);
          } catch (e) {
            reject(e);
          }
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async markMessagesRead(chatId: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.messageStore, "readwrite");
      const store = tx.objectStore(this.messageStore);
      const request = store.openCursor();
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const message = cursor.value;
          if (message.chatId === chatId && !message.read) {
            message.read = true;
            cursor.update(message);
          }
          cursor.continue();
        } else {
          this.notify(); // 🔔
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveRegistrationId(userId: string, registrationId: number): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.registrationMapStore, "readwrite");
      const store = tx.objectStore(this.registrationMapStore);
      const putRequest = store.put({ userId, registrationId });
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    });
  }

  async getRegistrationId(userId: string): Promise<number | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.registrationMapStore, "readonly");
      const store = tx.objectStore(this.registrationMapStore);
      const getRequest = store.get(userId);
      getRequest.onsuccess = () => {
        if (getRequest.result) {
          resolve(getRequest.result.registrationId);
        } else {
          resolve(null);
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }
}
