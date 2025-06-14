'use client'

import { onGoingCall, Participants, SocketUser } from "@/types";
import { useUser } from "@clerk/nextjs";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
interface iSocketContext {
    onlineUsers: SocketUser[] | null
    ongoingCall: onGoingCall | null
    handleCall: (user: SocketUser) => void
}

export const SocketContext = createContext<iSocketContext | null>(null)

export const SocketContextProvider = ({children}:{children:React.ReactNode}) => {
    const {user} = useUser()
    const [socket, setSocket] = useState<Socket | null>(null)
    const [isSocketConnected, setIsSocketConnected] = useState(false)
    const [onlineUsers, setOnlineUsers] = useState<SocketUser[] | null>(null);
    const [ongoingCall, setOnGoingCall] = useState<onGoingCall | null>(null);

    const currentSocketUser = onlineUsers?.find(onlineUser => onlineUser.userId === user?.id)

    const handleCall = useCallback((user: SocketUser)=> {
        if (!currentSocketUser || !socket) return;
        const participants = {caller: currentSocketUser, reciever: user}
        setOnGoingCall({
            participants,
            isRinging:false
        })
        socket.emit('call',participants);
    },[socket, currentSocketUser, ongoingCall])

    const onIncommingCall = useCallback((participants: Participants)=>{
        setOnGoingCall({
            participants,
            isRinging:true
        })
    },[socket, user, ongoingCall]) 

    console.log("Online Users >> ",onlineUsers)

    console.log('isConnected>>',isSocketConnected)

    //intialise socket.io
    useEffect(()=> {
        const newSocket = io()
        setSocket(newSocket)

        return ()=> {
            newSocket.disconnect();
        }
    },[user])

    useEffect(()=> {
        if(socket === null) return;

        if (socket.connected) {
            onConnect()
        }

        function onConnect() {
            setIsSocketConnected(true)
        }

        function onDisconnect() {
            setIsSocketConnected(false) 
        }

        socket.on('connect', onConnect)
        socket.on('disconnect',onDisconnect)

        return ()=> {
            socket.off('connect', onConnect)
            socket.off('disconnect', onDisconnect)
        }
    },[socket])

    useEffect(()=> {
        if(!socket || !isSocketConnected)  {
            return ;
        }

        socket.emit('addNewUser', user);
        socket.on('getUsers', (res)=> {
            setOnlineUsers(res)
        })

        return () => {
            socket.off('getUser', (res)=> {
                setOnlineUsers(res)
            })
        }

    },[socket, isSocketConnected, user])

    //listen to call
    useEffect (()=> {
        if(!socket || !isSocketConnected) return;

        socket.on('incommingCall', onIncommingCall);
        return ()=> {
            socket.off('incommingCall',onIncommingCall)
        }
    },[
        socket, isSocketConnected, user, onIncommingCall
    ])

    return <SocketContext.Provider value={{
        onlineUsers,
        ongoingCall,
        handleCall
    }}>
        {children}
    </SocketContext.Provider>
}

export const useSocket = () => {
    const context = useContext(SocketContext)

    if (context === null) {
        throw new Error("Use Socket must be used within a SocketContextProvider")
    }
    return context;
}