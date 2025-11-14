# Complete Xbox Gameplay Relay Usage Guide

## Overview: How It All Works Together

```
Your Xbox Console
       ↓ (Xbox Remote Play Protocol)
XStreaming App on Your Phone
       ↓ (receives video/audio via WebRTC)
       ↓ (simultaneously forwards to relay)
Cloudflare Relay Server
       ↓ (distributes via Cloudflare's network)
Viewers Worldwide (Browser/Apps)
```

## Prerequisites

### What You Need

1. **Xbox Console** (Xbox Series X/S or Xbox One)
   - Connected to your home network
   - Remote Play enabled
   - Signed in to your Microsoft account

2. **Android/iOS Phone** with XStreaming app installed
   - On same network as Xbox (for initial setup)
   - Good WiFi/5G connection

3. **Cloudflare Account** (for relay)
   - Workers Paid plan ($5/month)
   - Relay Worker deployed

4. **Viewers** (optional - people watching your stream)
   - Any device with a web browser
   - Viewer app (if you build one)

## Part 1: Xbox Setup (One-Time)

### Enable Xbox Remote Play

1. **On your Xbox console**:
   - Press Xbox button → Profile & system → Settings
   - Go to **Devices & connections** → **Remote features**
   - Enable "**Remote features**"
   - Enable "**Xbox app remote connections**"
   - Keep your Xbox in **Instant On** mode (Settings → Power mode & startup)

2. **Sign in to Microsoft Account**:
   - Make sure you're signed in with the account you'll use on your phone

3. **Note your Xbox info**:
   - You'll need this account to connect from the phone

## Part 2: XStreaming App Setup

### Initial Installation

1. **Install XStreaming** on your Android/iOS device
   - From GitHub releases or F-Droid

2. **Sign in to Xbox account**:
   - Open XStreaming
   - Sign in with the same Microsoft account as your Xbox

3. **Connect to Xbox** (first time):
   - XStreaming will discover your Xbox on local network
   - Select your Xbox console
   - Start streaming

4. **Verify it works**:
   - You should see your Xbox dashboard on your phone
   - Try playing a game to confirm video/audio works
   - Test controller input works

### Configure Relay (After Basic Streaming Works)

Now that Xbox → Phone streaming works, add the relay:

1. **Open Settings in XStreaming**:
   - Tap menu → Settings

2. **Scroll to "📡 Relay Server Settings"**

3. **Configure**:
   - **Enable Relay Server**: Toggle ON ✅
   - **Cloudflare Worker URL**: `https://xbox-relay-server.your-subdomain.workers.dev`
   - **Custom STUN Servers**: (leave empty unless you have custom servers)

4. **Save settings**

## Part 3: Deploy Cloudflare Relay (One-Time)

### Quick Deploy

```bash
# Navigate to relay server folder
cd XStreaming/cloudflare-relay-server

# Install dependencies
npm install

# Login to Cloudflare
npx wrangler login
# (Browser opens - authenticate)

# Deploy to Cloudflare
npm run deploy

# Copy your Worker URL (shown after deploy)
# Example: https://xbox-relay-server.abc123.workers.dev
```

### Verify Deployment

```bash
# Test that it's live
curl https://xbox-relay-server.your-subdomain.workers.dev/health

# Should return: {"status":"healthy"}
```

## Part 4: Complete Usage Flow

### Starting a Stream (With Relay)

#### Step 1: Start XStreaming

1. **Open XStreaming app** on your phone
2. **Verify relay is enabled** in settings
3. **Return to main screen**

#### Step 2: Connect to Xbox

1. **Tap your Xbox console** from the list
2. **Or connect via xCloud** (cloud gaming)
3. **Wait for connection** (you'll see "Connecting..." then "Connected")

#### Step 3: Watch the Magic Happen

When Xbox stream connects, **automatically**:

1. **Xbox streams to your phone**:
   - You see Xbox dashboard/game on your phone screen
   - You can play normally with gamepad

2. **Phone forwards to relay** (happens in background):
   - XStreaming detects video/audio tracks from Xbox
   - Creates connection to Cloudflare relay
   - Forwards tracks to relay server
   - You'll see toast: "Relay: Connected to server"

3. **Check logs** for viewer URL:
   ```bash
   # On Android
   adb logcat | grep Relay

   # You'll see:
   [Relay] Registered as streamer: abc-123-def-456
   [Relay] Viewer URL: https://xbox-relay-server.your-subdomain.workers.dev/viewer/join?streamerId=abc-123-def-456
   ```

#### Step 4: Share with Viewers

1. **Copy the Viewer URL** from logs (or app UI if displayed)

2. **Share URL** with people who want to watch:
   - Via Discord, WhatsApp, Twitter, etc.
   - Example: `https://xbox-relay-server.your-subdomain.workers.dev/viewer/join?streamerId=abc-123-def-456`

3. **Viewers open URL**:
   - They need a viewer application (see Part 5)
   - Or you can build a custom web viewer

## Part 5: Viewer Experience

### Option A: Simple Web Viewer

Viewers can watch by opening the URL in a browser (if you create a viewer page).

**You need to create a viewer webpage** that:
1. Extracts `streamerId` from URL
2. Calls `/viewer/join` API
3. Creates WebRTC connection
4. Displays video

Example viewer implementation: see `cloudflare-relay-server/viewer-example.html`

### Option B: Custom Viewer App

Build a native app or web app that:
- Connects to your Worker
- Joins the SFU session
- Receives and plays the stream

## Example: Complete Real-World Scenario

### Scenario: You're playing Halo and want friends to watch

#### Your Setup (Streamer):
1. **Xbox is on**, Halo Infinite is running
2. **Phone has XStreaming** with relay configured
3. **Cloudflare Worker** is deployed

#### Steps:

1. **Open XStreaming** on phone
2. **Connect to Xbox** → Halo Infinite appears on phone
3. **Play normally** - you're using your phone as a display/controller
4. **Check logs** → Copy viewer URL
5. **Send URL to friends** via Discord:
   ```
   "Watch me play Halo! https://xbox-relay-server.mysite.workers.dev/viewer/join?streamerId=abc123"
   ```

#### Your Friends (Viewers):
1. **Click your link**
2. **Open in browser** or viewer app
3. **Watch you play in real-time** (<1 second delay)
4. **See your gameplay**, hear game audio

#### What You See:
- **On your phone**: Your Xbox gameplay (controller input works normally)
- **Your friends see**: Same gameplay streamed via Cloudflare

#### What's Happening Behind the Scenes:
```
Xbox (Halo)
    ↓ Remote Play Protocol
Your Phone (XStreaming)
    ├─ Local Display (you play)
    └─ Cloudflare Relay (friends watch)
         ↓
    Friend 1, Friend 2, Friend 3... (all watching)
```

## Data Flow Detail

### When You Start Playing:

1. **Xbox → Phone** (existing XStreaming functionality):
   - Xbox encodes gameplay to H.264/H.265 video
   - Xbox sends to phone via WebRTC
   - Phone decodes and displays
   - Phone sends controller inputs back to Xbox
   - **This is the normal XStreaming flow**

2. **Phone → Cloudflare** (relay addition):
   - XStreaming detects incoming video/audio tracks
   - Creates second WebRTC connection to Cloudflare
   - Adds same tracks to relay connection
   - Cloudflare SFU receives tracks
   - **Now Cloudflare has your gameplay stream**

3. **Cloudflare → Viewers**:
   - Viewers connect to Cloudflare SFU session
   - Cloudflare distributes tracks to all viewers
   - Each viewer gets their own WebRTC connection
   - **Everyone watches with minimal latency**

### Network Requirements

#### For You (Streamer):
- **Download**: 10-20 Mbps (from Xbox)
- **Upload**: 10-20 Mbps (to Cloudflare)
- **Total**: ~30-40 Mbps connection recommended

#### For Viewers:
- **Download**: 10-20 Mbps per viewer
- **Upload**: Minimal (just control messages)

## Settings Explained

### In XStreaming App:

| Setting | What It Does | Example Value |
|---------|--------------|---------------|
| **Enable Relay Server** | Turn relay on/off | ✅ Enable |
| **Cloudflare Worker URL** | Where to send stream | `https://xbox-relay-server.mysite.workers.dev` |
| **Custom STUN Servers** | Extra NAT traversal help | (usually leave empty) |

### Quality Settings:

The relay forwards whatever quality Xbox sends:
- **Resolution**: Up to 1080p (Xbox Remote Play limit)
- **Frame Rate**: Up to 60fps
- **Bitrate**: Controlled by XStreaming's Xbox connection settings

## Common Scenarios

### Scenario 1: Gaming Session with Friends

**Use Case**: Friends want to watch you play

**Setup**:
1. Enable relay before starting
2. Start Xbox streaming
3. Share viewer URL in Discord
4. Play as normal

**Result**: Friends watch in real-time, <1s latency

### Scenario 2: Recording Gameplay

**Use Case**: Record for later playback

**Setup**:
1. Deploy viewer that saves to R2/S3
2. Enable relay
3. Play your game
4. Recordings saved automatically

**Result**: Cloud recordings without capture card

### Scenario 3: Live Streaming to Multiple Platforms

**Use Case**: Stream to Twitch, YouTube, Discord simultaneously

**Setup**:
1. Build relay integration that forwards to each platform
2. Enable relay
3. One source → many destinations

**Result**: Multi-platform streaming from phone

## Troubleshooting

### "Relay not connecting"

**Check**:
1. ✅ Worker URL is correct in settings
2. ✅ Worker is deployed: `curl your-worker-url/health`
3. ✅ Relay is enabled in settings
4. ✅ Xbox stream is actually connected
5. ✅ Check logs: `adb logcat | grep Relay`

### "Viewers can't connect"

**Check**:
1. ✅ Viewer URL is correct
2. ✅ `streamerId` matches an active session
3. ✅ Check Worker logs: `npx wrangler tail`
4. ✅ Viewer has correct viewer app/page

### "High latency"

**Solutions**:
1. Move closer to WiFi router
2. Use 5GHz WiFi instead of 2.4GHz
3. Lower Xbox stream quality
4. Check upload speed: need 10-20 Mbps

### "Relay disconnects randomly"

**Check**:
1. Stable internet connection
2. Phone isn't battery-saving (kills network)
3. Worker isn't hitting limits
4. Check Cloudflare dashboard for errors

## Monitoring Your Stream

### Check Active Sessions

```bash
curl https://xbox-relay-server.your-subdomain.workers.dev/sessions
```

Returns:
```json
{
  "sessions": [
    {
      "streamerId": "abc-123",
      "sessionId": "session-xyz",
      "createdAt": 1234567890,
      "viewerCount": 5
    }
  ]
}
```

### View Worker Logs

```bash
cd cloudflare-relay-server
npm run tail
```

Shows real-time activity:
- Streamer connections
- Viewer joins
- Errors
- WebRTC negotiations

## Advanced: Building a Viewer

Want to create a viewer experience for your friends? Here's a simple example:

```html
<!-- viewer.html -->
<!DOCTYPE html>
<html>
<head><title>Watch Stream</title></head>
<body>
    <video id="stream" autoplay playsinline></video>
    <script>
        const urlParams = new URLSearchParams(window.location.search);
        const streamerId = urlParams.get('streamerId');
        const workerUrl = 'https://xbox-relay-server.mysite.workers.dev';

        async function watchStream() {
            // Join stream
            const res = await fetch(`${workerUrl}/viewer/join`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ streamerId })
            });
            const data = await res.json();

            // Create WebRTC connection
            const pc = new RTCPeerConnection();

            pc.ontrack = (event) => {
                document.getElementById('stream').srcObject = event.streams[0];
            };

            // Create offer and exchange with Worker
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            // Send offer to worker and get answer
            // (implementation depends on your Worker's viewer API)
        }

        watchStream();
    </script>
</body>
</html>
```

## Summary: Your Streaming Pipeline

1. **Xbox** generates gameplay video/audio
2. **XStreaming** receives it, lets you play
3. **Relay** forwards it to Cloudflare
4. **Cloudflare** distributes to viewers
5. **Viewers** watch in real-time

**You play on your phone, the world watches via Cloudflare!** 🎮📡🌍
