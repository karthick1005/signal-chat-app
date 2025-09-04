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

export class WhatsAppSignalGroupService {
  private socket: Socket | null = null;

  constructor(socket: Socket | null) {
    this.socket = socket;
    this.initializeSenderKeyStore();
  }

  private async initializeSenderKeyStore(): Promise<void> {
    await senderKeyStore.initialize();
  }

  // Send a group message using Sender Key encryption (WhatsApp-style)
  async sendGroupMessage(
    groupId: string,
    content: string,
    type: 'text' | 'image' | 'file' = 'text'
  ): Promise<void> {
    try {
      const currentUserId = localStorage.getItem('userId');
      const currentUserName = localStorage.getItem('username');
      
      if (!currentUserId || !currentUserName) {
        throw new Error('User not authenticated');
      }

      console.log(`📤 Sending WhatsApp Signal group message to ${groupId}`);

      // Get or generate my sender key for this group
      let mySenderKey = await senderKeyStore.getMySenderKey(groupId);
      if (!mySenderKey) {
        console.log(`🔐 Generating new Sender Key for group ${groupId}`);
        mySenderKey = await senderKeyStore.generateMySenderKey(groupId, currentUserId);
        
        // Distribute the new sender key to all group members
        await this.distributeSenderKeyToGroupMembers(groupId, mySenderKey);
      }

      // Create message
      const messageId = crypto.randomUUID();
      const timestamp = Date.now();

      const message: GroupMessage = {
        messageId,
        senderId: currentUserId,
        senderName: currentUserName,
        groupId,
        timestamp,
        type,
        content,
        keyId: mySenderKey.id,
        iteration: mySenderKey.iteration
      };

      // Encrypt message with Sender Key (single encryption for all recipients)
      const encryptedResult = await senderKeyStore.encryptWithSenderKey(
        JSON.stringify({ content, type }),
        mySenderKey
      );

      const encryptedMessage: EncryptedGroupMessage = {
        encryptedData: encryptedResult.encryptedData,
        keyId: encryptedResult.keyId,
        iteration: encryptedResult.iteration,
        senderId: currentUserId,
        senderName: currentUserName,
        groupId,
        messageId,
        timestamp,
        type
      };

      // Save to local storage (decrypted version for me)
      await chatStoreInstance.saveMessage({
        id: messageId,
        chatId: groupId,
        senderId: parseInt(currentUserId),
        text: content,
        _creationTime: timestamp,
        sender: {
          _id: currentUserId,
          name: currentUserName
        },
        status: 'sent'
      });

      // Send encrypted message to server (WhatsApp-style: server just forwards)
      if (this.socket && this.socket.connected) {
        this.socket.emit('group_message', {
          encryptedMessage: encryptedMessage,
          senderId: currentUserId,
          senderName: currentUserName,
          room: groupId,
          messageId,
          timestamp
        });
        console.log(`📡 WhatsApp Signal encrypted group message sent to server`);
      } else {
        throw new Error('Socket not connected');
      }

      // Advance my sender key for forward secrecy
      const advancedKey = await senderKeyStore.advanceChainKey(mySenderKey);
      
      // Update my sender key properly
      await senderKeyStore.updateMySenderKey(groupId, advancedKey);

      console.log(`✅ Group message sent successfully with Sender Key encryption`);

    } catch (error) {
      console.error('❌ Failed to send group message:', error);
      throw error;
    }
  }

  // Handle incoming encrypted group message (WhatsApp-style)
  async handleIncomingGroupMessage(data: any): Promise<void> {
    try {
      const { encryptedMessage, senderId, senderName, room: groupId, messageId, timestamp } = data;

      console.log(`📥 Received WhatsApp Signal encrypted group message:`, {
        senderId,
        groupId,
        messageId: messageId.substring(0, 8) + '...'
      });

      // Skip our own messages (we already have them decrypted)
      const currentUserId = localStorage.getItem('userId');
      if (senderId === currentUserId) {
        console.log(`⏭️ Skipping own message`);
        return;
      }

      // Try to decrypt with sender's key
      try {
        const decryptedContent = await senderKeyStore.decryptWithSenderKey(
          encryptedMessage.encryptedData,
          groupId,
          senderId,
          encryptedMessage.keyId,
          encryptedMessage.iteration
        );

        const messageData = JSON.parse(decryptedContent);

        // Save decrypted message to local storage
        await chatStoreInstance.saveMessage({
          id: messageId,
          chatId: groupId,
          senderId: parseInt(senderId),
          text: messageData.content,
          _creationTime: timestamp,
          sender: {
            _id: senderId,
            name: senderName
          },
          status: 'delivered'
        });

        console.log(`✅ Group message decrypted and saved successfully`);

        // Send delivery acknowledgment
        if (this.socket && this.socket.connected) {
          this.socket.emit('message_delivered', {
            messageId,
            senderId: currentUserId,
            receiverId: senderId,
            room: groupId
          });
        }

      } catch (decryptError) {
        console.error(`❌ Failed to decrypt group message from ${senderId}:`, decryptError);
        
        // Request sender key from the sender
        await this.requestSenderKeyFromUser(groupId, senderId);
        
        // Save as undecryptable for now
        await chatStoreInstance.saveMessage({
          id: messageId,
          chatId: groupId,
          senderId: parseInt(senderId),
          text: '[Message encrypted - requesting key]',
          _creationTime: timestamp,
          sender: {
            _id: senderId,
            name: senderName
          },
          status: 'delivered'
        });
      }

    } catch (error) {
      console.error('❌ Failed to handle incoming group message:', error);
    }
  }

  // Distribute my sender key to all group members
  private async distributeSenderKeyToGroupMembers(groupId: string, senderKey: SenderKey): Promise<void> {
    try {
      // Get group members from local storage
      const groupMeta = await chatStoreInstance.getGroupMeta(groupId);
      
      if (!groupMeta || !groupMeta.members) {
        console.error(`❌ Group ${groupId} not found locally`);
        return;
      }

      console.log(`🔑 Distributing Sender Key to ${groupMeta.members.length - 1} group members`);

      const currentUserId = localStorage.getItem('userId');
      
      // Send sender key to each member (except myself)
      for (const member of groupMeta.members) {
        if (member.userId !== currentUserId && this.socket) {
          try {
            // For now, we'll send the sender key directly
            // In a full implementation, this would be encrypted with Signal Protocol
            this.socket.emit('direct_message', {
              receiverId: member.userId,
              senderId: currentUserId,
              senderName: localStorage.getItem('username'),
              encryptedMessage: JSON.stringify({
                type: 'sender_key_distribution',
                senderKey: senderKey,
                groupId: groupId
              }),
              type: 'sender_key_distribution'
            });

            console.log(`🔑 Sender Key sent to ${member.userId}`);

          } catch (error) {
            console.error(`❌ Failed to send Sender Key to ${member.userId}:`, error);
          }
        }
      }

    } catch (error) {
      console.error('❌ Failed to distribute sender key:', error);
    }
  }

  // Handle receiving a sender key from another user
  async handleSenderKeyDistribution(data: any): Promise<void> {
    try {
      const messageData = JSON.parse(data.encryptedMessage);
      
      if (messageData.type === 'sender_key_distribution') {
        const { senderKey, groupId } = messageData;
        
        console.log(`🔑 Received Sender Key from ${data.senderId} for group ${groupId}`);

        // Store the sender key
        await senderKeyStore.storeSenderKey(senderKey);

        console.log(`✅ Sender Key from ${data.senderId} stored successfully`);

        // Try to decrypt any pending messages from this sender
        await this.retryPendingMessagesFromSender(groupId, data.senderId);
      }

    } catch (error) {
      console.error(`❌ Failed to handle sender key distribution:`, error);
    }
  }

  // Request sender key from a user when decryption fails
  private async requestSenderKeyFromUser(groupId: string, senderId: string): Promise<void> {
    if (this.socket && this.socket.connected) {
      console.log(`🔑 Requesting Sender Key from ${senderId} for group ${groupId}`);
      
      this.socket.emit('direct_message', {
        receiverId: senderId,
        senderId: localStorage.getItem('userId'),
        senderName: localStorage.getItem('username'),
        encryptedMessage: JSON.stringify({
          type: 'sender_key_request',
          groupId,
          requesterId: localStorage.getItem('userId')
        }),
        type: 'sender_key_request'
      });
    }
  }

  // Handle sender key request from another user
  async handleSenderKeyRequest(data: any): Promise<void> {
    try {
      const messageData = JSON.parse(data.encryptedMessage);
      
      if (messageData.type === 'sender_key_request') {
        const { groupId, requesterId } = messageData;
        
        console.log(`🔑 Sender Key requested by ${requesterId} for group ${groupId}`);

        const mySenderKey = await senderKeyStore.getMySenderKey(groupId);
        if (mySenderKey && this.socket) {
          // Send my current sender key to the requester
          this.socket.emit('direct_message', {
            receiverId: requesterId,
            senderId: localStorage.getItem('userId'),
            senderName: localStorage.getItem('username'),
            encryptedMessage: JSON.stringify({
              type: 'sender_key_distribution',
              senderKey: mySenderKey,
              groupId: groupId
            }),
            type: 'sender_key_distribution'
          });

          console.log(`🔑 Sender Key sent to requester ${requesterId}`);
        }
      }
    } catch (error) {
      console.error(`❌ Failed to handle sender key request:`, error);
    }
  }

  // Retry decrypting pending messages after receiving sender key
  private async retryPendingMessagesFromSender(groupId: string, senderId: string): Promise<void> {
    try {
      console.log(`🔄 Retrying pending messages from ${senderId} in group ${groupId}`);
      
      // In a full implementation, you'd:
      // 1. Query chatStoreInstance for messages with undecryptable content from this sender
      // 2. Attempt to decrypt them with the new sender key
      // 3. Update the messages with decrypted content
      
    } catch (error) {
      console.error('❌ Failed to retry pending messages:', error);
    }
  }

  // Rotate sender key when group membership changes
  async rotateSenderKeyForMembershipChange(groupId: string, action: 'add' | 'remove', userId: string): Promise<void> {
    try {
      const currentUserId = localStorage.getItem('userId');
      if (!currentUserId) return;

      if (action === 'remove') {
        console.log(`🔄 Rotating Sender Key due to member removal: ${userId}`);
        
        // Generate new sender key so removed member can't decrypt future messages
        const newSenderKey = await senderKeyStore.rotateMySenderKey(groupId, currentUserId);
        
        // Distribute new key to remaining members
        await this.distributeSenderKeyToGroupMembers(groupId, newSenderKey);
        
        console.log(`✅ Sender Key rotated and distributed to remaining members`);
      }
      
      if (action === 'add') {
        console.log(`🔑 Sending current Sender Key to new member: ${userId}`);
        
        // Send current sender key to new member
        const currentSenderKey = await senderKeyStore.getMySenderKey(groupId);
        if (currentSenderKey && this.socket) {
          this.socket.emit('direct_message', {
            receiverId: userId,
            senderId: currentUserId,
            senderName: localStorage.getItem('username'),
            encryptedMessage: JSON.stringify({
              type: 'sender_key_distribution',
              senderKey: currentSenderKey,
              groupId: groupId
            }),
            type: 'sender_key_distribution'
          });

          console.log(`🔑 Sender Key sent to new member ${userId}`);
        }
      }

    } catch (error) {
      console.error('❌ Failed to handle membership change:', error);
    }
  }
}

export default WhatsAppSignalGroupService;
