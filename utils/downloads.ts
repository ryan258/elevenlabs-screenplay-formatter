import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { GeneratedBlob, ManifestEntry } from '../types';
import { manifestToCsv } from './manifest';

export const downloadFile = (blob: Blob, filename: string) => {
  // Explicitly set the MIME type based on the filename extension
  // This helps browsers that might ignore the initial blob type or filename
  let mimeType = blob.type || 'application/octet-stream';
  if (filename.endsWith('.zip')) {
    mimeType = 'application/zip';
  } else if (filename.endsWith('.mp3')) {
    mimeType = 'audio/mpeg';
  } else if (filename.endsWith('.json')) {
    mimeType = 'application/json';
  } else if (filename.endsWith('.csv')) {
    mimeType = 'text/csv';
  }

  // Create a new blob with the enforced type
  const blobWithCorrectType = new Blob([blob], { type: mimeType });

  // Use file-saver to handle the download
  saveAs(blobWithCorrectType, filename);
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
  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    mimeType: 'application/zip'
  });
};
