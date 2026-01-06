/**
 * WhatsApp Signal Protocol Group Message Service
 * Implements true WhatsApp-style group messaging with Sender Keys
 */

import { Socket } from 'socket.io-client';
import { senderKeyStore, SenderKey } from './SenderKeyStore';
import chatStoreInstance from '../chatStoreInstance';

export interface GroupMessage {
  messageId: string;
  senderId: string;
  senderName: string;
  groupId: string;
  timestamp: number;
  type: 'text' | 'image' | 'file';
  content: string;
  keyId: string; // Sender Key ID used for encryption
  iteration: number; // Key iteration for forward secrecy
}

export interface EncryptedGroupMessage {
  encryptedData: string;
  keyId: string;
  iteration: number;
  senderId: string;
  senderName: string;
  groupId: string;
  messageId: string;
  timestamp: number;
  type: 'text' | 'image' | 'file';
}

export class WhatsAppGroupMessageService {
  private socket: Socket | null = null;

  constructor(socket: Socket | null) {
    this.socket = socket;
    this.initializeSenderKeyStore();
  }

  private async initializeSenderKeyStore(): Promise<void> {
    await senderKeyStore.initialize();
  }
  status?: 'sent' | 'delivered' | 'read';
}

interface GroupChat {
  chatId: string;
  groupKey: string;
  isGroup: boolean;
  name: string;
  members?: any[];
  admins?: string[];
}

class WhatsAppGroupMessageService {
  private socket: any = null;

  setSocket(socket: any): void {
    this.socket = socket;
  }

  /**
   * Send group message (WhatsApp-style)
   */
  async sendGroupMessage(
    groupChat: GroupChat,
    messageText: string,
    currentUserId: string,
    currentUsername: string
  ): Promise<void> {
    try {
      console.log('📤 Sending WhatsApp-style group message...');
      
      // Validate group and key
      if (!groupChat.isGroup) {
        throw new Error('Chat is not a group');
      }

      if (!groupChat.groupKey) {
        console.error('Group data:', groupChat);
        throw new Error('Group encryption key not found');
      }

      // Validate key format (should be base64)
      console.log(`🔍 Checking group key format...`);
      console.log(`Key value: ${groupChat.groupKey}`);
      console.log(`Key length: ${groupChat.groupKey.length}`);
      console.log(`Is valid base64: ${this.isValidBase64(groupChat.groupKey)}`);
      
      // Try to decode the key to see actual byte length
      try {
        const decoded = atob(groupChat.groupKey);
        console.log(`Decoded key byte length: ${decoded.length}`);
        console.log(`Expected: 32 bytes (256 bits)`);
      } catch (e) {
        console.error('Failed to decode base64 key:', e);
      }

      if (!this.isValidBase64(groupChat.groupKey)) {
        console.error('Invalid group key format:', groupChat.groupKey);
        throw new Error('Group key format is invalid');
      }

      const messageId = uuidv4();
      console.log(`🔑 Using group key for encryption: ${groupChat.groupKey.substring(0, 10)}...`);
      console.log('🔑 Group key details:', {
        length: groupChat.groupKey.length,
        isValidBase64: this.isValidBase64(groupChat.groupKey),
        first10: groupChat.groupKey.substring(0, 10),
        last10: groupChat.groupKey.substring(groupChat.groupKey.length - 10)
      });
      
      // Test decode the key before using
      try {
        const decoded = atob(groupChat.groupKey);
        console.log('🔑 Key decode test:', {
          decodedLength: decoded.length,
          expectedLength: 32,
          isCorrectSize: decoded.length === 32
        });
      } catch (error) {
        console.error('🔑 Key decode failed:', error);
        throw new Error('Group key is not valid base64: ' + String(error));
      }

      // Encrypt message with group key (WhatsApp-style AES-256-GCM)
      const encryptedMessage = await encryptGroupMessage(messageText, groupChat.groupKey);
      console.log('🔐 Message encrypted successfully');

      // Create message object for local storage
      const localMessage: GroupMessage = {
        id: messageId,
        chatId: groupChat.chatId,
        senderId: parseInt(currentUserId),
        text: messageText, // Store original text for sender
        _creationTime: Date.now(),
        read: true, // Mark as read for sender
        sender: {
          _id: currentUserId,
          name: currentUsername
        },
        status: 'sent'
      };

      // Save message locally first (WhatsApp behavior)
      await chatStoreInstance.saveMessage(localMessage);
      console.log('💾 Message saved locally');

      // Send encrypted message to group members via WebSocket
      if (this.socket && this.socket.connected) {
        this.socket.emit('group_message', {
          encryptedMessage,
          senderId: currentUserId,
          senderName: currentUsername,
          room: groupChat.chatId,
          messageId,
          timestamp: Date.now()
        });
        console.log('📡 Encrypted message sent via WebSocket');
      } else {
        console.warn('⚠️ Socket not connected - message queued locally');
        // In a real app, you'd queue this for later sending
      }

    } catch (error) {
      console.error('❌ Failed to send group message:', error);
      throw error;
    }
  }

  /**
   * Handle incoming group message (WhatsApp-style)
   */
  async handleIncomingGroupMessage(data: {
    encryptedMessage: any;
    senderId: string;
    senderName: string;
    room: string;
    messageId: string;
    timestamp: number;
  }): Promise<void> {
    try {
      console.log('📥 Received encrypted group message:', data);

      // Get group information from local storage
      const groupMeta = await chatStoreInstance.getGroupMeta(data.room);
      if (!groupMeta) {
        console.warn(`⚠️ Group ${data.room} not found locally - ignoring message`);
        return;
      }

      if (!groupMeta.groupKey) {
        console.error('❌ Group key missing for decryption');
        return;
      }

      // Decrypt message using group key
      const decryptedText = await decryptGroupMessage(data.encryptedMessage, groupMeta.groupKey);
      console.log('🔓 Message decrypted successfully');

      // Create message object
      const message: GroupMessage = {
        id: data.messageId,
        chatId: data.room,
        senderId: parseInt(data.senderId),
        text: decryptedText,
        _creationTime: data.timestamp,
        read: false, // Mark as unread for recipient
        sender: {
          _id: data.senderId,
          name: data.senderName
        },
        status: 'delivered'
      };

      // Save decrypted message locally
      await chatStoreInstance.saveMessage(message);
      console.log('💾 Decrypted message saved locally');

      // Send delivery confirmation back to sender
      if (this.socket && this.socket.connected) {
        this.socket.emit('message_delivered', {
          messageId: data.messageId,
          groupId: data.room,
          deliveredTo: localStorage.getItem('userId')
        });
      }

    } catch (error) {
      console.error('❌ Failed to handle incoming group message:', error);
    }
  }

  /**
   * Send group reaction (WhatsApp-style)
   */
  async sendGroupReaction(
    groupChat: GroupChat,
    messageId: string,
    emoji: string,
    currentUserId: string
  ): Promise<void> {
    try {
      if (!groupChat.groupKey) {
        throw new Error('Group encryption key not found');
      }

      const reaction = { userId: currentUserId, emoji };
      const encryptedReaction = await encryptGroupReaction(reaction, groupChat.groupKey);

      if (this.socket && this.socket.connected) {
        this.socket.emit('group_reaction', {
          encryptedReaction,
          messageId,
          senderId: currentUserId,
          room: groupChat.chatId,
          timestamp: Date.now()
        });
        console.log('👍 Group reaction sent');
      }

    } catch (error) {
      console.error('❌ Failed to send group reaction:', error);
      throw error;
    }
  }

  /**
   * Handle incoming group reaction
   */
  async handleIncomingGroupReaction(data: {
    encryptedReaction: any;
    messageId: string;
    senderId: string;
    room: string;
    timestamp: number;
  }): Promise<void> {
    try {
      const groupMeta = await chatStoreInstance.getGroupMeta(data.room);
      if (!groupMeta || !groupMeta.groupKey) {
        console.warn('Group or group key not found for reaction');
        return;
      }

      const decryptedReaction = await decryptGroupReaction(data.encryptedReaction, groupMeta.groupKey);
      console.log('👍 Group reaction decrypted:', decryptedReaction);

      // Handle the reaction (store locally, update UI, etc.)
      // This would integrate with the reaction service

    } catch (error) {
      console.error('❌ Failed to handle incoming group reaction:', error);
    }
  }

  /**
   * Get group metadata with key validation
   */
  async getGroupForMessaging(groupId: string): Promise<GroupChat | null> {
    try {
      const groupMeta = await chatStoreInstance.getGroupMeta(groupId);
      if (!groupMeta) {
        console.warn(`Group ${groupId} not found`);
        return null;
      }

      if (!groupMeta.groupKey) {
        console.error(`Group ${groupId} missing encryption key`);
        return null;
      }

      if (!this.isValidBase64(groupMeta.groupKey)) {
        console.error(`Group ${groupId} has invalid key format`);
        return null;
      }

      return {
        chatId: groupMeta.groupId,
        groupKey: groupMeta.groupKey,
        isGroup: true,
        name: groupMeta.name,
        members: groupMeta.members,
        admins: groupMeta.admins
      };

    } catch (error) {
      console.error('Failed to get group for messaging:', error);
      return null;
    }
  }

  /**
   * Validate base64 string format
   */
  isValidBase64(str: string): boolean {
    try {
      return btoa(atob(str)) === str;
    } catch {
      return false;
    }
  }

  /**
   * Regenerate group key (admin only)
   */
  async regenerateGroupKey(groupId: string, adminUserId: string): Promise<string> {
    try {
      const groupMeta = await chatStoreInstance.getGroupMeta(groupId);
      if (!groupMeta) {
        throw new Error('Group not found');
      }

      if (!groupMeta.admins.includes(adminUserId)) {
        throw new Error('Only admins can regenerate group key');
      }

      // Generate new 256-bit key
      const newKeyBytes = crypto.getRandomValues(new Uint8Array(32));
      const newGroupKey = btoa(String.fromCharCode(...newKeyBytes));

      // Update group with new key
      const updatedGroup = {
        ...groupMeta,
        groupKey: newGroupKey,
        version: groupMeta.version + 1,
        lastUpdated: Date.now(),
        keyRegeneratedBy: adminUserId,
        keyRegeneratedAt: Date.now()
      };

      await chatStoreInstance.saveGroupMeta(groupId, updatedGroup);

      // Announce new key to all members (in a real app)
      console.log(`🔑 New group key generated for ${groupId}`);
      
      return newGroupKey;

    } catch (error) {
      console.error('Failed to regenerate group key:', error);
      throw error;
    }
  }

  /**
   * Validate group message integrity
   */
  validateGroupMessage(message: any, groupMeta: any): boolean {
    if (!message || !groupMeta) return false;
    if (!groupMeta.groupKey) return false;
    if (!groupMeta.members.some((m: any) => m.userId === message.senderId)) return false;
    return true;
  }

  /**
   * Test AES key generation and encryption (debugging)
   */
  async testKeyGeneration(): Promise<void> {
    console.log('🧪 Testing AES key generation and encryption...');
    
    try {
      // Generate key the same way as WhatsAppGroupService
      const keyBytes = crypto.getRandomValues(new Uint8Array(32));
      let binaryString = '';
      for (let i = 0; i < keyBytes.length; i++) {
        binaryString += String.fromCharCode(keyBytes[i]);
      }
      const testKey = btoa(binaryString);
      
      console.log('🧪 Test key:', {
        length: testKey.length,
        isValidBase64: this.isValidBase64(testKey),
        first10: testKey.substring(0, 10)
      });
      
      // Test decoding
      const decoded = atob(testKey);
      console.log('🧪 Decoded key:', {
        length: decoded.length,
        expectedLength: 32,
        match: decoded.length === 32
      });
      
      // Test encryption
      const testMessage = "Hello, WhatsApp-style encryption!";
      const encryptedMessage = await encryptGroupMessage(testMessage, testKey);
      console.log('🧪 Encryption test successful:', {
        originalLength: testMessage.length,
        encryptedBodyLength: encryptedMessage.body.length,
        ivLength: encryptedMessage.iv.length
      });
      
      // Test decryption
      const decryptedMessage = await decryptGroupMessage(encryptedMessage, testKey);
      console.log('🧪 Decryption test:', {
        originalMessage: testMessage,
        decryptedMessage: decryptedMessage,
        match: testMessage === decryptedMessage
      });
      
      console.log('✅ AES key generation and encryption test completed successfully');
      
    } catch (error) {
      console.error('❌ AES key generation test failed:', error);
      throw error;
    }
  }
}

export const whatsappGroupMessageService = new WhatsAppGroupMessageService();
export default whatsappGroupMessageService;
