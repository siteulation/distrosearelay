export enum ConnectionState {
  IDLE = 'IDLE',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
  DISCONNECTED = 'DISCONNECTED'
}

export interface StreamData {
  id: string;
  timestamp: number;
  data: Uint8Array;
}

export interface AudioVisualizerProps {
  isPlaying: boolean;
  audioData: Uint8Array;
}
