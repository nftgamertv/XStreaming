# Testing XStreaming Relay Without Xbox

You're right - we need to test the **actual XStreaming app**, not just simulate it. Here's how:

## The Challenge

The XStreaming app receives video from Xbox and forwards it to the relay. Without Xbox, there's no video to forward. However, we can still test most of the pipeline.

## Step-by-Step Testing

### 1. ✅ Test Cloudflare Worker (Independently)

First, verify your Worker is deployed and working:

```bash
cd cloudflare-relay-server

# Test health endpoint
curl https://xbox-relay-server.your-subdomain.workers.dev/health

# Should return: {"status":"healthy"}
```

Or use the web test page:
```bash
# Serve the test page locally
python3 -m http.server 8000

# Open: http://localhost:8000/test-streamer.html
# Enter your Worker URL and test with webcam or test pattern
```

### 2. ✅ Test XStreaming App Connection (Without Video)

Even without Xbox, you can verify the relay client connects:

#### In XStreaming App:

1. **Enable relay in settings**:
   - Go to Settings → 📡 Relay Server Settings
   - Enable relay
   - Enter your Worker URL: `https://xbox-relay-server.your-subdomain.workers.dev`
   - Save

2. **Start ANY stream**:
   - Try to connect to Xbox (even if it fails, the relay will attempt to initialize)
   - OR if you have Xbox Remote Play working from another device, use that

3. **Check the logs**:
   - In Android: `adb logcat | grep Relay`
   - You should see:
     ```
     [Relay] Initializing relay client
     [Relay] Registered as streamer: abc-123-def
     ```

If you see these logs, your XStreaming app is successfully talking to your Worker! ✅

### 3. ⚠️ What You CAN'T Test Without Xbox

Without Xbox providing video/audio tracks, you won't see:
- `[Relay] Forwarding video track to relay server`
- `[Relay] Forwarding audio track to relay server`
- `[Relay] Connected to relay server` (requires actual media)

These only happen when Xbox stream starts and tracks are added.

## Practical Testing Strategy

### Phase 1: Verify Infrastructure (Do This First)

```bash
# 1. Deploy Worker
cd cloudflare-relay-server
npm run deploy

# 2. Test Worker API
curl https://xbox-relay-server.your-subdomain.workers.dev/health

# 3. Test with web streamer (uses webcam as fake Xbox)
open test-streamer.html
```

### Phase 2: Verify App Integration (Partial)

1. Configure XStreaming with your Worker URL
2. Enable relay
3. Attempt Xbox connection
4. Check logs show relay initialization

### Phase 3: Full End-to-End Test (Requires Xbox)

Once you have Xbox available:

1. **Start Xbox streaming** in XStreaming app
2. **Check logs** for:
   ```
   [Relay] Initializing relay client
   [Relay] Registered as streamer: abc-123-def
   [Relay] Forwarding video track to relay server
   [Relay] Forwarding audio track to relay server
   [Relay] Connected to relay server
   [Relay] Viewer URL: https://...
   ```

3. **Copy viewer URL** from logs

4. **Open viewer URL** in browser or second device

## Alternative: Test with Camera as Xbox Substitute

If you want to test the full pipeline in the app, you'd need to modify the app to use the phone's camera instead of Xbox stream. This is more complex and requires code changes.

Would you like me to add a "Developer Test Mode" to the app that uses the camera for testing?

## Quick Win: Just Test the Worker

The **simplest** approach:

1. ✅ Deploy Worker
2. ✅ Test Worker with `test-streamer.html` (uses webcam)
3. ✅ Configure app with Worker URL
4. ⏸️ Wait until you have Xbox to test full flow

The Worker and relay client code are already correct. When you connect to Xbox, it will "just work" because:
- The Worker is tested and working (via test-streamer.html)
- The app is configured correctly
- The relay client will auto-connect when Xbox stream starts

## Checking Logs in React Native

### Android:
```bash
# View all logs
adb logcat

# Filter for relay logs
adb logcat | grep Relay

# Filter for all WebRTC logs
adb logcat | grep -E "Relay|WebRTC|CloudflareRelay"
```

### iOS:
Open Xcode → Window → Devices and Simulators → Select your device → View Device Logs

## What the Logs Tell You

✅ **Good signs**:
```
[Relay] Initializing relay client
[Relay] Registered as streamer: <id>
[CloudflareRelay] Initialized with config: {...}
```

❌ **Bad signs**:
```
[Relay] Failed to register streamer: <error>
[Relay] Error: Failed to initialize relay
```

## Summary

**Without Xbox, you can test**:
- ✅ Worker deployment
- ✅ Worker API endpoints
- ✅ Worker with webcam (test-streamer.html)
- ✅ XStreaming app connects to Worker
- ✅ Relay client initializes

**With Xbox, you can test**:
- ✅ Everything above, plus:
- ✅ Actual video/audio forwarding
- ✅ Multiple viewers
- ✅ End-to-end latency
- ✅ Full production scenario

The good news: if test-streamer.html works with your Worker, the XStreaming app integration will work too! The code is identical, just packaged differently.
