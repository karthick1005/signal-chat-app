import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Users } from "lucide-react";
import { useConversationStore } from "@/store/chat-store";
import useWhatsAppServices from "@/hooks/useWhatsAppServices";
import toast from "react-hot-toast";
import chatStoreInstance from "@/lib/chatStoreInstance";
import { SocketContext } from "@/hooks/socket";
import { SocketInterface } from "@/lib/types";

interface CreateGroupDialogProps {
  children: React.ReactNode;
}

interface User {
  userId: string;
  username: string;
  image?: string;
}

const CreateGroupDialog: React.FC<CreateGroupDialogProps> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState(""); // Add description field
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const { fetchChats } = useConversationStore();
  const whatsappServices = useWhatsAppServices(); // Add WhatsApp services
  const { socket } = React.useContext<SocketInterface | null>(SocketContext) || {};

  // Fetch all users when dialog opens
  useEffect(() => {
    if (open) {
      fetchAllUsers();
      // Reset form when dialog opens
      setGroupName("");
      setGroupDescription("");
      setSelectedMembers([]);
    }
  }, [open]);

  const fetchAllUsers = async () => {
    try {
      setLoading(true);
      const url = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${url}/api/user/get-all`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }

      const users = await response.json();
      // Filter out current user
      const currentUserId = localStorage.getItem("userId");
      const filteredUsers = users.filter((user: User) => user.userId !== currentUserId);
      setAllUsers(filteredUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  // Get all users from chats (assuming direct chats have user info)
  // const allUsers = chats
  //   .filter((chat) => !chat.isGroup)
  //   .map((chat) => ({
  //     userId: chat.chatId,
  //     name: chat.name,
  //   }));

  const handleMemberToggle = (userId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedMembers.length === 0) {
      toast.error("Please enter a group name and select at least one member");
      return;
    }

    try {
      setLoading(true);
      const creatorId = localStorage.getItem("userId");
      
      if (!creatorId) {
        toast.error("User not logged in");
        return;
      }

      // WhatsApp-style: Create group locally and announce to members
      const groupId = await whatsappServices.createGroup(
        groupName.trim(),
        selectedMembers,
        creatorId,
        groupDescription.trim() || undefined
      );

      toast.success(`Group "${groupName}" created successfully! 📱`);
      console.log(`✅ WhatsApp-style group created locally: ${groupId}`);

      // Wait a bit for IndexedDB to flush
      await new Promise(resolve => setTimeout(resolve, 100));

      // Refresh chats to show the new local group
      console.log('🔄 Refreshing chats after group creation...');
      await fetchChats();
      
      // Announce the new group to the server so user can receive messages
      if (socket && socket.connected) {
        socket.emit("announce_groups", {
          groups: [{ groupId, name: groupName.trim() }]
        });
        console.log(`📢 Announced new group to server: ${groupName.trim()}`);
      }
      
      // Double-check by trying to retrieve the created group
      try {
        const createdGroup = await chatStoreInstance.getGroupMeta(groupId);
        console.log('🔍 Created group verification:', {
          found: !!createdGroup,
          name: createdGroup?.name,
          hasGroupKey: !!createdGroup?.groupKey,
          groupKeyLength: createdGroup?.groupKey?.length
        });
      } catch (error) {
        console.error('❌ Error verifying created group:', error);
      }

      setOpen(false);
      setGroupName("");
      setGroupDescription("");
      setSelectedMembers([]);
    } catch (error) {
      console.error("Error creating group:", error);
      toast.error("Failed to create group. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Group</DialogTitle>
          <DialogDescription>
            Create a new group chat with selected members. Groups are stored locally on your device (WhatsApp-style).
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="groupName" className="text-right">
              Group Name
            </Label>
            <Input
              id="groupName"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="col-span-3"
              placeholder="Enter group name"
            />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="groupDescription" className="text-right">
              Description
            </Label>
            <Input
              id="groupDescription"
              value={groupDescription}
              onChange={(e) => setGroupDescription(e.target.value)}
              className="col-span-3"
              placeholder="Optional group description"
            />
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label className="text-right pt-2">Members</Label>
            <div className="col-span-3 max-h-40 overflow-y-auto">
              {loading ? (
                <div className="text-sm text-gray-500 p-2">Loading users...</div>
              ) : allUsers.length === 0 ? (
                <div className="text-sm text-gray-500 p-2">No users available</div>
              ) : (
                allUsers.map((user) => (
                  <div
                    key={user.userId}
                    className={`flex items-center space-x-2 p-2 cursor-pointer rounded ${
                      selectedMembers.includes(user.userId)
                        ? "bg-blue-100 dark:bg-blue-900"
                        : "hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                    onClick={() => handleMemberToggle(user.userId)}
                  >
                    <div
                      className={`w-4 h-4 border-2 rounded ${
                        selectedMembers.includes(user.userId)
                          ? "bg-blue-500 border-blue-500"
                          : "border-gray-300"
                      }`}
                    />
                    <Label className="text-sm cursor-pointer">{user.username}</Label>
                  </div>
                ))
              )}
            </div>
          </div>
          
          {selectedMembers.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800 mb-1">
                <strong>📱 WhatsApp-style Group:</strong>
              </p>
              <p className="text-xs text-blue-600">
                • Group will be created locally on your device<br/>
                • Selected members will receive group invitations<br/>
                • No central server database - just like WhatsApp!
              </p>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateGroup} 
            disabled={loading || !groupName.trim() || selectedMembers.length === 0}
          >
            {loading ? "Creating..." : "Create Group"} 📱
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateGroupDialog;
