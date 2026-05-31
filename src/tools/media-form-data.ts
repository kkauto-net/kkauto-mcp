import { readFile, stat } from 'node:fs/promises';
import { basename } from 'node:path';

const maxUploadBytes = 10 * 1024 * 1024;

export async function buildPostFormData(payload: Record<string, unknown>, mediaFiles: string[]): Promise<FormData> {
  if (Array.isArray(payload.media) && payload.media.length > 0) {
    throw new Error('Use either media URL array or media_files, not both in the same MCP call.');
  }

  if (mediaFiles.length > 15) {
    throw new Error('media_files accepts at most 15 files.');
  }

  const formData = new FormData();
  const payloadWithoutMediaUrls = { ...payload, media: [] };
  formData.set('data', JSON.stringify(payloadWithoutMediaUrls));

  for (const filePath of mediaFiles) {
    const fileStats = await stat(filePath);
    if (!fileStats.isFile()) {
      throw new Error(`media_files entry is not a file: ${filePath}`);
    }
    if (fileStats.size > maxUploadBytes) {
      throw new Error(`media_files entry exceeds 10 MB: ${filePath}`);
    }

    const buffer = await readFile(filePath);
    const blob = new Blob([buffer], { type: mimeTypeForPath(filePath) });
    formData.append('media[]', blob, basename(filePath));
  }

  return formData;
}

function mimeTypeForPath(filePath: string): string {
  const lowerPath = filePath.toLowerCase();
  if (lowerPath.endsWith('.jpg') || lowerPath.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  if (lowerPath.endsWith('.png')) {
    return 'image/png';
  }
  if (lowerPath.endsWith('.gif')) {
    return 'image/gif';
  }

  throw new Error('media_files only supports .jpg, .jpeg, .png, or .gif files.');
}
