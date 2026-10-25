import { desktop } from './desktop';
import { getPrefs } from './prefs';
import { configureRecordings, indexedDbStore, memoryStore, setRecSettings, type Env, type FileStore } from './recordings';

/** Connects lib/recordings to this browser or to the desktop shell. Safe to call many times. */
let installed = false;
function safeStore(name: string): FileStore { try { if (typeof indexedDB !== 'undefined') return indexedDbStore(name); } catch { /* Fall back to memory. */ } return memoryStore(); }

export function installRecordings() {
  if (installed || typeof window === 'undefined') { setRecSettings(getPrefs().recordings); return; }
  installed = true;
  // A separate offline context only decodes and builds buffers, so loading never touches the live audio graph.
  const offline = new OfflineAudioContext(1, 1, 48000);
  const env: Env = {
    base: document.baseURI,
    decode: async (bytes) => {
      const buffer = await offline.decodeAudioData(bytes);
      return { sampleRate: buffer.sampleRate, channels: Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index).slice()) };
    },
    make: (channels, sampleRate) => {
      const buffer = offline.createBuffer(channels.length, channels[0].length, sampleRate);
      channels.forEach((channel, index) => buffer.copyToChannel(channel as Float32Array<ArrayBuffer>, index));
      return buffer;
    },
    fetchBytes: async (url) => {
      const response = await fetch(url, { cache: 'no-cache' });
      if (!response.ok) return null;
      const type = response.headers.get('content-type') ?? '';
      if (type.includes('text/html')) return null; // A dev server answers unknown paths with the page itself.
      return response.arrayBuffer();
    },
    readFolder: desktop?.readSound ? async (slot) => { const result = await desktop!.readSound(slot); return result ? { name: result.name, bytes: result.bytes } : null; } : undefined,
    custom: safeStore('swa-sound-files'),
    cache: safeStore('swa-sound-cache'),
  };
  configureRecordings(env);
  setRecSettings(getPrefs().recordings);
}
