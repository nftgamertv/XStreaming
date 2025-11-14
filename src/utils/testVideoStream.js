/**
 * Test video stream generator for testing relay without Xbox
 *
 * This module creates a synthetic video stream that can be used
 * to test the relay functionality without an actual Xbox connection.
 */

import { mediaDevices } from 'react-native-webrtc';

/**
 * Create a test video stream using device camera
 * This simulates the Xbox video stream for testing purposes
 */
export async function createTestVideoStream() {
  try {
    console.log('[TestStream] Creating test video stream from camera...');

    const stream = await mediaDevices.getUserMedia({
      video: {
        width: 1280,
        height: 720,
        frameRate: 60,
      },
      audio: true,
    });

    console.log('[TestStream] Test stream created successfully');
    console.log('[TestStream] Video tracks:', stream.getVideoTracks().length);
    console.log('[TestStream] Audio tracks:', stream.getAudioTracks().length);

    return stream;
  } catch (error) {
    console.error('[TestStream] Failed to create test stream:', error);
    throw new Error(`Could not create test stream: ${error.message}`);
  }
}

/**
 * Create a display capture stream (screen recording)
 * Note: This may not work on all React Native platforms
 */
export async function createScreenCaptureStream() {
  try {
    console.log('[TestStream] Creating screen capture stream...');

    // Note: getDisplayMedia might not be available in React Native
    // This is more for future compatibility
    const stream = await mediaDevices.getDisplayMedia({
      video: {
        width: 1280,
        height: 720,
      },
      audio: false,
    });

    console.log('[TestStream] Screen capture stream created');
    return stream;
  } catch (error) {
    console.error('[TestStream] Screen capture not available:', error);
    throw error;
  }
}

/**
 * Get available media devices for testing
 */
export async function getAvailableDevices() {
  try {
    const devices = await mediaDevices.enumerateDevices();

    const cameras = devices.filter(d => d.kind === 'videoinput');
    const microphones = devices.filter(d => d.kind === 'audioinput');

    console.log('[TestStream] Available cameras:', cameras.length);
    console.log('[TestStream] Available microphones:', microphones.length);

    return {
      cameras,
      microphones,
      hasCamera: cameras.length > 0,
      hasMicrophone: microphones.length > 0,
    };
  } catch (error) {
    console.error('[TestStream] Could not enumerate devices:', error);
    return {
      cameras: [],
      microphones: [],
      hasCamera: false,
      hasMicrophone: false,
    };
  }
}

export default {
  createTestVideoStream,
  createScreenCaptureStream,
  getAvailableDevices,
};
