import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  MediaStream,
  MediaStreamTrack,
} from 'react-native-webrtc';

export interface RelayServerConfig {
  url: string; // WebSocket signaling server URL
  enabled: boolean;
  stunServers?: string[];
}

export interface RelayClientEvents {
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: string) => void;
  onStateChange?: (state: string) => void;
}

class RelayClient {
  private peerConnection: RTCPeerConnection | null = null;
  private webSocket: WebSocket | null = null;
  private config: RelayServerConfig;
  private events: RelayClientEvents;
  private iceCandidateQueue: RTCIceCandidate[] = [];
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;

  constructor(config: RelayServerConfig, events: RelayClientEvents = {}) {
    this.config = config;
    this.events = events;
    console.log('[RelayClient] Initialized with config:', config);
  }

  /**
   * Initialize the relay client and connect to the signaling server
   */
  async init(): Promise<void> {
    if (!this.config.enabled) {
      console.log('[RelayClient] Relay is disabled');
      return;
    }

    try {
      // Create WebRTC peer connection
      await this.createPeerConnection();

      // Connect to signaling server
      await this.connectSignalingServer();

      console.log('[RelayClient] Initialization complete');
    } catch (error) {
      console.error('[RelayClient] Initialization failed:', error);
      this.events.onError?.(
        `Failed to initialize relay: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Create the RTCPeerConnection for the relay server
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
        console.log('[RelayClient] New ICE candidate:', event.candidate);
        this.sendToSignalingServer({
          type: 'ice-candidate',
          candidate: event.candidate,
        });
      }
    });

    // Handle connection state changes
    this.peerConnection.addEventListener('connectionstatechange', () => {
      const state = this.peerConnection?.connectionState;
      console.log('[RelayClient] Connection state:', state);
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
      console.log('[RelayClient] ICE connection state:', iceState);
    });

    console.log('[RelayClient] Peer connection created');
  }

  /**
   * Connect to the WebSocket signaling server
   */
  private async connectSignalingServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log('[RelayClient] Connecting to signaling server:', this.config.url);

        this.webSocket = new WebSocket(this.config.url);

        this.webSocket.onopen = () => {
          console.log('[RelayClient] WebSocket connected');
          // Send initial registration
          this.sendToSignalingServer({
            type: 'register',
            role: 'streamer',
          });
          resolve();
        };

        this.webSocket.onmessage = async event => {
          try {
            const message = JSON.parse(event.data);
            await this.handleSignalingMessage(message);
          } catch (error) {
            console.error('[RelayClient] Failed to parse signaling message:', error);
          }
        };

        this.webSocket.onerror = error => {
          console.error('[RelayClient] WebSocket error:', error);
          this.events.onError?.('WebSocket connection error');
          reject(error);
        };

        this.webSocket.onclose = () => {
          console.log('[RelayClient] WebSocket closed');
          if (this.isConnected) {
            this.handleReconnect();
          }
        };
      } catch (error) {
        console.error('[RelayClient] Failed to connect to signaling server:', error);
        reject(error);
      }
    });
  }

  /**
   * Handle messages from the signaling server
   */
  private async handleSignalingMessage(message: any): Promise<void> {
    console.log('[RelayClient] Received signaling message:', message.type);

    switch (message.type) {
      case 'ready':
        // Server is ready, we can start sending our offer
        console.log('[RelayClient] Server ready for WebRTC connection');
        break;

      case 'sdp-answer':
        // Received SDP answer from relay server
        if (this.peerConnection && message.sdp) {
          const remoteDesc = new RTCSessionDescription({
            type: 'answer',
            sdp: message.sdp,
          });
          await this.peerConnection.setRemoteDescription(remoteDesc);
          console.log('[RelayClient] Remote SDP answer set');
        }
        break;

      case 'ice-candidate':
        // Received ICE candidate from relay server
        if (this.peerConnection && message.candidate) {
          const candidate = new RTCIceCandidate(message.candidate);
          await this.peerConnection.addIceCandidate(candidate);
          console.log('[RelayClient] ICE candidate added');
        }
        break;

      case 'error':
        console.error('[RelayClient] Server error:', message.error);
        this.events.onError?.(message.error);
        break;

      default:
        console.warn('[RelayClient] Unknown message type:', message.type);
    }
  }

  /**
   * Send a message to the signaling server
   */
  private sendToSignalingServer(message: any): void {
    if (this.webSocket && this.webSocket.readyState === WebSocket.OPEN) {
      this.webSocket.send(JSON.stringify(message));
    } else {
      console.warn('[RelayClient] WebSocket not open, cannot send message');
    }
  }

  /**
   * Add a media track to the relay peer connection
   * This is called when a track is received from the Xbox stream
   */
  async addTrack(track: MediaStreamTrack, stream: MediaStream): Promise<void> {
    if (!this.peerConnection) {
      console.error('[RelayClient] Peer connection not initialized');
      return;
    }

    if (!this.config.enabled) {
      console.log('[RelayClient] Relay is disabled, not adding track');
      return;
    }

    try {
      console.log(`[RelayClient] Adding ${track.kind} track to relay connection`);
      this.peerConnection.addTrack(track, stream);

      // After adding tracks, create and send an offer to the relay server
      await this.createAndSendOffer();
    } catch (error) {
      console.error('[RelayClient] Failed to add track:', error);
      this.events.onError?.(
        `Failed to add track: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Create SDP offer and send to relay server
   */
  private async createAndSendOffer(): Promise<void> {
    if (!this.peerConnection) {
      console.error('[RelayClient] Peer connection not initialized');
      return;
    }

    try {
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
      });

      await this.peerConnection.setLocalDescription(offer);

      console.log('[RelayClient] SDP offer created and set as local description');

      this.sendToSignalingServer({
        type: 'sdp-offer',
        sdp: offer.sdp,
      });
    } catch (error) {
      console.error('[RelayClient] Failed to create offer:', error);
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
      console.error('[RelayClient] Max reconnection attempts reached');
      this.events.onError?.('Failed to reconnect to relay server');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(
      `[RelayClient] Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`,
    );

    setTimeout(async () => {
      try {
        await this.close();
        await this.init();
      } catch (error) {
        console.error('[RelayClient] Reconnection failed:', error);
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
   * Close the relay connection
   */
  async close(): Promise<void> {
    console.log('[RelayClient] Closing connection');

    if (this.webSocket) {
      this.webSocket.close();
      this.webSocket = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.isConnected = false;
    this.iceCandidateQueue = [];
    console.log('[RelayClient] Connection closed');
  }

  /**
   * Update relay configuration
   */
  updateConfig(config: Partial<RelayServerConfig>): void {
    this.config = {...this.config, ...config};
    console.log('[RelayClient] Config updated:', this.config);
  }
}

export default RelayClient;
