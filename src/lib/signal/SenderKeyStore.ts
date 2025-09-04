import { openDB, DBSchema, IDBPDatabase } from 'idb';

// Signal Protocol Sender Key interface
export interface SenderKey {
  id: string;
  groupId: string;
  senderId: string;
  key: string; // Base64 encoded AES key
  chainKey: string; // Base64 encoded chain key for forward secrecy
  iteration: number; // Current chain iteration
  timestamp: number;
}

export interface SenderKeyChain {
  groupId: string;
  senderId: string;
  currentKey: SenderKey;
  previousKeys: SenderKey[]; // For handling out-of-order messages
}

interface SenderKeyDB extends DBSchema {
  senderKeys: {
    key: string; // `${groupId}_${senderId}`
    value: SenderKeyChain & { key: string };
  };
  myKeys: {
    key: string; // groupId
    value: {
      groupId: string;
      currentSenderKey: SenderKey;
      keyHistory: SenderKey[];
    };
  };
}

export class SenderKeyStore {
  private db: IDBPDatabase<SenderKeyDB> | null = null;
  private readonly DB_NAME = 'WhatsAppSenderKeys';
  private readonly DB_VERSION = 1;

  async initialize(): Promise<void> {
    if (this.db) return;

    this.db = await openDB<SenderKeyDB>(this.DB_NAME, this.DB_VERSION, {
      upgrade(db: any) {
        // Store for other users' sender keys
        if (!db.objectStoreNames.contains('senderKeys')) {
          db.createObjectStore('senderKeys', { keyPath: 'key' });
        }
        
        // Store for my own sender keys per group
        if (!db.objectStoreNames.contains('myKeys')) {
          db.createObjectStore('myKeys', { keyPath: 'groupId' });
        }
      },
    });

    console.log('📱 SenderKeyStore initialized');
  }

  // Generate new Sender Key for when I send messages to a group
  async generateMySenderKey(groupId: string, senderId: string): Promise<SenderKey> {
    await this.ensureInitialized();

    const keyBytes = crypto.getRandomValues(new Uint8Array(32));
    const chainKeyBytes = crypto.getRandomValues(new Uint8Array(32));
    
    const senderKey: SenderKey = {
      id: crypto.randomUUID(),
      groupId,
      senderId,
      key: this.arrayBufferToBase64(keyBytes.buffer),
      chainKey: this.arrayBufferToBase64(chainKeyBytes.buffer),
      iteration: 0,
      timestamp: Date.now()
    };

    // Store my sender key
    await this.db!.put('myKeys', {
      groupId,
      currentSenderKey: senderKey,
      keyHistory: []
    });

    console.log(`🔐 Generated new Sender Key for group ${groupId}`);
    return senderKey;
  }

  // Rotate my sender key (when membership changes)
  async rotateMySenderKey(groupId: string, senderId: string): Promise<SenderKey> {
    await this.ensureInitialized();

    const existingData = await this.db!.get('myKeys', groupId);
    const previousKeys = existingData ? [existingData.currentSenderKey, ...existingData.keyHistory] : [];

    const newSenderKey = await this.generateMySenderKey(groupId, senderId);

    await this.db!.put('myKeys', {
      groupId,
      currentSenderKey: newSenderKey,
      keyHistory: previousKeys.slice(0, 10) // Keep last 10 keys for delayed messages
    });

    console.log(`🔄 Rotated Sender Key for group ${groupId}`);
    return newSenderKey;
  }

  // Get my current sender key for a group
  async getMySenderKey(groupId: string): Promise<SenderKey | null> {
    await this.ensureInitialized();
    const data = await this.db!.get('myKeys', groupId);
    return data?.currentSenderKey || null;
  }

  // Update my sender key (for advancing chain)
  async updateMySenderKey(groupId: string, updatedKey: SenderKey): Promise<void> {
    await this.ensureInitialized();

    const existingData = await this.db!.get('myKeys', groupId);
    
    await this.db!.put('myKeys', {
      groupId,
      currentSenderKey: updatedKey,
      keyHistory: existingData ? [existingData.currentSenderKey, ...existingData.keyHistory.slice(0, 9)] : []
    });

    console.log(`🔄 Updated my Sender Key for group ${groupId}`);
  }
  // Store sender key received from another user
  async storeSenderKey(senderKey: SenderKey): Promise<void> {
    await this.ensureInitialized();

    const key = `${senderKey.groupId}_${senderKey.senderId}`;
    const existing = await this.db!.get('senderKeys', key);

    const chain: SenderKeyChain & { key: string } = {
      key,
      groupId: senderKey.groupId,
      senderId: senderKey.senderId,
      currentKey: senderKey,
      previousKeys: existing ? [existing.currentKey, ...existing.previousKeys.slice(0, 9)] : []
    };

    // Use put which will update if exists or create if not
    await this.db!.put('senderKeys', chain);
    console.log(`📥 Stored/Updated Sender Key from ${senderKey.senderId} for group ${senderKey.groupId}`);
  }

  // Get sender key for decrypting messages from a specific user
  async getSenderKey(groupId: string, senderId: string): Promise<SenderKey | null> {
    await this.ensureInitialized();
    const key = `${groupId}_${senderId}`;
    const chain = await this.db!.get('senderKeys', key);
    return chain?.currentKey || null;
  }

  // Advance chain key for forward secrecy (simplified Double Ratchet)
  async advanceChainKey(senderKey: SenderKey): Promise<SenderKey> {
    // In a full implementation, this would use HKDF and proper key derivation
    // For now, we'll use a simplified approach
    const newChainKeyBytes = await this.deriveNextChainKey(senderKey.chainKey);
    const newMessageKey = await this.deriveMessageKey(senderKey.chainKey, senderKey.iteration);

    const advancedKey: SenderKey = {
      ...senderKey,
      key: newMessageKey,
      chainKey: this.arrayBufferToBase64(newChainKeyBytes.buffer as ArrayBuffer),
      iteration: senderKey.iteration + 1,
      timestamp: Date.now()
    };

    return advancedKey;
  }

  // Encrypt message with sender key
  async encryptWithSenderKey(message: string, senderKey: SenderKey): Promise<{
    encryptedData: string;
    keyId: string;
    iteration: number;
  }> {
    try {
      // Advance the chain to get message key (forward secrecy)
      const messageKey = await this.deriveMessageKey(senderKey.chainKey, senderKey.iteration);
      
      const encoder = new TextEncoder();
      const data = encoder.encode(message);
      
      // Generate IV
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      // Import key for AES-GCM
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        this.base64ToArrayBuffer(messageKey),
        { name: 'AES-GCM' },
        false,
        ['encrypt']
      );
      
      // Encrypt
      const encryptedData = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        data
      );
      
      // Combine IV + encrypted data
      const combined = new Uint8Array(iv.length + encryptedData.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encryptedData), iv.length);
      
      return {
        encryptedData: this.arrayBufferToBase64(combined.buffer),
        keyId: senderKey.id,
        iteration: senderKey.iteration
      };
    } catch (error) {
      console.error('❌ Sender Key encryption failed:', error);
      throw new Error('Failed to encrypt with sender key');
    }
  }

  // Decrypt message with sender key
  async decryptWithSenderKey(
    encryptedData: string, 
    groupId: string, 
    senderId: string,
    keyId: string,
    iteration: number
  ): Promise<string> {
    try {
      const senderKey = await this.getSenderKey(groupId, senderId);
      if (!senderKey) {
        throw new Error(`No sender key found for ${senderId} in group ${groupId}`);
      }

      // Derive the specific message key for this iteration
      const messageKey = await this.deriveMessageKey(senderKey.chainKey, iteration);
      
      const combined = this.base64ToArrayBuffer(encryptedData);
      const iv = combined.slice(0, 12);
      const ciphertext = combined.slice(12);
      
      // Import key for AES-GCM
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        this.base64ToArrayBuffer(messageKey),
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );
      
      // Decrypt
      const decryptedData = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        ciphertext
      );
      
      const decoder = new TextDecoder();
      return decoder.decode(decryptedData);
    } catch (error) {
      console.error('❌ Sender Key decryption failed:', error);
      throw new Error('Failed to decrypt with sender key');
    }
  }

  // Simplified key derivation (in production, use HKDF)
  private async deriveNextChainKey(chainKey: string): Promise<Uint8Array> {
    const keyBytes = this.base64ToArrayBuffer(chainKey);
    const derivedKey = await crypto.subtle.digest('SHA-256', keyBytes);
    return new Uint8Array(derivedKey);
  }

  private async deriveMessageKey(chainKey: string, iteration: number): Promise<string> {
    const encoder = new TextEncoder();
    const chainKeyBytes = this.base64ToArrayBuffer(chainKey);
    const iterationBytes = encoder.encode(iteration.toString());
    
    // Combine chain key + iteration for message key derivation
    const combined = new Uint8Array(chainKeyBytes.byteLength + iterationBytes.length);
    combined.set(new Uint8Array(chainKeyBytes));
    combined.set(iterationBytes, chainKeyBytes.byteLength);
    
    const derivedKey = await crypto.subtle.digest('SHA-256', combined);
    return this.arrayBufferToBase64(derivedKey);
  }

  // Clear all sender keys for a group (when leaving)
  async clearGroupKeys(groupId: string): Promise<void> {
    await this.ensureInitialized();
    
    // Clear my keys
    await this.db!.delete('myKeys', groupId);
    
    // Clear other users' sender keys for this group
    const allKeys = await this.db!.getAll('senderKeys');
    const keysToDelete = allKeys.filter((chain: any) => chain.groupId === groupId);
    
    for (const chain of keysToDelete) {
      await this.db!.delete('senderKeys', `${chain.groupId}_${chain.senderId}`);
    }
    
    console.log(`🗑️ Cleared all sender keys for group ${groupId}`);
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

// Singleton instance
export const senderKeyStore = new SenderKeyStore();
