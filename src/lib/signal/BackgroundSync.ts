/**
 * BackgroundSync Service - WhatsApp-like Background Synchronization
 * Handles syncing groups and reactions with the server in the background
 */

import chatStoreInstance from '../chatStoreInstance';

interface SyncConfig {
  syncInterval: number; // in milliseconds
  maxRetries: number;
  retryDelay: number;
}

class BackgroundSyncService {
  private syncTimer: NodeJS.Timeout | null = null;
  private isOnline: boolean = true;
  private isSyncing: boolean = false;
  private socket: any = null; // Add socket reference
  private config: SyncConfig = {
    syncInterval: 30000, // 30 seconds
    maxRetries: 3,
    retryDelay: 5000, // 5 seconds
  };

  constructor() {
    this.setupNetworkListeners();
  }

  // Add method to set socket
  setSocket(socket: any): void {
    this.socket = socket;
  }

  private setupNetworkListeners(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        console.log('📶 Network back online - starting background sync');
        this.startSync();
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        console.log('📵 Network offline - pausing background sync');
        this.stopSync();
      });

      // Initial network status
      this.isOnline = navigator.onLine;
    }
  }

  startSync(): void {
    if (this.syncTimer || !this.isOnline) return;

    console.log('🔄 Starting background sync service');
    this.syncTimer = setInterval(() => {
      this.performSync();
    }, this.config.syncInterval);

    // Perform immediate sync
    this.performSync();
  }

  stopSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      console.log('⏸️ Background sync service stopped');
    }
  }

  private async performSync(): Promise<void> {
    if (this.isSyncing || !this.isOnline) return;

    this.isSyncing = true;
    console.log('🔄 Performing background sync...');

    try {
      await Promise.all([
        this.syncGroups(),
        this.syncReactions(),
      ]);
      console.log('✅ Background sync completed successfully');
    } catch (error) {
      console.error('❌ Background sync failed:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  private async syncGroups(): Promise<void> {
    try {
      // WhatsApp approach: Groups don't sync to a central server
      // Instead, group metadata is shared peer-to-peer through messages
      const groupsNeedingAnnouncement = await chatStoreInstance.getGroupsForAnnouncement();
      
      for (const group of groupsNeedingAnnouncement) {
        await this.announceGroupMetadata(group);
      }

      // Also handle any incoming group metadata updates from other members
      await this.processIncomingGroupUpdates();
    } catch (error) {
      console.error('Failed to process group metadata:', error);
      throw error;
    }
  }

  private async announceGroupMetadata(group: any): Promise<void> {
    // WhatsApp-style: Announce group metadata to members through the messaging system
    // This could be done via special control messages
    try {
      if (this.socket && this.socket.connected) {
        // Send group metadata update to all group members
        this.socket.emit('group_metadata_update', {
          groupId: group.groupId,
          metadata: {
            name: group.name,
            description: group.description,
            members: group.members,
            admins: group.admins,
            version: group.version,
            lastUpdated: group.lastUpdated
          },
          action: 'announce'
        });
        
        // Mark as announced
        await chatStoreInstance.saveGroupMeta(group.groupId, {
          ...group,
          needsAnnouncement: false,
          lastAnnounced: Date.now()
        });
        
        console.log(`📢 Group metadata announced for ${group.groupId}`);
      }
    } catch (error) {
      console.error(`Failed to announce group metadata for ${group.groupId}:`, error);
    }
  }

  private async processIncomingGroupUpdates(): Promise<void> {
    // In a real implementation, this would process queued group metadata updates
    // received from other group members
    console.log('📥 Processing incoming group metadata updates...');
  }

  // WhatsApp-style: Handle incoming group metadata from other members
  async handleGroupMetadataUpdate(data: {
    groupId: string;
    metadata: any;
    fromMember: string;
    version: number;
  }): Promise<void> {
    try {
      const localGroup = await chatStoreInstance.getGroupMeta(data.groupId);
      
      // Conflict resolution: Use version numbers like WhatsApp
      if (!localGroup || data.version > (localGroup.version || 0)) {
        // Incoming metadata is newer, update local copy
        await chatStoreInstance.saveGroupMeta(data.groupId, {
          ...data.metadata,
          version: data.version,
          lastUpdated: Date.now(),
          updatedBy: data.fromMember
        });
        
        console.log(`📥 Updated group ${data.groupId} metadata from ${data.fromMember}`);
      } else {
        console.log(`📊 Ignored older group metadata for ${data.groupId}`);
      }
    } catch (error) {
      console.error('Failed to handle group metadata update:', error);
    }
  }

  private async syncReactions(): Promise<void> {
    try {
      const pendingReactions = await chatStoreInstance.getAllPendingReactions();
      
      for (const reaction of pendingReactions) {
        await this.syncSingleReaction(reaction);
      }
    } catch (error) {
      console.error('Failed to sync reactions:', error);
      throw error;
    }
  }

  private async syncSingleReaction(reaction: any): Promise<void> {
    let retries = 0;
    
    while (retries < this.config.maxRetries) {
      try {
        await chatStoreInstance.updateReactionSyncStatus(
          reaction.messageId, 
          reaction.userId, 
          'syncing'
        );

        // Send reaction to server via socket or API
        const response = await fetch('/api/reactions/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messageId: reaction.messageId,
            userId: reaction.userId,
            emoji: reaction.emoji,
            timestamp: reaction.timestamp,
            action: reaction.emoji ? 'add' : 'remove'
          }),
        });

        if (!response.ok) {
          throw new Error(`Server responded with ${response.status}`);
        }

        await chatStoreInstance.updateReactionSyncStatus(
          reaction.messageId, 
          reaction.userId, 
          'synced'
        );
        console.log(`✅ Reaction ${reaction.id} synced successfully`);
        break;

      } catch (error) {
        retries++;
        console.warn(`⚠️ Failed to sync reaction ${reaction.id}, attempt ${retries}:`, error);
        
        if (retries >= this.config.maxRetries) {
          // Mark as local again for next sync attempt
          await chatStoreInstance.updateReactionSyncStatus(
            reaction.messageId, 
            reaction.userId, 
            'local'
          );
          throw error;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
      }
    }
  }

  // Manual sync trigger
  async forcSync(): Promise<void> {
    if (this.isSyncing) {
      console.log('Sync already in progress...');
      return;
    }
    
    console.log('🔄 Manual sync triggered');
    await this.performSync();
  }

  // Get sync status
  getSyncStatus(): { isOnline: boolean; isSyncing: boolean } {
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing
    };
  }

  // Update sync configuration
  updateConfig(newConfig: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart sync with new interval if it's running
    if (this.syncTimer) {
      this.stopSync();
      this.startSync();
    }
  }

  // Cleanup old data periodically
  async performCleanup(): Promise<void> {
    try {
      await chatStoreInstance.cleanupOldData();
      console.log('🧹 Cleanup completed');
    } catch (error) {
      console.error('Failed to perform cleanup:', error);
    }
  }
}

export const backgroundSyncService = new BackgroundSyncService();
export default backgroundSyncService;
