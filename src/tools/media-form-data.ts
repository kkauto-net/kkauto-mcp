import { readFile, stat } from 'node:fs/promises';
import { basename } from 'node:path';

const maxUploadBytes = 10 * 1024 * 1024;
const maxUploadFiles = 15;

export async function buildPostFormData(payload: Record<string, unknown>, mediaFiles: string[]): Promise<FormData> {
  if (Array.isArray(payload.media) && payload.media.length > 0) {
    throw new Error('Use either media URL array or media_files, not both in the same MCP call.');
  }

  const formData = new FormData();
  const payloadWithoutMediaUrls = { ...payload, media: [] };
  formData.set('data', JSON.stringify(payloadWithoutMediaUrls));

  await appendImageFiles(formData, 'media[]', mediaFiles);

  return formData;
}

/**
 * Builds multipart form data for API v2 endpoints whose contract uses an
 * `images[]` file field plus plain scalar form fields (data-images,
 * data-profile-names/{id}/images, products image subresources).
 */
export async function buildImageFilesFormData(
  mediaFiles: string[],
  fields: Record<string, unknown> = {},
  fileFieldName = 'images[]',
): Promise<FormData> {
  const formData = new FormData();

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    formData.set(key, String(value));
  }

  await appendImageFiles(formData, fileFieldName, mediaFiles);

  return formData;
}

async function appendImageFiles(formData: FormData, fieldName: string, mediaFiles: string[]): Promise<void> {
  if (mediaFiles.length > maxUploadFiles) {
    throw new Error(`media_files accepts at most ${maxUploadFiles} files.`);
  }

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
    formData.append(fieldName, blob, basename(filePath));
  }
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