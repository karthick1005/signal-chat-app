"use client"
import { LoginForm } from "@/components/auth/login-form"
import { Libinit } from "@/lib/signal/signal"
import { useEffect } from "react"

export default function LoginPage() {

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-3 md:p-10 border">
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  )
}
