import {io} from '../../server.js'

const onHangUp = async(data)=>{
    let socketIdToEmitTo;

    if(data.ongoingCall.participants.caller.userId === data.userHangingupId) {
        socketIdToEmitTo = data.ongoingCall.participants.reciever.socketId
    }else {
        socketIdToEmitTo = data.ongoingCall.participants.caller.socketId
    }

    if(socketIdToEmitTo) {
        io.to(socketIdToEmitTo).emit('hangup')
    }
}

export default onHangUp;