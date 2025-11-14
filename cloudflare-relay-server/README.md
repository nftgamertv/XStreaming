# Xbox Gameplay Relay Server (Cloudflare Worker)

A Cloudflare Worker that uses Realtime SFU (formerly Cloudflare Calls) to relay Xbox gameplay streams from the XStreaming mobile app to multiple viewers with sub-second latency.

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Authenticate with Cloudflare

```bash
npx wrangler login
```

### 3. Deploy

```bash
npm run deploy
```

### 4. Note Your Worker URL

After deployment, you'll see:
```
Published xbox-relay-server (X.XX sec)
  https://xbox-relay-server.<your-subdomain>.workers.dev
```

## Configuration

### Requirements

- Cloudflare account with **Workers Paid Plan** ($5/month)
- Calls binding (automatically available on paid plans)

### Custom Domain (Optional)

Edit `wrangler.toml`:

```toml
routes = [
  { pattern = "relay.yourdomain.com", custom_domain = true }
]
```

Then redeploy:
```bash
npm run deploy
```

## Development

### Local Development

```bash
npm run dev
```

This starts a local server at `http://localhost:8787`

### View Logs

```bash
npm run tail
```

Or:
```bash
npx wrangler tail
```

## Usage with XStreaming App

1. Deploy this Worker
2. Copy your Worker URL
3. In XStreaming app:
   - Go to **Settings** → **📡 Relay Server Settings**
   - Enable relay server
   - Paste Worker URL
4. Start streaming!

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/streamer/new` | POST | Register new streamer |
| `/streamer/{id}/offer` | POST | Send WebRTC offer |
| `/viewer/join` | POST | Join a stream |
| `/sessions` | GET | List active sessions |

## Documentation

For detailed setup instructions, architecture, and troubleshooting:

📖 See [/docs/CLOUDFLARE_RELAY_SETUP.md](../docs/CLOUDFLARE_RELAY_SETUP.md)

## Features

✅ Sub-second latency using Cloudflare's global network
✅ Automatic scaling with Cloudflare Workers
✅ Multiple viewers per stream
✅ WebRTC-based streaming
✅ No infrastructure management
✅ Built-in CORS support

## Cost

- **Workers Paid Plan**: $5/month
- **Cloudflare Calls**: Based on participant minutes
  - See pricing: https://developers.cloudflare.com/calls/pricing/

## Support

For issues or questions:
- Check [Cloudflare Calls docs](https://developers.cloudflare.com/calls/)
- Review [main relay documentation](../docs/RELAY_SERVER.md)
- Check Worker logs: `npm run tail`

## License

Part of the XStreaming project.
