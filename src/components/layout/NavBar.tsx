'use client'

import { Video } from "lucide-react"
import Container from "./Container"
import { useRouter } from "next/navigation"
import { useAuth, UserButton } from "@clerk/nextjs"

const NavBar = () => {
  const router = useRouter()
  const {userId} = useAuth()

  return (
    <div>
      <Container>
        <div>
          <div
            className="flex items-center gap-1 cursor-pointer"
            onClick={() => {
              router.push('/')
            }}
          >
            <Video />
            <div className="font-bold text-xl">Video Chat</div>
          </div>
        </div>
      </Container>
    </div>
  )
}

export default NavBar
