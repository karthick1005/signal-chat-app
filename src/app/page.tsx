"use client";

import LeftPanel from "@/components/home/left-panel"
import RightPanel from "@/components/home/right-panel"
import { useTheme } from "next-themes"
import { useContext, useEffect, useState } from "react";
import { useRouter } from 'next/navigation';
import { Libinit } from "@/lib/signal/signal";
import ChatStore from "@/lib/signal/ChatStore";
import chatStoreInstance from "@/lib/chatStoreInstance";
import { useConversationStore } from "@/store/chat-store";
import { SocketInterface } from "@/lib/types";
import { SocketContext } from "@/hooks/socket";

export default function Home() {
 const router = useRouter();
 const { fetchChats } = useConversationStore();
const { connectSocket } =
    useContext<SocketInterface | null>(SocketContext) || {};
useEffect(() => {
  const unsubscribe = chatStoreInstance.subscribe(async () => {
    console.log("🔔 Zustand subscriber triggered");
    // const [chats, messages] = await Promise.all([
    //   chatStoreInstance.getAllChats(),
    //   activeChatId ? chatStoreInstance.getMessages(activeChatId) : Promise.resolve([]),
    // ]);

    // const selectedChat = chats.find((c) => c.chatId === activeChatId) || null;

    // set({ chats, messages, selectedChat });
  });
  console.log("🔔 Zustand subscriber initialized");
  return () => unsubscribe();
}, []);




  useEffect(()=>{
    Libinit()
    if (typeof connectSocket === "function") {
      connectSocket();
      // Fetch chats after socket connects
      setTimeout(() => {
        fetchChats();
      }, 1000); // Small delay to ensure socket is fully connected
    }
  },[connectSocket, fetchChats])
  useEffect(() => {
    console.log("Checking preKeyBundle in localStorage",localStorage.getItem("preKeyBundle"));
    if(localStorage.getItem("preKeyBundle") === null){
      router.push("/login")
    }
  },[])

  return (
    <main className="m-5">
      <div className="flex overflow-y-hidden h-[calc(100vh-50px)] max-w-[1700px] mx-auto bg-left-panel">
        {/* Green background decorator for Light Mode */}
        <div className="fixed top-0 left-0 w-full h-36 bg-green-primary dark:bg-transparent -z-30" />
        <LeftPanel />
        <RightPanel />
      </div>
    </main>
  )
}
