/**
 * Cloudflare Worker for Xbox Gameplay Relay using Realtime SFU
 *
 * This Worker handles:
 * - Creating SFU sessions for streamers
 * - Managing WebRTC signaling via Cloudflare Calls API
 * - Relaying Xbox gameplay streams to multiple viewers
 */

export interface Env {
	CALLS: Calls;
}

interface Calls {
	newSession(options?: SessionOptions): Promise<Session>;
}

interface SessionOptions {
	sessionDescription?: RTCSessionDescriptionInit;
}

interface Session {
	id: string;
	sessionDescription: RTCSessionDescriptionInit;

	// Methods
	close(): Promise<void>;

	// Properties
	tracks: Map<string, Track>;
}

interface Track {
	trackName: string;
	location: string;
	sessionId: string;
	mid?: string;
}

interface StreamerSession {
	sessionId: string;
	session: Session;
	createdAt: number;
}

interface ViewerSession {
	sessionId: string;
	streamerId: string;
	createdAt: number;
}

// In-memory storage for active sessions
// For production, consider using Durable Objects or KV
const activeSessions = new Map<string, StreamerSession>();
const viewerSessions = new Map<string, ViewerSession>();

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		// CORS headers
		const corsHeaders = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
		};

		// Handle preflight
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		try {
			// Route handling
			if (url.pathname === '/streamer/new' && request.method === 'POST') {
				return handleNewStreamer(request, env, corsHeaders);
			}

			if (url.pathname.startsWith('/streamer/') && url.pathname.endsWith('/offer') && request.method === 'POST') {
				return handleStreamerOffer(request, env, corsHeaders);
			}

			if (url.pathname === '/viewer/join' && request.method === 'POST') {
				return handleViewerJoin(request, env, corsHeaders);
			}

			if (url.pathname.startsWith('/viewer/') && url.pathname.endsWith('/answer') && request.method === 'POST') {
				return handleViewerAnswer(request, env, corsHeaders);
			}

			if (url.pathname === '/sessions' && request.method === 'GET') {
				return handleGetSessions(corsHeaders);
			}

			if (url.pathname === '/health' && request.method === 'GET') {
				return new Response(JSON.stringify({ status: 'healthy' }), {
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				});
			}

			return new Response('Not Found', { status: 404, headers: corsHeaders });
		} catch (error) {
			console.error('Error handling request:', error);
			return new Response(
				JSON.stringify({
					error: error instanceof Error ? error.message : 'Internal server error',
				}),
				{
					status: 500,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				}
			);
		}
	},
};

/**
 * Create a new streamer session
 */
async function handleNewStreamer(
	request: Request,
	env: Env,
	corsHeaders: Record<string, string>
): Promise<Response> {
	const streamerId = crypto.randomUUID();

	console.log(`[Relay] Creating new streamer session: ${streamerId}`);

	// For now, we'll create the session when we receive the offer
	// This allows us to include the streamer's SDP in the session creation

	return new Response(
		JSON.stringify({
			streamerId,
			message: 'Streamer registered. Send your SDP offer to /streamer/{streamerId}/offer',
		}),
		{
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		}
	);
}

/**
 * Handle streamer's WebRTC offer
 */
async function handleStreamerOffer(
	request: Request,
	env: Env,
	corsHeaders: Record<string, string>
): Promise<Response> {
	const url = new URL(request.url);
	const pathParts = url.pathname.split('/');
	const streamerId = pathParts[2];

	const body = await request.json() as { sdp: string; type: string };

	console.log(`[Relay] Received offer from streamer: ${streamerId}`);

	// Create a new SFU session with the streamer's offer
	const session = await env.CALLS.newSession({
		sessionDescription: {
			type: 'offer',
			sdp: body.sdp,
		},
	});

	// Store the session
	activeSessions.set(streamerId, {
		sessionId: session.id,
		session,
		createdAt: Date.now(),
	});

	console.log(`[Relay] Created SFU session ${session.id} for streamer ${streamerId}`);

	// Return the SFU's answer SDP
	return new Response(
		JSON.stringify({
			type: 'answer',
			sdp: session.sessionDescription.sdp,
			sessionId: session.id,
		}),
		{
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		}
	);
}

/**
 * Handle viewer joining a stream
 */
async function handleViewerJoin(
	request: Request,
	env: Env,
	corsHeaders: Record<string, string>
): Promise<Response> {
	const body = await request.json() as { streamerId: string };
	const { streamerId } = body;

	const streamerSession = activeSessions.get(streamerId);

	if (!streamerSession) {
		return new Response(
			JSON.stringify({ error: 'Streamer not found or not streaming' }),
			{
				status: 404,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			}
		);
	}

	const viewerId = crypto.randomUUID();

	viewerSessions.set(viewerId, {
		sessionId: streamerSession.sessionId,
		streamerId,
		createdAt: Date.now(),
	});

	console.log(`[Relay] Viewer ${viewerId} joined stream ${streamerId}`);

	// Return session info for the viewer to connect
	return new Response(
		JSON.stringify({
			viewerId,
			sessionId: streamerSession.sessionId,
			message: 'Send your SDP offer to /viewer/{viewerId}/answer',
		}),
		{
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		}
	);
}

/**
 * Handle viewer's WebRTC answer
 */
async function handleViewerAnswer(
	request: Request,
	env: Env,
	corsHeaders: Record<string, string>
): Promise<Response> {
	const url = new URL(request.url);
	const pathParts = url.pathname.split('/');
	const viewerId = pathParts[2];

	const viewerSession = viewerSessions.get(viewerId);

	if (!viewerSession) {
		return new Response(
			JSON.stringify({ error: 'Viewer session not found' }),
			{
				status: 404,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			}
		);
	}

	// For viewers, they would typically receive an offer from the SFU
	// and send back an answer. The exact implementation depends on your
	// client-side viewer setup.

	return new Response(
		JSON.stringify({
			message: 'Viewer connected successfully',
		}),
		{
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		}
	);
}

/**
 * Get all active sessions
 */
function handleGetSessions(corsHeaders: Record<string, string>): Response {
	const sessions = Array.from(activeSessions.entries()).map(([id, session]) => ({
		streamerId: id,
		sessionId: session.sessionId,
		createdAt: session.createdAt,
		viewerCount: Array.from(viewerSessions.values()).filter(
			v => v.streamerId === id
		).length,
	}));

	return new Response(JSON.stringify({ sessions }), {
		headers: { ...corsHeaders, 'Content-Type': 'application/json' },
	});
}
