import JSZip from 'jszip';
import { GeneratedBlob, ManifestEntry } from '../types';
import { manifestToCsv } from './manifest';

export const downloadFile = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const buildZipBundle = async (blobs: GeneratedBlob[], manifestEntries: ManifestEntry[]) => {
  const zip = new JSZip();
  blobs.forEach(({ blob, filename }) => {
    const safeName = filename || `clip_${Date.now()}.mp3`;
    zip.file(safeName, blob);
  });
  if (manifestEntries.length) {
    zip.file('manifest.json', JSON.stringify(manifestEntries, null, 2));
    const csv = manifestToCsv(manifestEntries);
    zip.file('manifest.csv', csv);
  }
  return zip.generateAsync({ type: 'blob' });
};
