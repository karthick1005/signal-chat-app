import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar"
import { Crown } from "lucide-react"
import { Conversation } from "@/store/chat-store"

type GroupMembersDialogProps = {
  selectedChat: Conversation
}

const GroupMembersDialog = ({
  selectedChat,
}: GroupMembersDialogProps) => {
  const users = selectedChat.members || []
  console.log("📋 Group Members Dialog - selectedChat:", {
    chatId: selectedChat.chatId,
    name: selectedChat.name,
    members: selectedChat.members,
    admins: selectedChat.admins
  })

  return (
    <Dialog>
      <DialogTrigger>
        <p className="text-xs text-muted-foreground text-left">See members</p>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="my-2">Current Members</DialogTitle>
          <DialogDescription>
            <div className="flex flex-col gap-3 ">
              {users?.length > 0 ? users.map((user) => (
                <div
                  key={user.userId}
                  className={`flex gap-3 items-center p-2 rounded`}
                >
                  <Avatar className="overflow-visible">
                    <AvatarImage
                      src="/placeholder.png"
                      className="rounded-full object-cover"
                    />
                    <AvatarFallback>
                      <div className="animate-pulse bg-gray-tertiary w-full h-full rounded-full"></div>
                    </AvatarFallback>
                  </Avatar>

                  <div className="w-full ">
                    <div className="flex items-center gap-2">
                      <h3 className="text-md font-medium">
                    
                        {user.name || user.userId}
                      </h3>
                      {user.isAdmin && (
                        <Crown size={16} className="text-yellow-400" />
                      )}
                    </div>
                  </div>
                </div>
              )) : (
                <p className="text-sm text-muted-foreground">No members found</p>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  )
}
export default GroupMembersDialog
