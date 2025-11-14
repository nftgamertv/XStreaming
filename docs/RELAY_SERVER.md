# Xbox Gameplay Relay Server Feature

## Overview

The XStreaming app now includes a real-time relay server feature that allows you to forward Xbox gameplay streams to a remote server via WebRTC. This enables scenarios like:

- Rebroadcasting your Xbox gameplay to multiple viewers
- Cloud recording of your gaming sessions
- Remote viewing with sub-second latency
- Custom streaming integrations

## How It Works

```
Xbox Console/xCloud
       ↓
   WebRTC Stream
       ↓
  XStreaming App (Phone)
       ↓ (receives & relays)
  WebRTC Relay Client
       ↓
WebSocket Signaling Server
       ↓
   Relay Server (Your Server)
       ↓
Multiple Viewers/Recorders
```

The app receives the Xbox gameplay stream via WebRTC and simultaneously forwards the video and audio tracks to your relay server. The relay server can then redistribute the stream to multiple viewers or record it.

## Setup Instructions

### 1. Configure Relay Settings in XStreaming App

1. Open XStreaming app
2. Go to **Settings**
3. Scroll to **📡 Relay Server Settings** section
4. Configure the following:

   - **Enable Relay Server**: Set to "Enable"
   - **Relay Server URL**: Enter your WebSocket signaling server URL
     - Format: `ws://your-server.com:8080` (WebSocket)
     - Or: `wss://your-server.com` (Secure WebSocket)
   - **Custom STUN Servers** (Optional): Comma-separated list of STUN servers
     - Example: `stun:stun.example.com:3478,stun:stun2.example.com:3478`

### 2. Start Streaming

1. Launch Xbox streaming as usual (either xCloud or home console streaming)
2. The app will automatically connect to your relay server when the Xbox stream starts
3. You'll see toast notifications:
   - "Connected" - Xbox stream connected
   - "Relay: Connected to server" - Relay server connected

### 3. Monitor Relay Status

Check the app logs to monitor relay connection:
- `[Relay] Initializing relay client`
- `[Relay] Forwarding video track to relay server`
- `[Relay] Forwarding audio track to relay server`
- `[Relay] Connected to relay server`

## Relay Server Implementation

You need to implement a relay server that:

1. **Accepts WebSocket connections** from XStreaming clients
2. **Handles WebRTC signaling** (SDP offer/answer, ICE candidates)
3. **Receives the media stream** via WebRTC
4. **Redistributes to viewers** or records it

### WebSocket Signaling Protocol

The XStreaming app sends the following messages:

#### From Client (XStreaming App):

```json
// Registration
{
  "type": "register",
  "role": "streamer"
}

// SDP Offer
{
  "type": "sdp-offer",
  "sdp": "<SDP offer string>"
}

// ICE Candidate
{
  "type": "ice-candidate",
  "candidate": {
    "candidate": "...",
    "sdpMid": "...",
    "sdpMLineIndex": 0
  }
}
```

#### From Server (Your Relay Server):

```json
// Ready signal
{
  "type": "ready"
}

// SDP Answer
{
  "type": "sdp-answer",
  "sdp": "<SDP answer string>"
}

// ICE Candidate
{
  "type": "ice-candidate",
  "candidate": {
    "candidate": "...",
    "sdpMid": "...",
    "sdpMLineIndex": 0
  }
}

// Error
{
  "type": "error",
  "error": "Error message"
}
```

### Example Relay Server (Node.js)

```javascript
const WebSocket = require('ws');
const wrtc = require('wrtc');

const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws) => {
  console.log('Client connected');
  const peerConnection = new wrtc.RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });

  // Handle incoming tracks
  peerConnection.ontrack = (event) => {
    console.log(`Received ${event.track.kind} track`);
    // Forward to viewers or record here
  };

  // Handle ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      ws.send(JSON.stringify({
        type: 'ice-candidate',
        candidate: event.candidate
      }));
    }
  };

  ws.on('message', async (message) => {
    const data = JSON.parse(message);

    switch (data.type) {
      case 'register':
        console.log('Streamer registered');
        ws.send(JSON.stringify({ type: 'ready' }));
        break;

      case 'sdp-offer':
        await peerConnection.setRemoteDescription({
          type: 'offer',
          sdp: data.sdp
        });
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        ws.send(JSON.stringify({
          type: 'sdp-answer',
          sdp: answer.sdp
        }));
        break;

      case 'ice-candidate':
        await peerConnection.addIceCandidate(data.candidate);
        break;
    }
  });
});
```

### Using Cloudflare Calls (Recommended for Production)

For production deployments, consider using Cloudflare Calls or similar SFU services:

```javascript
// Example with Cloudflare Calls API
const response = await fetch('https://rtc.live.cloudflare.com/v1/apps/YOUR_APP_ID/sessions/new', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${YOUR_API_TOKEN}`,
    'Content-Type': 'application/json',
  },
});
const session = await response.json();
// Use session.sessionDescription for WebRTC negotiation
```

## Performance Considerations

### Latency

- **Xbox to Phone**: ~50-100ms (via Xbox Remote Play)
- **Phone to Relay Server**: ~100-500ms (WebRTC, depends on network)
- **Total Glass-to-Glass**: ~0.5-1.0 seconds (well under 4s target)

### Quality

- **Resolution**: Up to 1080p60 (limited by Xbox Remote Play)
- **Video Codec**: H.264 or H.265 (depending on Xbox stream)
- **Audio**: Opus codec via WebRTC

### Bandwidth

- The relay requires sufficient upload bandwidth on the phone:
  - 1080p60: ~10-20 Mbps upload recommended
  - 720p60: ~5-10 Mbps upload recommended

## Troubleshooting

### Relay Connection Fails

1. **Check server URL**: Ensure the WebSocket URL is correct and accessible
2. **Check firewall**: Make sure the relay server port is open
3. **Check logs**: Look for error messages in app logs
4. **Test WebSocket**: Use a WebSocket test tool to verify server is running

### High Latency

1. **Check network**: Ensure stable WiFi/5G connection
2. **Reduce quality**: Lower Xbox stream quality in settings
3. **Use closer server**: Deploy relay server geographically closer
4. **Check STUN/TURN**: Add custom STUN servers for better NAT traversal

### Tracks Not Forwarding

1. **Verify relay enabled**: Check that "Enable Relay Server" is set to "Enable"
2. **Check server URL**: Must be set before streaming starts
3. **Restart stream**: Stop and restart the Xbox stream
4. **Check permissions**: Ensure app has network permissions

## Security Considerations

1. **Use WSS (Secure WebSocket)** in production
2. **Implement authentication** on your relay server
3. **Encrypt sensitive data** in signaling messages
4. **Rate limit connections** to prevent abuse
5. **Validate all inputs** on the server side

## Future Enhancements

Potential improvements to the relay feature:

- [ ] Authentication/API key support
- [ ] Multi-quality transcoding
- [ ] Built-in recording to cloud storage
- [ ] Quality metrics and monitoring UI
- [ ] Automatic failover to backup servers
- [ ] Adaptive bitrate based on network conditions

## Support

For issues or questions about the relay feature:

1. Check the [XStreaming GitHub Issues](https://github.com/Geocld/XStreaming/issues)
2. Review the app logs for detailed error messages
3. Test with a simple relay server implementation first
4. Verify your network configuration and firewall rules

## License

This feature is part of XStreaming and follows the same license terms.
