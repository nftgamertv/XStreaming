# Cloudflare Realtime SFU Relay Server Setup

This guide explains how to set up and deploy the Cloudflare Workers-based relay server for XStreaming, which uses Cloudflare's Realtime SFU (Selective Forwarding Unit) to relay Xbox gameplay streams to multiple viewers with sub-second latency.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Deployment](#deployment)
- [Configuration](#configuration)
- [Usage](#usage)
- [Architecture](#architecture)
- [Troubleshooting](#troubleshooting)

## Overview

The Cloudflare relay server enables you to:
- Stream Xbox gameplay to multiple viewers simultaneously
- Achieve sub-second latency using Cloudflare's global network
- Scale automatically without managing infrastructure
- Avoid egress fees and bandwidth costs

### How It Works

```
Xbox Console → XStreaming App → Cloudflare Worker (Realtime SFU) → Viewers
```

1. **XStreaming App** connects to Xbox and receives the gameplay stream
2. **Cloudflare Worker** creates an SFU session and handles WebRTC signaling
3. **Viewers** connect to the same SFU session to watch the stream
4. **Cloudflare's Network** distributes the stream globally with minimal latency

## Prerequisites

### 1. Cloudflare Account

You need a Cloudflare account with:
- **Workers Paid Plan** ($5/month) - Required for Realtime SFU
- **Calls add-on enabled** - Realtime SFU requires the Calls binding

Sign up at: https://dash.cloudflare.com/sign-up

### 2. Enable Cloudflare Calls

1. Go to your Cloudflare dashboard
2. Navigate to **Workers & Pages** → **Plans**
3. Subscribe to the **Workers Paid** plan if not already subscribed
4. The Calls binding will be automatically available

### 3. Install Wrangler CLI

```bash
npm install -g wrangler
```

Verify installation:
```bash
wrangler --version
```

### 4. Authenticate Wrangler

```bash
wrangler login
```

This will open a browser window to authenticate with your Cloudflare account.

## Deployment

### Step 1: Navigate to the Server Directory

```bash
cd XStreaming/cloudflare-relay-server
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Deploy to Cloudflare

```bash
npm run deploy
```

Or using Wrangler directly:
```bash
wrangler deploy
```

### Step 4: Note Your Worker URL

After deployment, Wrangler will output your Worker URL:
```
Published xbox-relay-server (X.XX sec)
  https://xbox-relay-server.<your-subdomain>.workers.dev
```

**Save this URL** - you'll need it to configure the XStreaming app.

## Configuration

### Custom Domain (Optional but Recommended)

Instead of using `*.workers.dev`, you can use your own domain:

1. **Add your domain to Cloudflare**
   - Go to Cloudflare Dashboard → **Websites** → **Add a site**
   - Follow the instructions to point your domain's nameservers to Cloudflare

2. **Update `wrangler.toml`**
   ```toml
   routes = [
     { pattern = "relay.yourdomain.com", custom_domain = true }
   ]
   ```

3. **Redeploy**
   ```bash
   npm run deploy
   ```

### Environment Variables

You can add environment variables in `wrangler.toml`:

```toml
[vars]
MAX_VIEWERS_PER_STREAM = "100"
SESSION_TIMEOUT_MS = "3600000"  # 1 hour
```

## Usage

### Configure XStreaming App

1. Open XStreaming app on your phone
2. Go to **Settings** → **📡 Relay Server Settings**
3. Configure:
   - **Enable Relay Server**: ✅ Enable
   - **Relay Server URL**: `https://xbox-relay-server.<your-subdomain>.workers.dev`
   - **Custom STUN Servers**: (Leave empty or add custom STUN servers)

4. Save settings

### Start Streaming

1. Start Xbox streaming as usual in XStreaming
2. When connected, the app will automatically:
   - Register with the relay server
   - Create an SFU session
   - Start forwarding video/audio tracks

3. Check the app logs for the **Viewer URL**:
   ```
   [Relay] Viewer URL: https://xbox-relay-server.yourdomain.workers.dev/viewer/join?streamerId=abc-123-def
   ```

### Share Stream with Viewers

Share the Viewer URL with anyone who wants to watch your stream. They can:
- Open the URL in a web browser
- Use a custom viewer app that connects to the SFU session
- Build their own WebRTC client

## Architecture

### API Endpoints

The Cloudflare Worker exposes the following HTTP endpoints:

#### `POST /streamer/new`
Register as a new streamer.

**Response:**
```json
{
  "streamerId": "abc-123-def",
  "message": "Streamer registered..."
}
```

#### `POST /streamer/{streamerId}/offer`
Send WebRTC offer from streamer.

**Request:**
```json
{
  "type": "offer",
  "sdp": "<SDP offer string>"
}
```

**Response:**
```json
{
  "type": "answer",
  "sdp": "<SDP answer string>",
  "sessionId": "session-xyz"
}
```

#### `POST /viewer/join`
Request to join a stream as a viewer.

**Request:**
```json
{
  "streamerId": "abc-123-def"
}
```

**Response:**
```json
{
  "viewerId": "viewer-456",
  "sessionId": "session-xyz",
  "message": "Send your SDP offer..."
}
```

#### `GET /sessions`
List all active streaming sessions.

**Response:**
```json
{
  "sessions": [
    {
      "streamerId": "abc-123-def",
      "sessionId": "session-xyz",
      "createdAt": 1234567890,
      "viewerCount": 5
    }
  ]
}
```

#### `GET /health`
Health check endpoint.

**Response:**
```json
{
  "status": "healthy"
}
```

### Data Flow

```
1. XStreaming App                  Cloudflare Worker
   ├─ POST /streamer/new      →    Create streamer ID
   ├─ POST /streamer/{id}/offer →  Create SFU session
   │                                 ├─ Call CALLS.newSession()
   │                                 └─ Return SDP answer
   └─ Send tracks via WebRTC   →    SFU receives media

2. Viewer
   ├─ POST /viewer/join       →    Get session info
   └─ WebRTC connection       →    Receive media from SFU
```

## Advanced Usage

### Building a Custom Viewer

To build a custom viewer web app:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Xbox Stream Viewer</title>
</head>
<body>
    <video id="stream" autoplay playsinline></video>
    <script>
        const streamerId = new URLSearchParams(window.location.search).get('streamerId');
        const workerUrl = 'https://xbox-relay-server.yourdomain.workers.dev';

        async function joinStream() {
            // Step 1: Join the stream
            const response = await fetch(`${workerUrl}/viewer/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ streamerId })
            });

            const { viewerId, sessionId } = await response.json();

            // Step 2: Create WebRTC connection
            // (Implementation depends on your specific needs)
            // You'll need to create a peer connection and handle SDP exchange
        }

        joinStream();
    </script>
</body>
</html>
```

### Scaling Considerations

Cloudflare Calls (Realtime SFU) automatically scales, but be aware of:

1. **Pricing**: Based on usage
   - See: https://developers.cloudflare.com/calls/pricing/

2. **Limits**:
   - Maximum tracks per session
   - Maximum viewers per session
   - See: https://developers.cloudflare.com/calls/limits/

3. **Optimizations**:
   - Use simulcast for adaptive bitrate
   - Implement viewer limits per stream
   - Add authentication for production use

## Troubleshooting

### Worker Deployment Fails

**Error**: `"CALLS" binding not found`

**Solution**: Ensure you're on the Workers Paid plan and the Calls binding is available.

```bash
# Check your plan
wrangler whoami
```

### Connection Issues

**Problem**: Relay client can't connect to Worker

**Checklist**:
1. ✅ Worker is deployed and accessible
2. ✅ URL in XStreaming settings is correct
3. ✅ No typos in the URL
4. ✅ Worker URL is using HTTPS
5. ✅ Check Worker logs: `wrangler tail`

### High Latency

**Problem**: Stream has high latency

**Solutions**:
1. Check your upload bandwidth (need ~10-20 Mbps for 1080p60)
2. Move closer to WiFi router
3. Disable other bandwidth-intensive apps
4. Lower Xbox stream quality in XStreaming settings

### Viewer Can't Connect

**Problem**: Viewer URL doesn't work

**Debug Steps**:
1. Check Worker logs:
   ```bash
   wrangler tail
   ```

2. Verify streamer is active:
   ```bash
   curl https://xbox-relay-server.yourdomain.workers.dev/sessions
   ```

3. Check if `streamerId` in URL matches an active session

## Monitoring

### View Real-time Logs

```bash
wrangler tail
```

This shows all Worker invocations and console.log output.

### Check Worker Analytics

1. Go to Cloudflare Dashboard
2. Navigate to **Workers & Pages** → **xbox-relay-server**
3. Click **Metrics** tab

You'll see:
- Request rate
- Error rate
- CPU time
- Success rate

### Custom Metrics

Add custom logging in `src/index.ts`:

```typescript
console.log('[Metrics]', {
  event: 'streamer_connected',
  streamerId,
  timestamp: Date.now()
});
```

## Cost Estimation

### Workers Paid Plan
- **$5/month** base subscription

### Cloudflare Calls Usage
Pricing based on:
- **Participant minutes** (viewers + streamers)
- See latest pricing: https://developers.cloudflare.com/calls/pricing/

### Example Cost
For a stream with:
- 1 streamer
- 10 concurrent viewers
- Streaming 4 hours/day for 30 days

Total participant minutes: `(1 + 10) × 4 × 60 × 30 = 79,200 minutes`

Check current Calls pricing for exact costs.

## Security Best Practices

### 1. Add Authentication

Implement token-based authentication:

```typescript
// In Worker
const authToken = request.headers.get('Authorization');
if (authToken !== env.EXPECTED_TOKEN) {
  return new Response('Unauthorized', { status: 401 });
}
```

### 2. Rate Limiting

Prevent abuse by limiting requests:

```typescript
// Track requests per IP
const rateLimitKey = request.headers.get('CF-Connecting-IP');
// Implement rate limiting logic
```

### 3. Viewer Limits

Limit concurrent viewers per stream:

```typescript
const MAX_VIEWERS = 50;
const currentViewers = viewerSessions.filter(v => v.streamerId === streamerId).length;

if (currentViewers >= MAX_VIEWERS) {
  return new Response('Stream is full', { status: 429 });
}
```

## Next Steps

1. **Deploy the Worker** following this guide
2. **Configure XStreaming app** with your Worker URL
3. **Test the stream** locally first
4. **Share with viewers** once everything works
5. **Monitor usage** and optimize as needed

## Support

For issues or questions:
- Check Worker logs: `wrangler tail`
- Review Cloudflare Calls docs: https://developers.cloudflare.com/calls/
- Review XStreaming docs: `/docs/RELAY_SERVER.md`
- Check GitHub issues

## License

This Worker is part of the XStreaming project and follows the same license.
