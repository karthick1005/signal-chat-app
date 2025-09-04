// class SignalProtocolStore {
//     private dbName = "SignalStore";
//     private storeName = "SignalData";
  
//     public Direction = {
//       SENDING: 1,
//       RECEIVING: 2,
//     };
  
//     constructor() {
//       this.initDB();
//     }
  
//     private async initDB(): Promise<IDBDatabase> {
//       return new Promise((resolve, reject) => {
//         const request = indexedDB.open(this.dbName, 1);
  
//         request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
//           const db = (event.target as IDBOpenDBRequest).result;
//           if (!db.objectStoreNames.contains(this.storeName)) {
//             db.createObjectStore(this.storeName);
//           }
//         };
  
//         request.onsuccess = () => resolve(request.result);
//         request.onerror = () => reject(request.error);
//       });
//     }
  
//     private async getDB(): Promise<IDBDatabase> {
//       return this.initDB();
//     }
  
//     private async getItem(key: string): Promise<any> {
//       const db = await this.getDB();
//       return new Promise((resolve, reject) => {
//         const transaction = db.transaction(this.storeName, "readonly");
//         const store = transaction.objectStore(this.storeName);
//         const request = store.get(key);
  
//         request.onsuccess = () => resolve(request.result);
//         request.onerror = () => reject(request.error);
//       });
//     }
  
//     private async putItem(key: string, value: any): Promise<void> {
//       const db = await this.getDB();
//       return new Promise((resolve, reject) => {
//         const transaction = db.transaction(this.storeName, "readwrite");
//         const store = transaction.objectStore(this.storeName);
//         const request = store.put(value, key);
  
//         request.onsuccess = () => resolve();
//         request.onerror = () => reject(request.error);
//       });
//     }
  
//     async getIdentityKeyPair(): Promise<any> {
//       return this.getItem("identityKey");
//     }
  
//     async getLocalRegistrationId(): Promise<any> {
//       return this.getItem("registrationId");
//     }
  
//     async put(key: string, value: any): Promise<void> {
//       if (key === undefined || value === undefined)
//         throw new Error("Tried to store undefined/null");
//       return this.putItem(key, value);
//     }
  
//     async get(key: string, defaultValue?: any): Promise<any> {
//       const result = await this.getItem(key);
//       return result !== undefined ? result : defaultValue;
//     }
  
//     async remove(key: string): Promise<void> {
//       const db = await this.getDB();
//       return new Promise((resolve, reject) => {
//         const transaction = db.transaction(this.storeName, "readwrite");
//         const store = transaction.objectStore(this.storeName);
//         const request = store.delete(key);
  
//         request.onsuccess = () => resolve();
//         request.onerror = () => reject(request.error);
//       });
//     }
  
//     async isTrustedIdentity(identifier: string, identityKey: ArrayBuffer, _direction: number): Promise<boolean> {
//       if (!identifier) throw new Error("Tried to check identity key for undefined/null identifier");
  
//       const trusted = await this.get(`identityKey${identifier}`);
//       if (trusted === undefined) return true;
  
//       return Buffer.from(trusted).toString("base64") === Buffer.from(identityKey).toString("base64");
//     }
  
//     async loadIdentityKey(identifier: string): Promise<any> {
//       if (!identifier) throw new Error("Tried to get identity key for undefined/null identifier");
//       return this.get(`identityKey${identifier}`);
//     }
  
//     async saveIdentity(identifier: string, identityKey: ArrayBuffer): Promise<boolean> {
//       if (!identifier) throw new Error("Tried to put identity key for undefined/null identifier");
  
//       const existing = await this.get(`identityKey${identifier}`);
//       await this.put(`identityKey${identifier}`, identityKey);
  
//       return existing !== undefined && Buffer.from(existing).toString("base64") !== Buffer.from(identityKey).toString("base64");
//     }
  
//     async storePreKey(keyId: number, keyPair: any): Promise<void> {
//       return this.put(`25519KeypreKey${keyId}`, keyPair);
//     }
  
//     async loadPreKey(keyId: number): Promise<any> {
//       return this.get(`25519KeypreKey${keyId}`);
//     }
  
//     async removePreKey(keyId: number): Promise<void> {
//       return this.remove(`25519KeypreKey${keyId}`);
//     }
  
//     async storeSignedPreKey(keyId: number, keyPair: any): Promise<void> {
//       return this.put(`25519KeysignedKey${keyId}`, keyPair);
//     }
  
//     async loadSignedPreKey(keyId: number): Promise<any> {
//       return this.get(`25519KeysignedKey${keyId}`);
//     }
  
//     async removeSignedPreKey(keyId: number): Promise<void> {
//       return this.remove(`25519KeysignedKey${keyId}`);
//     }
  
//     async loadSession(identifier: string): Promise<any> {
//       return this.get(`session${identifier}`);
//     }
  
//     async storeSession(identifier: string, record: any): Promise<void> {
//       return this.put(`session${identifier}`, record);
//     }
  
//     async removeSession(identifier: string): Promise<void> {
//       return this.remove(`session${identifier}`);
//     }
  
//     async removeAllSessions(identifier: string): Promise<void> {
//       const db = await this.getDB();
//       const transaction = db.transaction(this.storeName, "readwrite");
//       const store = transaction.objectStore(this.storeName);
//       const keysToDelete: string[] = [];
  
//       return new Promise<void>((resolve, reject) => {
//         const request = store.openCursor();
//         request.onsuccess = (event) => {
//           const cursor = (event.target as IDBRequest).result;
//           if (cursor) {
//             if (cursor.key.startsWith(`session${identifier}`)) {
//               keysToDelete.push(cursor.key as string);
//             }
//             cursor.continue();
//           } else {
//             keysToDelete.forEach((key) => store.delete(key));
//             resolve();
//           }
//         };
//         request.onerror = () => reject(request.error);
//       });
//     }
//   }
  
//   export default SignalProtocolStore;
  

class SignalProtocolStore {
    private dbName = "SignalStore";
    private storeName = "SignalData";
  
  private dbPromise: Promise<IDBDatabase> | null = null;

  public Direction = {
    SENDING: 1,
    RECEIVING: 2,
  };

  constructor() {
    this.dbPromise = this.initDB().catch(error => {
      console.error('Failed to initialize SignalProtocolStore database:', error);
      throw error;
    });
  }  private async initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      try {
        // Check if IndexedDB is available
        if (!window.indexedDB) {
          throw new Error('IndexedDB is not supported in this browser');
        }

        const request = indexedDB.open(this.dbName, 1);

        request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
          try {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(this.storeName)) {
              db.createObjectStore(this.storeName);
            }
          } catch (error) {
            console.error('Error during IndexedDB upgrade:', error);
            reject(error);
          }
        };

        request.onsuccess = () => {
          try {
            resolve(request.result);
          } catch (error) {
            console.error('Error during IndexedDB success:', error);
            reject(error);
          }
        };

        request.onerror = (event) => {
          console.error('IndexedDB error:', request.error);
          // Try to delete corrupted database and retry
          this.deleteAndRetryDB().then(resolve).catch(reject);
        };

        request.onblocked = () => {
          console.warn('IndexedDB blocked - another tab may be using the database');
          reject(new Error('IndexedDB is blocked by another tab'));
        };

      } catch (error) {
        console.error('Failed to initialize IndexedDB:', error);
        reject(error);
      }
    });
  }

  private async deleteAndRetryDB(): Promise<IDBDatabase> {
    console.log('Attempting to delete corrupted database and retry...');
    return new Promise((resolve, reject) => {
      const deleteRequest = indexedDB.deleteDatabase(this.dbName);
      
      deleteRequest.onsuccess = () => {
        console.log('Corrupted database deleted, retrying...');
        // Retry initialization
        const retryRequest = indexedDB.open(this.dbName, 1);
        
        retryRequest.onupgradeneeded = (event: IDBVersionChangeEvent) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName);
          }
        };
        
        retryRequest.onsuccess = () => resolve(retryRequest.result);
        retryRequest.onerror = () => reject(retryRequest.error);
      };
      
      deleteRequest.onerror = () => {
        console.error('Failed to delete corrupted database');
        reject(deleteRequest.error);
      };
    });
  }

  private async getDB(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = this.initDB();
    }
    return this.dbPromise;
  }
  
    private async getItem(key: string): Promise<any> {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(this.storeName, "readonly");
        const store = transaction.objectStore(this.storeName);
        const request = store.get(key);
  
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
  
    private async putItem(key: string, value: any): Promise<void> {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(this.storeName, "readwrite");
        const store = transaction.objectStore(this.storeName);
        const request = store.put(value, key);
  
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  
    async getIdentityKeyPair(): Promise<any> {
      return this.getItem("identityKey");
    }
  
    async getLocalRegistrationId(): Promise<number> {
      const regId = await this.getItem("registrationId");
      // Convert string to number if needed
      return typeof regId === 'string' ? parseInt(regId, 10) : regId;
    }
  
    async put(key: string, value: any): Promise<void> {
      if (key === undefined || value === undefined)
        throw new Error("Tried to store undefined/null");
      return this.putItem(key, value);
    }
  
    async get(key: string, defaultValue?: any): Promise<any> {
      const result = await this.getItem(key);
      return result !== undefined ? result : defaultValue;
    }
  
    async remove(key: string): Promise<void> {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(this.storeName, "readwrite");
        const store = transaction.objectStore(this.storeName);
        const request = store.delete(key);
  
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  
    async isTrustedIdentity(identifier: string, identityKey: ArrayBuffer): Promise<boolean> {
      if (!identifier) throw new Error("Tried to check identity key for undefined/null identifier");
  
      const trusted = await this.get(`identityKey${identifier}`);
      if (trusted === undefined) return true;
  
      return Buffer.from(trusted).toString("base64") === Buffer.from(identityKey).toString("base64");
    }
  
    async loadIdentityKey(identifier: string): Promise<any> {
      if (!identifier) throw new Error("Tried to get identity key for undefined/null identifier");
      return this.get(`identityKey${identifier}`);
    }
  
    async saveIdentity(identifier: string, identityKey: ArrayBuffer): Promise<boolean> {
      if (!identifier) throw new Error("Tried to put identity key for undefined/null identifier");
  
      const existing = await this.get(`identityKey${identifier}`);
      await this.put(`identityKey${identifier}`, identityKey);
  
      return existing !== undefined && Buffer.from(existing).toString("base64") !== Buffer.from(identityKey).toString("base64");
    }
  
    async storePreKey(keyId: number, keyPair: any): Promise<void> {
      return this.put(`25519KeypreKey${keyId}`, keyPair);
    }
  
    async loadPreKey(keyId: number): Promise<any> {
      return this.get(`25519KeypreKey${keyId}`);
    }
  
    async removePreKey(keyId: number): Promise<void> {
      return this.remove(`25519KeypreKey${keyId}`);
    }
  
    async storeSignedPreKey(keyId: number, keyPair: any): Promise<void> {
      return this.put(`25519KeysignedKey${keyId}`, keyPair);
    }
  
    async loadSignedPreKey(keyId: number): Promise<any> {
      return this.get(`25519KeysignedKey${keyId}`);
    }
  
    async removeSignedPreKey(keyId: number): Promise<void> {
      return this.remove(`25519KeysignedKey${keyId}`);
    }
  async removeIdentityKey(identifier: string): Promise<void> {
  return this.remove(`identityKey${identifier}`);
}
    async loadSession(identifier: string): Promise<any> {
      const session = await this.get(`session${identifier}`);
      
      // Fix for session data - ensure numeric values are actually numbers
      if (session && session.sessions) {
        for (const sessionId in session.sessions) {
          const sessionData = session.sessions[sessionId];
          
          // Convert registration ID to number if it's a string
          if (sessionData.registrationId && typeof sessionData.registrationId === 'string') {
            sessionData.registrationId = parseInt(sessionData.registrationId, 10);
          }
          
          // Also check pending PreKey data
          if (sessionData.pendingPreKey) {
            if (typeof sessionData.pendingPreKey.signedKeyId === 'string') {
              sessionData.pendingPreKey.signedKeyId = parseInt(sessionData.pendingPreKey.signedKeyId, 10);
            }
            if (typeof sessionData.pendingPreKey.preKeyId === 'string') {
              sessionData.pendingPreKey.preKeyId = parseInt(sessionData.pendingPreKey.preKeyId, 10);
            }
          }
        }
      }
      
      return session;
    }
  
    async storeSession(identifier: string, record: any): Promise<void> {
      return this.put(`session${identifier}`, record);
    }
  
    async removeSession(identifier: string): Promise<void> {
      return this.remove(`session${identifier}`);
    }
  
    async removeAllSessions(identifier: string): Promise<void> {
      const db = await this.getDB();
      const transaction = db.transaction(this.storeName, "readwrite");
      const store = transaction.objectStore(this.storeName);
      const keysToDelete: string[] = [];
  
      return new Promise<void>((resolve, reject) => {
        const request = store.openCursor();
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            if (cursor.key.startsWith(`session${identifier}`)) {
              keysToDelete.push(cursor.key as string);
            }
            cursor.continue();
          } else {
            keysToDelete.forEach((key) => store.delete(key));
            resolve();
          }
        };
        request.onerror = () => reject(request.error);
      });
    }
}
  
export default SignalProtocolStore;