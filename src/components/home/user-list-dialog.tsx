"use client"
import { use, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "../ui/input"
import { Button } from "../ui/button"
import { ImageIcon, MessageSquareDiff } from "lucide-react"
// import { users } from "@/dummy-data/db"
import { Id } from "@/convex/_generated/dataModel"
import { DialogClose } from "@radix-ui/react-dialog"
import toast from "react-hot-toast"
import { useConversationStore } from "@/store/chat-store"
import { getMe, SessionCreation } from "@/lib/utils"
import chatStoreInstance from "@/lib/chatStoreInstance"
const UserListDialog = () => {
  const [selectedUsers, setSelectedUsers] = useState<Id<"users">[]>([])
  const [groupName, setGroupName] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [renderedImage, setRenderedImage] = useState("")
const me=getMe()
  const imgRef = useRef<HTMLInputElement>(null)
  const dialogCloseRef = useRef<HTMLButtonElement>(null)

  // const createConversation = useMutation(api.conversations.createConversation)
  // const generateUploadUrl = useMutation(api.conversations.generateUploadUrl)
  const [users, setUsers] = useState<any[]>([])
  useEffect(() => {
    const fetchUsers = async () => {
     const url = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
       const response = await fetch(url+'/api/user/get-all', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    let allUsers = await response.json();
    allUsers=allUsers.filter((user:any) => user.userId !== me?._id)
    console.log("Fetched users:", allUsers);
      setUsers(allUsers)
    }
    fetchUsers()
  }, [])
  const { setSelectedChat } = useConversationStore()

  const handlCreateConversation = async () => {
    if (selectedUsers.length === 0) return
    setIsLoading(true)
    try {
      // const isGroup = selectedUsers.length > 1
      // let conversationId
      // if (isGroup) {
      //   // conversationId = await createConversation({
      //   //   participants: [...selectedUsers, me?._id!], // [1, 2]
      //   //   isGroup: false,
      //   // })
      // } else {
        console.log("Creating group with users:", selectedUsers)

       await SessionCreation(selectedUsers[0])
       const createdchat=await chatStoreInstance.getChatMeta(selectedUsers[0])
       console.log("Created chat:", createdchat)
       setSelectedChat(createdchat)
      // }
      dialogCloseRef.current?.click()
      setSelectedUsers([])
      // setGroupName("")
      setSelectedImage(null)

      // const conversationName = isGroup
      //   ? groupName
      //   : users?.find((user) => user._id === selectedUsers[0])?.name

      // setSelectedChat({
      //   _id: conversationId,
      //   participants: selectedUsers,
      //   isGroup,
      //   image: isGroup
      //     ? renderedImage
      //     : users?.find((user) => user._id === selectedUsers[0])?.image,
      //   name: conversationName,
      //   admin: me?._id!,
      // })
    } catch (error) {
      toast.error("Failed to create conversation")
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!selectedImage) {
      return setRenderedImage("")
    }
    const reader = new FileReader()
    reader.onload = (e) => setRenderedImage(e.target?.result as string)
    reader.readAsDataURL(selectedImage)
  }, [selectedImage])

  return (
    <Dialog>
      <DialogTrigger>
        <MessageSquareDiff size={20} />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          {/* TODO: <DialogClose /> will be here */}
          <DialogClose ref={dialogCloseRef} />
          <DialogTitle>USERS</DialogTitle>
        </DialogHeader>

        <DialogDescription>Start a new chat</DialogDescription>
        {renderedImage && (
          <div className="w-16 h-16 relative mx-auto">
            <Image
              src={renderedImage}
              fill
              alt="user image"
              className="rounded-full object-cover"
            />
          </div>
        )}
        {/* TODO: input file */}
        <input
          type="file"
          accept="image/*"
          ref={imgRef}
          hidden
          onChange={(e) => setSelectedImage(e.target.files![0])}
        />
        {selectedUsers.length > 1 && (
          <>
            <Input
              placeholder="Group Name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
            <Button
              className="flex gap-2"
              onClick={() => imgRef.current?.click()}
            >
              <ImageIcon size={20} />
              Group Image
            </Button>
          </>
        )}
        <div className="flex flex-col gap-3 overflow-auto max-h-60">
          {users?.map((user) => (
            <div
              key={user._id}
              className={`flex gap-3 items-center p-2 rounded cursor-pointer active:scale-95 
								transition-all ease-in-out duration-300
							${selectedUsers.includes(user.userId) ? "bg-green-primary" : ""}`}
              onClick={() => {
                if (selectedUsers.includes(user.userId)) {
                  setSelectedUsers(
                    selectedUsers.filter((id) => id !== user.userId)
                  )
                } else {
                  setSelectedUsers([...selectedUsers, user.userId])
                }
              }}
            >
              <Avatar className="overflow-visible">
                {user.isOnline && (
                  <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-foreground" />
                )}

                <AvatarImage
                  src={user.image}
                  className="rounded-full object-cover"
                />
                <AvatarFallback>
                  <div className="animate-pulse bg-gray-tertiary w-full h-full rounded-full"></div>
                </AvatarFallback>
              </Avatar>

              <div className="w-full ">
                <div className="flex items-center justify-between">
                  <p className="text-md font-medium">
                    {user?.username || user?.email?.split("@")[0]}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between">
          <Button variant={"outline"}>Cancel</Button>
          <Button
            onClick={handlCreateConversation}
            disabled={
              selectedUsers.length === 0 ||
              (selectedUsers.length > 1 && !groupName) ||
              isLoading
            }
          >
            {/* spinner */}
            {isLoading ? (
              <div className="w-5 h-5 border-t-2 border-b-2  rounded-full animate-spin" />
            ) : (
              "Create"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
export default UserListDialog
