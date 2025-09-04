/**
 * WhatsApp Signal Protocol Services Hook
 * Integrates peer-to-peer group management, Sender Keys, reactions, and local-only storage
 */

import { useEffect, useRef, useContext } from 'react';
import { backgroundSyncService } from '../lib/signal/BackgroundSync';
import { reactionService } from '../lib/signal/ReactionService';
import { whatsappGroupService } from '../lib/signal/WhatsAppGroupService';
import { whatsappSignalGroupService } from '../lib/whatsappSignalGroupServiceInstance';
import { SocketContext } from './socket';

interface WhatsAppServiceConfig {
  enableBackgroundSync?: boolean;
  syncInterval?: number;
  enableReactions?: boolean;
  enablePeerToPeerGroups?: boolean;
}

export function useWhatsAppServices(config: WhatsAppServiceConfig = {}) {
  const {
    enableBackgroundSync = true,
    syncInterval = 30000,
    enableReactions = true,
    enablePeerToPeerGroups = true
  } = config;

  const socketContext = useContext(SocketContext);
  const socket = socketContext?.socket;
  const servicesInitialized = useRef(false);

  useEffect(() => {
    if (servicesInitialized.current) return;

    // Initialize services
    if (enableBackgroundSync) {
      backgroundSyncService.updateConfig({ syncInterval });
      backgroundSyncService.setSocket(socket); // Add socket reference
      backgroundSyncService.startSync();
      console.log('🔄 WhatsApp-style background sync started (peer-to-peer)');
    }

    if (enableReactions && socket) {
      reactionService.setSocket(socket);
      
      // Listen for incoming reactions
      socket.on('reaction', (data: any) => {
        reactionService.handleIncomingReaction(data);
      });
      
      console.log('👍 Reaction service initialized');
    }

    if (enablePeerToPeerGroups && socket) {
      whatsappGroupService.setSocket(socket);
      
      // Listen for incoming group events
      socket.on('group_created', (data: any) => {
        console.log('📥 Received group creation announcement:', data);
      });
      
      socket.on('group_invitation', async (data: any) => {
        console.log('📨 Received group invitation:', data);
        
        try {
          const { groupMetadata, invitedBy } = data;
          
          if (groupMetadata && groupMetadata.groupId && groupMetadata.name) {
            console.log(`📨 Processing group invitation to "${groupMetadata.name}" from ${invitedBy}`);
            
            // Auto-join the group (like WhatsApp)
            await whatsappGroupService.joinGroup(groupMetadata, invitedBy);
            
            // Announce the new group to server so user can receive messages
            if (socket && socket.connected) {
              socket.emit("announce_groups", {
                groups: [{ groupId: groupMetadata.groupId, name: groupMetadata.name }]
              });
              console.log(`📢 Announced joined group to server: ${groupMetadata.name}`);
            }
            
            // Show notification to user
            console.log(`✅ Successfully joined group: ${groupMetadata.name}`);
            
            // Trigger UI refresh to show the new group
            // This would typically trigger a state update or callback
            
          } else {
            console.warn('⚠️ Invalid group invitation data:', data);
          }
          
        } catch (error) {
          console.error('❌ Failed to process group invitation:', error);
        }
      });
      
      socket.on('group_metadata_update', (data: any) => {
        whatsappGroupService.handleIncomingGroupUpdate(data);
      });
      
      socket.on('group_member_joined', (data: any) => {
        console.log('👥 Member joined group:', data);
      });
      
      console.log('🏠 WhatsApp-style group service initialized (no central DB)');
    }

    servicesInitialized.current = true;

    // Cleanup on unmount
    return () => {
      if (enableBackgroundSync) {
        backgroundSyncService.stopSync();
      }
      
      if (socket) {
        socket.off('reaction');
        socket.off('group_created');
        socket.off('group_invitation');
        socket.off('group_metadata_update');
        socket.off('group_member_joined');
      }
      
      servicesInitialized.current = false;
    };
  }, [socket, enableBackgroundSync, enableReactions, enablePeerToPeerGroups, syncInterval]);

  // Update socket when it changes
  useEffect(() => {
    if (socket) {
      if (enableReactions) {
        reactionService.setSocket(socket);
      }
      if (enablePeerToPeerGroups) {
        whatsappGroupService.setSocket(socket);
      }
      if (enableBackgroundSync) {
        backgroundSyncService.setSocket(socket);
      }
    }
  }, [socket, enableReactions, enablePeerToPeerGroups, enableBackgroundSync]);

  const services = {
    // Background sync controls (now peer-to-peer focused)
    forceSync: () => backgroundSyncService.forcSync(),
    getSyncStatus: () => backgroundSyncService.getSyncStatus(),
    
    // Reaction controls
    addReaction: (messageId: string, emoji: string, userId: string) => 
      reactionService.addReaction(messageId, emoji, userId),
    removeReaction: (messageId: string, userId: string) => 
      reactionService.removeReaction(messageId, userId),
    toggleReaction: (messageId: string, emoji: string, userId: string) => 
      reactionService.toggleReaction(messageId, emoji, userId),
    getReactionSummary: (messageId: string, userId: string) => 
      reactionService.getReactionSummary(messageId, userId),
    
    // WhatsApp-style group controls (no central server)
    createGroup: (name: string, members: string[], creatorId: string, description?: string) =>
      whatsappGroupService.createGroup(name, members, creatorId, description),
    joinGroup: (groupMetadata: any, invitedBy: string) =>
      whatsappGroupService.joinGroup(groupMetadata, invitedBy),
    addMemberToGroup: (groupId: string, userId: string, addedBy: string) =>
      whatsappGroupService.addMemberToGroup(groupId, userId, addedBy),
    leaveGroup: (groupId: string, userId: string) =>
      whatsappGroupService.leaveGroup(groupId, userId),
    updateGroupMetadata: (groupId: string, updates: any, updatedBy: string) =>
      whatsappGroupService.updateGroupMetadata(groupId, updates, updatedBy),
    getUserGroups: () => whatsappGroupService.getUserGroups(),
    getGroupMetadata: (groupId: string) => whatsappGroupService.getGroupMetadata(groupId),
    
    // Utility functions
    retryFailedSyncs: () => reactionService.retryFailedSyncs(),
    cleanupOldData: () => backgroundSyncService.performCleanup(),
    
    // Status checks
    isOnline: () => backgroundSyncService.getSyncStatus().isOnline,
    isSyncing: () => backgroundSyncService.getSyncStatus().isSyncing,
  };

  return services;
}

export default useWhatsAppServices;
