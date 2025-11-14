import {
  RTCPeerConnection,
  RTCSessionDescription,
  MediaStream,
  MediaStreamTrack,
} from 'react-native-webrtc';

export interface CloudflareRelayConfig {
  workerUrl: string; // Cloudflare Worker URL (e.g., https://xbox-relay.yourdomain.workers.dev)
  enabled: boolean;
  stunServers?: string[];
}

export interface RelayClientEvents {
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: string) => void;
  onStateChange?: (state: string) => void;
}

/**
 * RelayClient for Cloudflare Realtime SFU
 * Uses HTTP API instead of WebSocket for signaling
 */
class CloudflareRelayClient {
  private peerConnection: RTCPeerConnection | null = null;
  private config: CloudflareRelayConfig;
  private events: RelayClientEvents;
  private streamerId: string | null = null;
  private sessionId: string | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;

  constructor(config: CloudflareRelayConfig, events: RelayClientEvents = {}) {
    this.config = config;
    this.events = events;
    console.log('[CloudflareRelay] Initialized with config:', config);
  }

  /**
   * Initialize the relay client
   */
  async init(): Promise<void> {
    if (!this.config.enabled) {
      console.log('[CloudflareRelay] Relay is disabled');
      return;
    }

    try {
      // Register as a streamer
      await this.registerStreamer();

      // Create WebRTC peer connection
      await this.createPeerConnection();

      console.log('[CloudflareRelay] Initialization complete');
    } catch (error) {
      console.error('[CloudflareRelay] Initialization failed:', error);
      this.events.onError?.(
        `Failed to initialize relay: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Register as a streamer with the Cloudflare Worker
   */
  private async registerStreamer(): Promise<void> {
    const response = await fetch(`${this.config.workerUrl}/streamer/new`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to register streamer: ${response.statusText}`);
    }

    const data = await response.json();
    this.streamerId = data.streamerId;

    console.log('[CloudflareRelay] Registered as streamer:', this.streamerId);
  }

  /**
   * Create the RTCPeerConnection for the relay
   */
  private async createPeerConnection(): Promise<void> {
    const iceServers = [
      {urls: 'stun:stun.l.google.com:19302'},
      {urls: 'stun:stun1.l.google.com:19302'},
      ...(this.config.stunServers || []).map(url => ({urls: url})),
    ];

    this.peerConnection = new RTCPeerConnection({
      iceServers,
    });

    // Handle ICE candidates
    this.peerConnection.addEventListener('icecandidate', event => {
      if (event.candidate) {
        console.log('[CloudflareRelay] New ICE candidate:', event.candidate);
        // ICE candidates are typically handled by Cloudflare Calls automatically
        // after the initial offer/answer exchange
      }
    });

    // Handle connection state changes
    this.peerConnection.addEventListener('connectionstatechange', () => {
      const state = this.peerConnection?.connectionState;
      console.log('[CloudflareRelay] Connection state:', state);
      this.events.onStateChange?.(state || 'unknown');

      if (state === 'connected') {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.events.onConnected?.();
      } else if (state === 'disconnected' || state === 'failed') {
        this.isConnected = false;
        this.events.onDisconnected?.();
        this.handleReconnect();
      }
    });

    // Handle ICE connection state changes
    this.peerConnection.addEventListener('iceconnectionstatechange', () => {
      const iceState = this.peerConnection?.iceConnectionState;
      console.log('[CloudflareRelay] ICE connection state:', iceState);
    });

    console.log('[CloudflareRelay] Peer connection created');
  }

  /**
   * Add a media track to the relay peer connection
   * This is called when a track is received from the Xbox stream
   */
  async addTrack(track: MediaStreamTrack, stream: MediaStream): Promise<void> {
    if (!this.peerConnection) {
      console.error('[CloudflareRelay] Peer connection not initialized');
      return;
    }

    if (!this.config.enabled) {
      console.log('[CloudflareRelay] Relay is disabled, not adding track');
      return;
    }

    if (!this.streamerId) {
      console.error('[CloudflareRelay] Streamer not registered');
      return;
    }

    try {
      console.log(`[CloudflareRelay] Adding ${track.kind} track to relay connection`);
      this.peerConnection.addTrack(track, stream);

      // Create and send offer to Cloudflare Worker
      await this.createAndSendOffer();
    } catch (error) {
      console.error('[CloudflareRelay] Failed to add track:', error);
      this.events.onError?.(
        `Failed to add track: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Create SDP offer and send to Cloudflare Worker
   */
  private async createAndSendOffer(): Promise<void> {
    if (!this.peerConnection || !this.streamerId) {
      console.error('[CloudflareRelay] Cannot create offer - not initialized');
      return;
    }

    try {
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
      });

      await this.peerConnection.setLocalDescription(offer);

      console.log('[CloudflareRelay] SDP offer created, sending to Worker');

      // Send offer to Cloudflare Worker
      const response = await fetch(
        `${this.config.workerUrl}/streamer/${this.streamerId}/offer`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: offer.type,
            sdp: offer.sdp,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to send offer: ${response.statusText}`);
      }

      const data = await response.json();
      this.sessionId = data.sessionId;

      // Set the SFU's answer as remote description
      const answer = new RTCSessionDescription({
        type: 'answer',
        sdp: data.sdp,
      });

      await this.peerConnection.setRemoteDescription(answer);

      console.log('[CloudflareRelay] Remote SDP answer set, session:', this.sessionId);
    } catch (error) {
      console.error('[CloudflareRelay] Failed to create/send offer:', error);
      this.events.onError?.(
        `Failed to create offer: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Handle reconnection logic
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[CloudflareRelay] Max reconnection attempts reached');
      this.events.onError?.('Failed to reconnect to relay server');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(
      `[CloudflareRelay] Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`,
    );

    setTimeout(async () => {
      try {
        await this.close();
        await this.init();
      } catch (error) {
        console.error('[CloudflareRelay] Reconnection failed:', error);
      }
    }, delay);
  }

  /**
   * Get the current connection state
   */
  getConnectionState(): string {
    return this.peerConnection?.connectionState || 'disconnected';
  }

  /**
   * Check if relay is active and connected
   */
  isActive(): boolean {
    return this.isConnected && this.config.enabled;
  }

  /**
   * Get the streamer ID (shareable link for viewers)
   */
  getStreamerId(): string | null {
    return this.streamerId;
  }

  /**
   * Get the viewer URL
   */
  getViewerUrl(): string | null {
    if (!this.streamerId) return null;
    return `${this.config.workerUrl}/viewer/join?streamerId=${this.streamerId}`;
  }

  /**
   * Close the relay connection
   */
  async close(): Promise<void> {
    console.log('[CloudflareRelay] Closing connection');

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.isConnected = false;
    this.streamerId = null;
    this.sessionId = null;
    console.log('[CloudflareRelay] Connection closed');
  }

  /**
   * Update relay configuration
   */
  updateConfig(config: Partial<CloudflareRelayConfig>): void {
    this.config = {...this.config, ...config};
    console.log('[CloudflareRelay] Config updated:', this.config);
  }
}

export default CloudflareRelayClient;
