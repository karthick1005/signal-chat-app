/**
 * WhatsApp-style Group Management Service with Signal Protocol
 * Groups exist only on devices that are members - no central server database
 * Now integrates with Sender Key system for proper WhatsApp-style encryption
 */

import chatStoreInstance from '../chatStoreInstance';
import { v4 as uuidv4 } from 'uuid';
import { senderKeyStore } from './SenderKeyStore';
import WhatsAppSignalGroupService from './WhatsAppSignalGroupService';

interface GroupMember {
  userId: string;
  name: string;
  joinedAt: number;
  isAdmin: boolean;
}

interface GroupMetadata {
  groupId: string;
  name: string;
  description?: string;
  avatar?: string;
  createdBy: string;
  createdAt: number;
  members: GroupMember[];
  admins: string[];
  version: number;
  lastUpdated: number;
}

export class WhatsAppGroupService {
  private signalGroupService: WhatsAppSignalGroupService | null = null;
  private socket: any = null;

  constructor(socket?: any) {
    if (socket) {
      this.setSocket(socket);
    }
  }

  setSocket(socket: any): void {
    this.socket = socket;
    if (socket) {
      this.signalGroupService = new WhatsAppSignalGroupService(socket);
    }
  }

  /**
   * Create a new group (WhatsApp-style)
   * Group is created locally and then announced to initial members
   */
  async createGroup(
    name: string,
    initialMembers: Array<{userId: string, name: string}> | string[],
    creatorId: string,
    description?: string
  ): Promise<string> {
    try {
      const groupId = uuidv4();
      const now = Date.now();
      
      // Create initial group metadata (Sender Keys will handle encryption)
      const groupMetadata: GroupMetadata = {
        groupId,
        name,
        description,
        createdBy: creatorId,
        createdAt: now,
        members: [
          // Creator is always the first member and admin
          {
            userId: creatorId,
            name: localStorage.getItem('username') || 'You',
            joinedAt: now,
            isAdmin: true
          },
          // Add initial members - handle both string[] and object[] formats
          ...initialMembers.map(member => {
            if (typeof member === 'string') {
              return {
                userId: member,
                name: '', // Will be updated when they join
                joinedAt: now,
                isAdmin: false
              };
            } else {
              return {
                userId: member.userId,
                name: member.name,
                joinedAt: now,
                isAdmin: false
              };
            }
          })
        ],
        admins: [creatorId],
        version: 1,
        lastUpdated: now
      };

      // Store group locally on creator's device
      await chatStoreInstance.saveGroupMeta(groupId, {
        ...groupMetadata,
        needsAnnouncement: true, // Mark for announcement to members
        isAdmin: true,
        canAnnounce: true
      });

      // Initialize Sender Key for this group and distribute to members
      if (this.signalGroupService) {
        const mySenderKey = await senderKeyStore.generateMySenderKey(groupId, creatorId);
        console.log(`🔐 Sender Key generated for group ${groupId}`);
        
        // Distribute the Sender Key to all group members immediately
        console.log(`🔑 Distributing initial Sender Key to ${initialMembers.length} members`);
        for (const member of initialMembers) {
          const memberId = typeof member === 'string' ? member : member.userId;
          if (this.socket) {
            this.socket.emit('direct_message', {
              receiverId: memberId,
              senderId: creatorId,
              senderName: localStorage.getItem('username'),
              encryptedMessage: JSON.stringify({
                type: 'sender_key_distribution',
                senderKey: mySenderKey,
                groupId: groupId
              }),
              type: 'sender_key_distribution'
            });
            console.log(`🔑 Initial Sender Key sent to ${memberId}`);
          }
        }
      }

      // Announce group creation to initial members (will distribute Sender Keys)
      await this.announceGroupCreation(groupMetadata);

      console.log(`✅ Group "${name}" created locally with ID: ${groupId}`);
      return groupId;

    } catch (error) {
      console.error('Failed to create group:', error);
      throw error;
    }
  }

  /**
   * Remove a member from a group (admin only)
   */
  async removeMemberFromGroup(groupId: string, memberIdToRemove: string, adminId: string): Promise<void> {
    try {
      const group = await chatStoreInstance.getGroupMeta(groupId);
      if (!group) {
        throw new Error('Group not found');
      }

      // Check if user is admin
      if (!group.admins.includes(adminId)) {
        throw new Error('Only admins can remove members');
      }

      // Prevent admin from removing themselves, they should use leaveGroup
      if (memberIdToRemove === adminId) {
        throw new Error('Admins cannot remove themselves, use "Leave Group" instead.');
      }

      // Check if member exists
      const memberExists = group.members.some((m: any) => m.userId === memberIdToRemove);
      if (!memberExists) {
        throw new Error('User is not a member of this group');
      }

      // Remove user from members list and admins list (if they were an admin)
      const updatedMembers = group.members.filter((m: any) => m.userId !== memberIdToRemove);
      const updatedAdmins = group.admins.filter((a: any) => a !== memberIdToRemove);

      const updatedGroup = {
        ...group,
        members: updatedMembers,
        admins: updatedAdmins,
        version: group.version + 1,
        lastUpdated: Date.now()
      };

      // Update local group metadata
      await chatStoreInstance.saveGroupMeta(groupId, {
        ...updatedGroup,
        needsAnnouncement: true
      });

      // Announce member removal to remaining members
      await this.announceGroupUpdate(updatedGroup, 'member_removed', {
        removedMember: memberIdToRemove,
        removedBy: adminId
      });

      // Send a notification to the removed member so they can delete the group
      if (this.socket && this.socket.connected) {
        this.socket.emit('group_removed', {
          targetUserId: memberIdToRemove,
          groupId: groupId,
          removedBy: adminId
        });
        console.log(`📨 Sent group removal notification to ${memberIdToRemove}`);
      }

      // The key rotation will be triggered by admins who receive the 'member_removed' event
      // via handleIncomingGroupUpdate. No need to call it directly here to avoid races.
      console.log(`✅ Member ${memberIdToRemove} removed. Key rotation will be initiated by an admin.`);

    } catch (error) {
      console.error('Failed to remove member from group:', error);
      throw error;
    }
  }

  /**
   * Rotate the Sender Key for a group (admin only)
   * This should be called when a member is removed or leaves.
   */
  async rotateGroupKey(groupId: string, rotatorId: string): Promise<void> {
    try {
      const group = await chatStoreInstance.getGroupMeta(groupId);
      if (!group) {
        throw new Error('Group not found');
      }

      // Check if user is admin
      if (!group.admins.includes(rotatorId)) {
        throw new Error('Only admins can rotate group keys');
      }

      console.log(`🔄 Rotating Sender Key for group ${groupId} by ${rotatorId}`);

      // Generate a new Sender Key for this group
      // This will overwrite the old one
      const newSenderKey = await senderKeyStore.generateMySenderKey(groupId, rotatorId);
      console.log(`🔐 New Sender Key generated for group ${groupId}`);

      // Distribute the new Sender Key to all current group members
      console.log(`🔑 Distributing new Sender Key to ${group.members.length} members`);
      for (const member of group.members) {
        if (this.socket) {
          this.socket.emit('direct_message', {
            receiverId: member.userId,
            senderId: rotatorId,
            senderName: localStorage.getItem('username'), // Or a more reliable way to get the admin's name
            encryptedMessage: JSON.stringify({
              type: 'sender_key_distribution',
              senderKey: newSenderKey,
              groupId: groupId,
              isKeyRotation: true // Add a flag to indicate this is a key rotation
            }),
            type: 'sender_key_distribution'
          });
          console.log(`🔑 New Sender Key sent to ${member.userId}`);
        }
      }

      // Optionally, announce the key rotation to the group
      await this.announceGroupUpdate(group, 'key_rotated', {
        rotatedBy: rotatorId
      });

      console.log(`✅ Sender Key for group ${groupId} rotated successfully.`);

    } catch (error) {
      console.error(`Failed to rotate group key for ${groupId}:`, error);
      throw error;
    }
  }

  /**
   * Join a group when invited (receives group metadata from existing member)
   */
  async joinGroup(groupMetadata: GroupMetadata, invitedBy: string): Promise<void> {
    try {
      const userId = localStorage.getItem('userId') || '';
      
      // Check if user is in the members list
      const isMember = groupMetadata.members.some(m => m.userId === userId);
      if (!isMember) {
        throw new Error('User not invited to this group');
      }

      // Store group locally on user's device
      await chatStoreInstance.saveGroupMeta(groupMetadata.groupId, {
        ...groupMetadata,
        joinedAt: Date.now(),
        invitedBy,
        isAdmin: groupMetadata.admins.includes(userId),
        canAnnounce: false // Only receive metadata, don't announce
      });

      // Notify other members of successful join
      await this.notifyGroupJoin(groupMetadata.groupId, userId);

      console.log(`✅ Joined group "${groupMetadata.name}"`);

    } catch (error) {
      console.error('Failed to join group:', error);
      throw error;
    }
  }

  /**
   * Add member to existing group (admin only)
   */
  async addMemberToGroup(groupId: string, newMemberUserId: string, addedBy: string): Promise<void> {
    try {
      const group = await chatStoreInstance.getGroupMeta(groupId);
      if (!group) {
        throw new Error('Group not found');
      }

      // Check if user is admin
      if (!group.admins.includes(addedBy)) {
        throw new Error('Only admins can add members');
      }

      // Check if member already exists
      const existingMember = group.members.find((m: any) => m.userId === newMemberUserId);
      if (existingMember) {
        throw new Error('User is already a member');
      }

      // Add new member
      const updatedGroup = {
        ...group,
        members: [
          ...group.members,
          {
            userId: newMemberUserId,
            name: '', // Will be updated by the member
            joinedAt: Date.now(),
            isAdmin: false
          }
        ],
        version: group.version + 1,
        lastUpdated: Date.now()
      };

      // Update local group
      await chatStoreInstance.saveGroupMeta(groupId, {
        ...updatedGroup,
        needsAnnouncement: true
      });

      // Send group invitation to new member
      await this.sendGroupInvitation(newMemberUserId, updatedGroup);

      // Announce member addition to existing members
      await this.announceGroupUpdate(updatedGroup, 'member_added', {
        addedMember: newMemberUserId,
        addedBy
      });

      console.log(`✅ Added ${newMemberUserId} to group ${groupId}`);

    } catch (error) {
      console.error('Failed to add member to group:', error);
      throw error;
    }
  }

  /**
   * Leave a group
   */
  async leaveGroup(groupId: string, userId: string): Promise<void> {
    try {
      const group = await chatStoreInstance.getGroupMeta(groupId);
      if (!group) {
        throw new Error('Group not found');
      }

      // Remove user from members list
      const updatedMembers = group.members.filter((m: any) => m.userId !== userId);
      const updatedAdmins = group.admins.filter((a: any) => a !== userId);

      // If last admin is leaving, promote someone else or delete group
      if (updatedAdmins.length === 0 && updatedMembers.length > 0) {
        // Promote first remaining member to admin
        updatedAdmins.push(updatedMembers[0].userId);
        updatedMembers[0].isAdmin = true;
      }

      const updatedGroup = {
        ...group,
        members: updatedMembers,
        admins: updatedAdmins,
        version: group.version + 1,
        lastUpdated: Date.now()
      };

      if (updatedMembers.length === 0) {
        // Last member leaving - delete group locally
        await chatStoreInstance.deleteGroup(groupId);
        console.log(`🗑️ Group ${groupId} deleted (last member left)`);
      } else {
        // Announce departure to remaining members
        await this.announceGroupUpdate(updatedGroup, 'member_left', {
          leftMember: userId
        });
      }

      // Delete group from leaving user's device
      await chatStoreInstance.deleteGroup(groupId);
      console.log(`👋 Left group ${groupId}`);

    } catch (error) {
      console.error('Failed to leave group:', error);
      throw error;
    }
  }

  /**
   * Update group metadata (name, description, etc.)
   */
  async updateGroupMetadata(
    groupId: string, 
    updates: Partial<GroupMetadata>, 
    updatedBy: string
  ): Promise<void> {
    try {
      const group = await chatStoreInstance.getGroupMeta(groupId);
      if (!group) {
        throw new Error('Group not found');
      }

      // Check if user is admin
      if (!group.admins.includes(updatedBy)) {
        throw new Error('Only admins can update group metadata');
      }

      const updatedGroup = {
        ...group,
        ...updates,
        version: group.version + 1,
        lastUpdated: Date.now(),
        updatedBy
      };

      // Update local group
      await chatStoreInstance.saveGroupMeta(groupId, {
        ...updatedGroup,
        needsAnnouncement: true
      });

      // Announce update to all members
      await this.announceGroupUpdate(updatedGroup, 'metadata_updated', updates);

      console.log(`✅ Updated group ${groupId} metadata`);

    } catch (error) {
      console.error('Failed to update group metadata:', error);
      throw error;
    }
  }

  /**
   * Handle incoming group metadata updates from other members
   */
  async handleIncomingGroupUpdate(data: {
    groupId: string;
    metadata: GroupMetadata;
    action: string;
    details?: any;
    fromMember: string;
  }): Promise<void> {
    try {
      const localGroup = await chatStoreInstance.getGroupMeta(data.groupId);
      
      // Conflict resolution using version numbers
      if (!localGroup || data.metadata.version > (localGroup.version || 0)) {
        // Incoming version is newer, update local copy
        await chatStoreInstance.saveGroupMeta(data.groupId, {
          ...data.metadata,
          needsAnnouncement: false // Don't re-announce received updates
        });
        
        console.log(`📥 Updated group ${data.groupId} from ${data.fromMember} (action: ${data.action})`);
      } else if (data.metadata.version < localGroup.version) {
        // Local version is newer, send our version back
        await this.announceGroupUpdate(localGroup, 'metadata_sync', {
          syncReason: 'local_version_newer'
        });
      }
      // If versions are equal, no action needed

      // Handle key rotation trigger
      if (
        (data.action === 'member_left' || data.action === 'member_removed') &&
        localGroup && localGroup.admins.includes(localStorage.getItem('userId') || '')
      ) {
        // To prevent multiple admins from rotating the key simultaneously,
        // we'll designate the first admin in the list as the rotator.
        const currentUserId = localStorage.getItem('userId');
        if (localGroup.admins[0] === currentUserId) {
          console.log(`👑 I am the designated admin. Rotating key for group ${data.groupId} due to ${data.action}.`);
          await this.rotateGroupKey(data.groupId, currentUserId);
        } else {
          console.log(`Another admin (${localGroup.admins[0]}) will handle the key rotation.`);
        }
      }

    } catch (error) {
      console.error('Failed to handle incoming group update:', error);
    }
  }

  // Private helper methods

  private async announceGroupCreation(groupMetadata: GroupMetadata): Promise<void> {
    if (this.socket && this.socket.connected) {
      // Send individual invitations to each member (excluding the creator)
      const currentUserId = localStorage.getItem('userId') || '';
      for (const member of groupMetadata.members) {
        if (member.userId !== currentUserId) {
          await this.sendGroupInvitation(member.userId, groupMetadata);
        }
      }
      
      // Also emit group_created for any general group creation handling
      this.socket.emit('group_created', {
        groupMetadata,
        action: 'create',
        timestamp: Date.now()
      });
      console.log(`📢 Announced group creation: ${groupMetadata.name} with ${groupMetadata.members.length - 1} invitations sent`);
    }
  }

  private async sendGroupInvitation(userId: string, groupMetadata: GroupMetadata): Promise<void> {
    if (this.socket && this.socket.connected) {
      this.socket.emit('group_invitation', {
        targetUserId: userId,
        groupMetadata,
        action: 'invite',
        timestamp: Date.now()
      });
      console.log(`📨 Sent group invitation to ${userId}`);
    }
  }

  // Distribute Sender Key to group members during group creation
  private async distributeSenderKeyToMembers(groupId: string, members: GroupMember[]): Promise<void> {
    try {
      // Get my current sender key for this group
      const mySenderKey = await senderKeyStore.getMySenderKey(groupId);
      
      if (!mySenderKey) {
        console.error(`❌ No Sender Key found for group ${groupId} - cannot distribute`);
        return;
      }

      const currentUserId = localStorage.getItem('userId') || '';
      
      // Send sender key to each member (except myself)
      for (const member of members) {
        if (member.userId !== currentUserId && this.socket) {
          try {
            // Send sender key as a direct message
            this.socket.emit('direct_message', {
              receiverId: member.userId,
              senderId: currentUserId,
              senderName: localStorage.getItem('username'),
              encryptedMessage: JSON.stringify({
                type: 'sender_key_distribution',
                senderKey: mySenderKey,
                groupId: groupId
              }),
              type: 'sender_key_distribution'
            });

            console.log(`🔑 Initial Sender Key sent to ${member.userId} for group ${groupId}`);

          } catch (error) {
            console.error(`❌ Failed to send Sender Key to ${member.userId}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('❌ Failed to create group:', error);
      throw error;
    }
  }

  private async announceGroupUpdate(
    groupMetadata: GroupMetadata,
    action: string,
    details?: any
  ): Promise<void> {
    if (this.socket && this.socket.connected) {
      this.socket.emit('group_metadata_update', {
        groupId: groupMetadata.groupId,
        metadata: groupMetadata,
        action,
        details,
        timestamp: Date.now()
      });
      console.log(`📢 Announced group update: ${action} for ${groupMetadata.groupId}`);
    }
  }

  private async notifyGroupJoin(groupId: string, userId: string): Promise<void> {
    if (this.socket && this.socket.connected) {
      this.socket.emit('group_member_joined', {
        groupId,
        userId,
        timestamp: Date.now()
      });
      console.log(`📢 Notified group ${groupId} of member join: ${userId}`);
    }
  }

  /**
   * Get all groups for current user
   */
  async getUserGroups(): Promise<GroupMetadata[]> {
    try {
      const allGroups = await chatStoreInstance.getAllGroups();
      return allGroups.map(group => ({
        ...group,
        isLocalGroup: true
      }));
    } catch (error) {
      console.error('Failed to get user groups:', error);
      return [];
    }
  }

  /**
   * Get specific group metadata
   */
  async getGroupMetadata(groupId: string): Promise<GroupMetadata | null> {
    try {
      return await chatStoreInstance.getGroupMeta(groupId);
    } catch (error) {
      console.error('Failed to get group metadata:', error);
      return null;
    }
  }
}

export const whatsappGroupService = new WhatsAppGroupService();
export default whatsappGroupService;
