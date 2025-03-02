import React, { useEffect, useState, useRef } from 'react';
import {
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import TextInputContainer from '../../components/ui/TextInputContainer';
import SocketIOClient from 'socket.io-client';
import {
  mediaDevices,
  MediaStream,
  RTCPeerConnection,
  RTCView,
  RTCIceCandidate,
  RTCSessionDescription,
} from 'react-native-webrtc';
import CallEnd from '../../assets/svgs/CallEnd';
import CallAnswer from '../../assets/svgs/CallAnswer';
import MicOn from '../../assets/svgs/MicOn';
import MicOff from '../../assets/svgs/MicOff';
import VideoOn from '../../assets/svgs/VideoOn';
import VideoOff from '../../assets/svgs/VideoOff';
import CameraSwitch from '../../assets/svgs/CameraSwitch';
import IconContainer from '../../components/ui/IconContainer';
import InCallManager from 'react-native-incall-manager';

export default function App() {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [type, setType] = useState<'JOIN' | 'INCOMING_CALL' | 'OUTGOING_CALL' | 'WEBRTC_ROOM'>('JOIN');
  const [callerId] = useState(1);
  const otherUserId = useRef<string | null>(null);
  const socket = useRef(SocketIOClient('http://192.168.2.201:3500', {
    transports: ['websocket'],
    query: {
      callerId,
    },
  })).current;

  const [localMicOn, setLocalMicOn] = useState(true);
  const [localWebcamOn, setLocalWebcamOn] = useState(true);

  const peerConnection = useRef(new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
  }));

  let remoteRTCMessage = useRef<any>(null);

  useEffect(() => {
    socket.on('newCall', (data) => {
      remoteRTCMessage.current = data.rtcMessage;
      otherUserId.current = data.callerId;
      setType('INCOMING_CALL');
    });

    socket.on('callAnswered', (data) => {
      remoteRTCMessage.current = data.rtcMessage;
      if (remoteRTCMessage.current) {
        peerConnection.current.setRemoteDescription(new RTCSessionDescription(remoteRTCMessage.current));
        setType('WEBRTC_ROOM');
      }
    });

    socket.on('ICEcandidate', (data) => {
      const message = data.rtcMessage;
      if (peerConnection.current) {
        peerConnection.current.addIceCandidate(new RTCIceCandidate({
          candidate: message.candidate,
          sdpMid: message.id,
          sdpMLineIndex: message.label,
        })).catch(err => console.error('Error adding ICE candidate', err));
      }
    });

    mediaDevices.enumerateDevices().then((sourceInfos) => {
      if (!Array.isArray(sourceInfos)) return;
      let videoSourceId: string | undefined;
      for (const sourceInfo of sourceInfos) {
        if (sourceInfo.kind === 'videoinput') {
          videoSourceId = sourceInfo.deviceId;
        }
      }

      mediaDevices.getUserMedia({
        audio: true,
        video: {
          width: { min: 500 },
          height: { min: 300 },
          frameRate: { min: 30 },
          facingMode: 'user',
          deviceId: videoSourceId ? { exact: videoSourceId } : undefined,
        },
      }).then(stream => {
        setLocalStream(stream);
        stream.getTracks().forEach(track => {
          peerConnection.current.addTrack(track, stream);
        });
      }).catch(error => console.error('Error getting user media', error));
    });

    peerConnection.current.addEventListener('track', (event) => {
      setRemoteStream(event.streams[0]);
    });

    peerConnection.current.addEventListener('icecandidate', (event) => {
      if (event.candidate) {
        sendICEcandidate({
          calleeId: otherUserId.current,
          rtcMessage: {
            label: event.candidate.sdpMLineIndex,
            id: event.candidate.sdpMid,
            candidate: event.candidate.candidate,
          },
        });
      } else {
        console.log('End of candidates.');
      }
    });

    return () => {
      socket.off('newCall');
      socket.off('callAnswered');
      socket.off('ICEcandidate');
    };
  }, []);
  useEffect(() => {
    InCallManager.start();
    InCallManager.setKeepScreenOn(true);
    InCallManager.setForceSpeakerphoneOn(true);

    return () => {
      InCallManager.stop();
    };
  }, []);

  function sendICEcandidate(data: any) {
    socket.emit('ICEcandidate', data);
  }

  async function processCall() {
    const sessionDescription = await peerConnection.current.createOffer({});
    await peerConnection.current.setLocalDescription(sessionDescription);
    sendCall({
      calleeId: otherUserId.current,
      rtcMessage: sessionDescription,
    });
  }

  async function processAccept() {
    peerConnection.current.setRemoteDescription(new RTCSessionDescription(remoteRTCMessage.current));
    const sessionDescription = await peerConnection.current.createAnswer();
    await peerConnection.current.setLocalDescription(sessionDescription);
    answerCall({
      callerId: otherUserId.current,
      rtcMessage: sessionDescription,
    });
  }

  function answerCall(data: any) {
    socket.emit('answerCall', data);
  }

  function sendCall(data: any) {
    socket.emit('call', data);
  }

  const JoinScreen = () => (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{
        flex: 1,
        backgroundColor: '#050A0E',
        justifyContent: 'center',
        paddingHorizontal: 42,
      }}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <>
          <View style={{
            padding: 35,
            backgroundColor: '#1A1C22',
            justifyContent: 'center',
            alignItems: 'center',
            borderRadius: 14,
          }}>
            <Text style={{ fontSize: 18, color: '#D0D4DD' }}>Your Caller ID</Text>
            <View style={{
              flexDirection: 'row',
              marginTop: 12,
              alignItems: 'center',
            }}>
              <Text style={{ fontSize: 32, color: '#ffff', letterSpacing: 6 }}>
                {callerId}
              </Text>
            </View>
          </View>

          <View style={{
            backgroundColor: '#1A1C22',
            padding: 40,
            marginTop: 25,
            justifyContent: 'center',
            borderRadius: 14,
          }}>
            <Text style={{ fontSize: 18, color: '#D0D4DD' }}>
              Enter call id of another user
            </Text>
            <TextInputContainer
              placeholder={'Enter Caller ID'}
              value={otherUserId.current || ''}
              setValue={text => {
                otherUserId.current = text;
              }}
              keyboardType={'number-pad'}
            />
            <TouchableOpacity
              onPress={() => {
                setType('OUTGOING_CALL');
                processCall();
              }}
              style={{
                height: 50,
                backgroundColor: '#5568FE',
                justifyContent: 'center',
                alignItems: 'center',
                borderRadius: 12,
                marginTop: 16,
              }}>
              <Text style={{ fontSize: 16, color: '#FFFFFF' }}>Call Now</Text>
            </TouchableOpacity>
          </View>
        </>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
  const OutgoingCallScreen = () => (
    <View style={{
      flex: 1,
      justifyContent: 'space-around',
      backgroundColor: '#050A0E',
    }}>
      <View style={{
        padding: 35,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 14,
      }}>
        <Text style={{ fontSize: 16, color: '#D0D4DD' }}>Calling to...</Text>
        <Text style={{ fontSize: 36, marginTop: 12, color: '#ffff', letterSpacing: 6 }}>
          {otherUserId.current}
        </Text>
      </View>
      <View style={{ justifyContent: 'center', alignItems: 'center' }}>
        <TouchableOpacity
          onPress={() => {
            setType('JOIN');
            otherUserId.current = null;
          }}
          style={{
            backgroundColor: '#FF5D5D',
            borderRadius: 30,
            height: 60,
            aspectRatio: 1,
            justifyContent: 'center',
            alignItems: 'center',
          }}>
          <CallEnd width={50} height={12} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const IncomingCallScreen = () => (
    <View style={{
      flex: 1,
      justifyContent: 'space-around',
      backgroundColor: '#050A0E',
    }}>
      <View style={{
        padding: 35,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 14,
      }}>
        <Text style={{ fontSize: 36, marginTop: 12, color: '#ffff' }}>
          {otherUserId.current} is calling..
        </Text>
      </View>
      <View style={{ justifyContent: 'center', alignItems: 'center' }}>
        <TouchableOpacity
          onPress={() => {
            processAccept();
            setType('WEBRTC_ROOM');
          }}
          style={{
            backgroundColor: 'green',
            borderRadius: 30,
            height: 60,
            aspectRatio: 1,
            justifyContent: 'center',
            alignItems: 'center',
          }}>
          <CallAnswer height={28} fill={'#fff'} />
        </TouchableOpacity>
      </View>
    </View>
  );

  function switchCamera() {
    localStream?.getVideoTracks().forEach(track => {
      (track as any)._switchCamera();
    });
  }

  function toggleCamera() {
    setLocalWebcamOn(prev => !prev);
    localStream?.getVideoTracks().forEach(track => {
      track.enabled = !localWebcamOn;
    });
  }

  function toggleMic() {
    setLocalMicOn(prev => !prev);
    localStream?.getAudioTracks().forEach(track => {
      track.enabled = !localMicOn;
    });
  }

  function leave() {
    peerConnection.current.close();
    setLocalStream(null);
    setType('JOIN');
  }

  const WebrtcRoomScreen = () => (
    <View style={{
      flex: 1,
      backgroundColor: '#050A0E',
      paddingHorizontal: 12,
      paddingVertical: 12,
    }}>
      {localStream && (
        <RTCView
          objectFit={'cover'}
          style={{ flex: 1, backgroundColor: '#050A0E' }}
          streamURL={localStream.toURL()}
        />
      )}
      {remoteStream && (
        <RTCView
          objectFit={'cover'}
          style={{ flex: 1, backgroundColor: '#050A0E', marginTop: 8 }}
          streamURL={remoteStream.toURL()}
        />
      )}
      <View style={{
        marginVertical: 12,
        flexDirection: 'row',
        justifyContent: 'space-evenly',
      }}>
        <IconContainer
          backgroundColor={'red'}
          onPress={leave}
          Icon={() => <CallEnd height={26} width={26} fill="#FFF" />}
        />
        <IconContainer
          style={{ borderWidth: 1.5, borderColor: '#2B3034' }}
          backgroundColor={!localMicOn ? '#fff' : 'transparent'}
          onPress={toggleMic}
          Icon={() => localMicOn ? <MicOn height={24} width={24} fill="#FFF" /> : <MicOff height={28} width={28} fill="#1D2939" />}
        />
        <IconContainer
          style={{ borderWidth: 1.5, borderColor: '#2B3034' }}
          backgroundColor={!localWebcamOn ? '#fff' : 'transparent'}
          onPress={toggleCamera}
          Icon={() => localWebcamOn ? <VideoOn height={24} width={24} fill="#FFF" /> : <VideoOff height={36} width={36} fill="#1D2939" />}
        />
        <IconContainer
          style={{ borderWidth: 1.5, borderColor: '#2B3034' }}
          backgroundColor={'transparent'}
          onPress={switchCamera}
          Icon={() => <CameraSwitch height={24} width={24} fill="#FFF" />}
        />
      </View>
    </View>
  );

  switch (type) {
    case 'JOIN':
      return <JoinScreen />;
    case 'INCOMING_CALL':
      return <IncomingCallScreen />;
    case 'OUTGOING_CALL':
      return <OutgoingCallScreen />;
    case 'WEBRTC_ROOM':
      return <WebrtcRoomScreen />;
    default:
      return null;
  }
}
