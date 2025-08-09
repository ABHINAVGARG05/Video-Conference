'use client'

import { onGoingCall, Participants, PeerData, SocketUser } from "@/types";
import { useUser } from "@clerk/nextjs";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import Peer, { SignalData } from 'simple-peer'
interface iSocketContext {
    onlineUsers: SocketUser[] | null
    ongoingCall: onGoingCall | null
    localStream: MediaStream | null
    peer: PeerData | null
    isCallEnded : boolean
    handleCall: (user: SocketUser) => void
    handleJoinCall: (ongoingCall: onGoingCall) => void
    handleHungUp : (data:{ongoingCall ?: onGoingCall, isEmitHangUp ?: boolean}) => void
}

export const SocketContext = createContext<iSocketContext | null>(null)

export const SocketContextProvider = ({children}:{children:React.ReactNode}) => {
    const {user} = useUser()
    const [socket, setSocket] = useState<Socket | null>(null)
    const [isSocketConnected, setIsSocketConnected] = useState(false)
    const [onlineUsers, setOnlineUsers] = useState<SocketUser[] | null>(null);
    const [ongoingCall, setOnGoingCall] = useState<onGoingCall | null>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [peer, setPeer] = useState<PeerData | null>(null);
    const [isCallEnded, setIsCallEnded] = useState(false)

    const currentSocketUser = onlineUsers?.find(onlineUser => onlineUser.userId === user?.id)

    const getMediaStream = useCallback(async(faceMode?: string)=>{
        if(localStream) return localStream;

        try {
            const devices = await navigator.mediaDevices.enumerateDevices()
            const videoDevices = devices.filter(device => device.kind === 'videoinput')

            const stream = await navigator.mediaDevices.getUserMedia({
                audio:true,
                video:{
                    width:{min:640, ideal: 1280, max:1920},
                    height:{min: 360, ideal: 720, max:1080},
                    frameRate:{min:16, ideal:30, max:30},
                    facingMode: videoDevices.length> 0 ? faceMode: undefined

                }
            })
            setLocalStream(stream);
            return stream
        }catch(e) {
            console.log(`failed to log stream due to : ${e}`)
            setLocalStream(null)
            return null;
        }

    },[localStream])

    const handleCall = useCallback(async (user: SocketUser)=> {
        setIsCallEnded(false)
        if (!currentSocketUser || !socket) return;

        const stream = await getMediaStream();

        if (!stream) {
            console.log("No Stream in Handle Call")
            return;
        }

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

    const handleHungUp = useCallback((data:{ongoingCall ?: onGoingCall | null , isEmitHangup ?: boolean})=>{
        if (socket && user && data?.ongoingCall && data?.isEmitHangup) {
            socket.emit('hangup',{
                ongoingCall: data.ongoingCall,
                userHangingupId : user.id
            })
        }

        setOnGoingCall(null)    
        setPeer(null)
        if(localStream) {
            localStream.getTracks().forEach((track)=> track.stop())
            setLocalStream(null)
        }
        setIsCallEnded(true)

    },[socket, user, localStream])

    const createPeer = useCallback((stream:MediaStream, initiator:boolean)=>{
        const iceServers:RTCIceServer[] = [
            {
                urls:[
                    "stun:stun.1.google.com:19302",
                    "stun:stun1.1.google.com:19302",
                    "stun:stun2.1.google.com:19302",
                    "stun:stun3.1.google.com:19302"
                ]
            }
        ]

        const peer = new Peer ({
            stream, 
            initiator,
            trickle:true,
            config:{iceServers}
        })

        peer.on('stream',(stream)=>{
            setPeer((prevPeer)=>{
                if(prevPeer) {
                    return {...prevPeer, stream}
                }
                return prevPeer
            })
        })
        peer.on('error', console.error);
        peer.on('close',()=> handleHungUp({}))

        const rtcPeerConnection: RTCPeerConnection = (peer)._pc
    
        rtcPeerConnection.oniceconnectionstatechange = async()=> {
            if (rtcPeerConnection.iceConnectionState === 'disconnected'||
                rtcPeerConnection.iceConnectionState === 'failed'
            ) {
                handleHungUp({})
            }
        }

        return peer
    },[ongoingCall, setPeer])

    const completeConnection = useCallback(async(connectionData: {sdp:SignalData, ongoingCall: onGoingCall, isCaller:boolean})=>{

        if(!localStream) {
            console.log("missing local stream")
            return;
        }

        if(peer) {
            peer.peerConnection?.signal(connectionData.sdp)
            return;
        }

        const newPeer = createPeer(localStream, true);

        setPeer({
            peerConnection: newPeer,
            participantUser: connectionData.ongoingCall.participants.reciever,
            stream: undefined
        })

        newPeer.on('signal',async(data: SignalData)=> {
            if(socket) {
                //console.log('emit off')
                socket.emit('webrtcSignal',{
                    sdp:data,
                    ongoingCall,
                    isCaller: true
                })
            }
        })        

    },[localStream,createPeer,peer,ongoingCall])

    const handleJoinCall = useCallback(async(ongoingCall: onGoingCall)=> {
        //join call
        setIsCallEnded(false)
        setOnGoingCall(prev => {
            if(prev) {
                return {...prev, isRinging:false}
            }
            return prev
        })

        const stream = await getMediaStream()

        if(!stream) {
            console.log("stream not found in handle join call");
            return;
        }

        const newPeer = createPeer(stream, true);

        setPeer({
            peerConnection: newPeer,
            participantUser: ongoingCall.participants.caller,
            stream: undefined
        })

        newPeer.on('signal',async(data: SignalData)=> {
            if(socket) {
                //console.log('emit off')
                socket.emit('webrtcSignal',{
                    sdp:data,
                    ongoingCall,
                    isCaller: false
                })
            }
        })

    },[socket, currentSocketUser])

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
        socket.on('webrtcSignal',completeConnection)
        socket.on('hangup',handleHungUp)
        return ()=> {
            socket.off('incommingCall',onIncommingCall)
            socket.off('webrtcSignal',completeConnection)
            socket.off('hangup',handleHungUp)
        }
    },[
        socket, isSocketConnected, user, onIncommingCall, completeConnection
    ])

    useEffect(()=>{
        let TimeOut : ReturnType<typeof setTimeout>

        if(isCallEnded) {
            TimeOut = setTimeout(()=>{
                setIsCallEnded(false)
            },2000)
        }

        return ()=>clearTimeout(TimeOut)
    },[isCallEnded])

    return <SocketContext.Provider value={{
        onlineUsers,
        ongoingCall,
        localStream,
        handleCall,
        peer,
        handleJoinCall,
        handleHungUp,
        isCallEnded
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
