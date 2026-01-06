"use client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Video, X } from "lucide-react";
import MessageInput from "./message-input";
import MessageContainer from "./message-container";
import ChatPlaceHolder from "@/components/home/chat-placeholder";
import GroupMembersDialog from "./group-members-dialog";
import { useConversationStore } from "@/store/chat-store";
import CallWrapper from "../video-call/callwrapper";
import { getMe } from "@/lib/utils";

const RightPanel = () => {
  const { selectedChat, setSelectedChat } = useConversationStore();
  const me = getMe();

  const conversationName = selectedChat?.groupName || selectedChat?.name;
  const conversationImage = selectedChat?.groupImage || selectedChat?.image;
  console.log("this is selected chat",selectedChat)
  return (
    <div className="w-full flex flex-col relative">
      {/* ✅ Always render the call logic */}
      <CallWrapper userId={me._id} />

      {/* If no chat is selected, show placeholder */}
      {!selectedChat ? (
        <ChatPlaceHolder />
      ) : (
        <>
          <div className="w-full sticky top-0 z-50">
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
                    <GroupMembersDialog selectedChat={selectedChat} />
                  )}
                </div>
              </div>

              <div className="flex items-center gap-7 mr-5">
                <Video
                  size={23}
                  className="cursor-pointer"
                  onClick={() => {
                    const event = new CustomEvent("start-call");
                    window.dispatchEvent(event);
                  }}
                />
                <X
                  size={16}
                  className="cursor-pointer"
                  onClick={() => setSelectedChat(null)}
                />
              </div>
            </div>
          </div>

          <MessageContainer />
          <MessageInput />
        </>
      )}
    </div>
  );
};

export default RightPanel;
