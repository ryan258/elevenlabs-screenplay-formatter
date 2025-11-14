import { GeneratedBlob } from '../types';

export interface SerializedGeneratedBlob {
  filename: string;
  mimeType: string;
  base64: string;
  startTimeMs?: number;
  endTimeMs?: number;
  alignment?: GeneratedBlob['alignment'];
}

const bufferToBase64 = (buffer: ArrayBuffer) => {
  if (typeof window === 'undefined') {
    return Buffer.from(buffer).toString('base64');
  }

  let binary = '';
  const bytes = new Uint8Array(buffer);
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary);
};

const base64ToArrayBuffer = (base64: string) => {
  if (typeof window === 'undefined') {
    return Buffer.from(base64, 'base64');
  }

  const binary = window.atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

export const serializeGeneratedBlobs = async (blobs: GeneratedBlob[]): Promise<SerializedGeneratedBlob[]> => {
  return Promise.all(
    blobs.map(async ({ blob, filename, startTimeMs, endTimeMs, alignment }) => {
      const arrayBuffer = await blob.arrayBuffer();
      return {
        filename,
        mimeType: blob.type || 'application/octet-stream',
        base64: bufferToBase64(arrayBuffer),
        startTimeMs,
        endTimeMs,
        alignment
      };
    })
  );
};

export const deserializeGeneratedBlobs = (serialized: SerializedGeneratedBlob[]): GeneratedBlob[] => {
  return serialized.map(item => {
    const buffer = base64ToArrayBuffer(item.base64);
    const blob = new Blob([buffer], { type: item.mimeType || 'application/octet-stream' });
    return {
      blob,
      filename: item.filename,
      startTimeMs: item.startTimeMs,
      endTimeMs: item.endTimeMs,
      alignment: item.alignment
    };
  });
};
