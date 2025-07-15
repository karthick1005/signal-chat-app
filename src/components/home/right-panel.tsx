"use client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Video, X } from "lucide-react"
import MessageInput from "./message-input"
import MessageContainer from "./message-container"
import ChatPlaceHolder from "@/components/home/chat-placeholder"
import GroupMembersDialog from "./group-members-dialog"
import { useConversationStore } from "@/store/chat-store"
import CallWrapper from "../video-call/callwrapper"
import { getMe } from "@/lib/utils"
import { useState } from "react"

const RightPanel = () => {
  const { selectedChat, setSelectedChat } =
    useConversationStore()
  const me=getMe()
  const [enablecall,setenablecall]=useState(false)

  // if (isLoading) return null
  if (!selectedChat) return <ChatPlaceHolder />
  const conversationName =
    selectedChat.groupName || selectedChat.name
  const conversationImage =
    selectedChat.groupImage || selectedChat.image

  return (
    <div className="w-3/4 flex flex-col">
      <div className="w-full sticky top-0 z-50">
        {/* Header */}
        <div className="flex justify-between bg-gray-primary p-3">
          <div className="flex gap-3 items-center">
            <Avatar>
              <AvatarImage
                src={conversationImage || "/placeholder.png"}
                className="object-cover"
              />
              <AvatarFallback>
                <div className="animate-pulse bg-gray-tertiary w-full h-full rounded-full" />
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <p>{conversationName}</p>
              {selectedChat.isGroup && (
                <GroupMembersDialog
                  selectedChat={selectedChat}
                />
              )}
            </div>
          </div>

          <div className="flex items-center gap-7 mr-5">
            <button onClick={() => setenablecall(true)}>
              <Video size={23} />
            </button>
            <X
              size={16}
              className="cursor-pointer"
              onClick={() => setSelectedChat(null)}
            />
          </div>
        </div>
      </div>
      {/* CHAT MESSAGES */}
      <MessageContainer />

      {/* INPUT */}
      <MessageInput />
      {enablecall&&<CallWrapper userId={me._id} peerId={selectedChat.chatId}  callId={crypto.randomUUID()} startcall={enablecall} stopcall={setenablecall}/>}
    </div>
  )
}
export default RightPanel