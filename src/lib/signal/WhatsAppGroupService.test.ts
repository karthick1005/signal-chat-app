import { WhatsAppGroupService } from './WhatsAppGroupService';
import chatStoreInstance from '../chatStoreInstance';
import { senderKeyStore } from './SenderKeyStore';

// Mock dependencies
jest.mock('../chatStoreInstance', () => ({
  getGroupMeta: jest.fn(),
  saveGroupMeta: jest.fn(),
  deleteGroup: jest.fn(),
}));

jest.mock('./SenderKeyStore', () => ({
  senderKeyStore: {
    generateMySenderKey: jest.fn(),
    initialize: jest.fn(),
  },
}));

const mockSocket = {
  emit: jest.fn(),
  connected: true,
};

describe('WhatsAppGroupService', () => {
  let groupService: WhatsAppGroupService;
  const adminId = 'user-admin';
  const member1Id = 'user-member-1';
  const member2Id = 'user-member-2';
  const groupId = 'group-1';

  const mockGroup = {
    groupId,
    name: 'Test Group',
    admins: [adminId],
    members: [
      { userId: adminId, isAdmin: true },
      { userId: member1Id, isAdmin: false },
      { userId: member2Id, isAdmin: false },
    ],
    version: 1,
  };

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Create a new instance of the service for each test
    groupService = new WhatsAppGroupService(mockSocket);

    // Mock the localStorage
    Storage.prototype.getItem = jest.fn((key) => {
        if (key === 'userId') return adminId;
        return null;
    });

    // Setup default mock implementations
    (chatStoreInstance.getGroupMeta as jest.Mock).mockResolvedValue(mockGroup);
    (senderKeyStore.generateMySenderKey as jest.Mock).mockResolvedValue({ id: 'new-key-id' });
  });

  describe('removeMemberFromGroup', () => {
    it('should throw an error if the remover is not an admin', async () => {
      const nonAdminId = 'not-an-admin';
      await expect(
        groupService.removeMemberFromGroup(groupId, member1Id, nonAdminId)
      ).rejects.toThrow('Only admins can remove members');
    });

    it('should throw an error if an admin tries to remove themselves', async () => {
      await expect(
        groupService.removeMemberFromGroup(groupId, adminId, adminId)
      ).rejects.toThrow('Admins cannot remove themselves, use "Leave Group" instead.');
    });

    it('should correctly update group metadata when a member is removed', async () => {
      await groupService.removeMemberFromGroup(groupId, member1Id, adminId);

      const expectedUpdatedGroup = {
        ...mockGroup,
        members: mockGroup.members.filter(m => m.userId !== member1Id),
        admins: mockGroup.admins, // No change in admins
        version: mockGroup.version + 1,
        lastUpdated: expect.any(Number),
        needsAnnouncement: true,
      };

      expect(chatStoreInstance.saveGroupMeta).toHaveBeenCalledWith(groupId, expectedUpdatedGroup);
    });

    it('should announce "member_removed" to the group', async () => {
      await groupService.removeMemberFromGroup(groupId, member1Id, adminId);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'group_metadata_update',
        expect.objectContaining({
          action: 'member_removed',
          details: {
            removedMember: member1Id,
            removedBy: adminId,
          },
        })
      );
    });

    it('should send a "group_removed" notification to the removed member', async () => {
      await groupService.removeMemberFromGroup(groupId, member1Id, adminId);

      expect(mockSocket.emit).toHaveBeenCalledWith('group_removed', {
        targetUserId: member1Id,
        groupId: groupId,
        removedBy: adminId,
      });
    });

    it('should NOT call rotateGroupKey directly', async () => {
        const rotateSpy = jest.spyOn(groupService, 'rotateGroupKey');
        await groupService.removeMemberFromGroup(groupId, member1Id, adminId);
        expect(rotateSpy).not.toHaveBeenCalled();
    });
  });

  describe('rotateGroupKey', () => {
    it('should throw an error if the rotator is not an admin', async () => {
      const nonAdminId = 'not-an-admin';
      await expect(groupService.rotateGroupKey(groupId, nonAdminId)).rejects.toThrow(
        'Only admins can rotate group keys'
      );
    });

    it('should generate a new sender key', async () => {
      await groupService.rotateGroupKey(groupId, adminId);
      expect(senderKeyStore.generateMySenderKey).toHaveBeenCalledWith(groupId, adminId);
    });

    it('should distribute the new key to all members', async () => {
      await groupService.rotateGroupKey(groupId, adminId);
      // Called for each of the 3 members
      expect(mockSocket.emit).toHaveBeenCalledTimes(mockGroup.members.length + 1); // +1 for announceGroupUpdate

      for (const member of mockGroup.members) {
        expect(mockSocket.emit).toHaveBeenCalledWith(
          'direct_message',
          expect.objectContaining({
            receiverId: member.userId,
            type: 'sender_key_distribution',
            encryptedMessage: expect.stringContaining('"isKeyRotation":true'),
          })
        );
      }
    });

    it('should announce "key_rotated" to the group', async () => {
        await groupService.rotateGroupKey(groupId, adminId);
        expect(mockSocket.emit).toHaveBeenCalledWith(
            'group_metadata_update',
            expect.objectContaining({
                action: 'key_rotated',
                details: { rotatedBy: adminId },
            })
        );
    });
  });

  describe('handleIncomingGroupUpdate', () => {
    let rotateSpy: jest.SpyInstance;

    beforeEach(() => {
      rotateSpy = jest.spyOn(groupService, 'rotateGroupKey').mockResolvedValue(undefined);
    });

    afterEach(() => {
      rotateSpy.mockRestore();
    });

    it('should call rotateGroupKey if designated admin receives member_removed', async () => {
      const updateData = {
        groupId,
        metadata: mockGroup,
        action: 'member_removed',
        fromMember: 'any-member',
      };
      (Storage.prototype.getItem as jest.Mock).mockReturnValue(adminId);
      await groupService.handleIncomingGroupUpdate(updateData);
      expect(rotateSpy).toHaveBeenCalledWith(groupId, adminId);
    });

    it('should NOT call rotateGroupKey if a non-designated admin receives member_removed', async () => {
      const secondAdminId = 'user-admin-2';
      const groupWithTwoAdmins = {
        ...mockGroup,
        admins: [adminId, secondAdminId],
        members: [...mockGroup.members, { userId: secondAdminId, isAdmin: true }],
      };
      (chatStoreInstance.getGroupMeta as jest.Mock).mockResolvedValue(groupWithTwoAdmins);
      (Storage.prototype.getItem as jest.Mock).mockReturnValue(secondAdminId);

      const updateData = {
        groupId,
        metadata: groupWithTwoAdmins,
        action: 'member_removed',
        fromMember: 'any-member',
      };

      await groupService.handleIncomingGroupUpdate(updateData);
      expect(rotateSpy).not.toHaveBeenCalled();
    });

    it('should call rotateGroupKey if designated admin receives member_left', async () => {
      const updateData = {
        groupId,
        metadata: mockGroup,
        action: 'member_left',
        fromMember: 'any-member',
      };
      (Storage.prototype.getItem as jest.Mock).mockReturnValue(adminId);
      await groupService.handleIncomingGroupUpdate(updateData);
      expect(rotateSpy).toHaveBeenCalledWith(groupId, adminId);
    });
  });
});
