import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { KkAutoMcpConfig } from '../types.js';
import { flag, id, limit, page } from './schemas.js';
import { registerResourceTools, type ResourceSpec } from './resource.js';

const postType = z.enum(['product', 'interaction', 'video']);
const mediaType = z.enum(['video', 'image']);
const postTo = z.enum(['group', 'fanpage', 'profile', 'all']);
const scopeType = z.enum(['account', 'fanpage']);
const postStatusFilter = z.union([
  z.literal(-1).describe('Rejected (không được đăng).'),
  z.literal(0).describe('Pending review (chờ duyệt).'),
  z.literal(1).describe('Approved and waiting to be posted (chờ đăng).'),
  z.literal(2).describe('Posted (đã đăng).'),
]);
const reviewStatus = z.union([
  z.literal(-1).describe('Reject the post (không được đăng).'),
  z.literal(0).describe('Send the post back to pending review (chờ duyệt).'),
  z.literal(1).describe('Approve the post for publishing (chờ đăng).'),
]);
const scheduleEntry = z.object({
  comment: z.string().min(1),
  delay: z.number().min(0),
});
const schedulePayload = z.union([z.array(scheduleEntry), z.record(z.string(), scheduleEntry)]);
const mediaRef = z.object({
  s3_key: z.string().min(1).describe('Object key returned by media/presign or media/local-upload.'),
  media_type: z.enum(['image', 'video']).optional(),
});
const postFields = {
  title: z.string().min(1),
  content: z.string().min(1),
  post_type: postType,
  media_type: mediaType,
  post_to: postTo,
};

export const fbPostSpec: ResourceSpec = {
  name: 'manage_fb_post',
  title: 'Manage FB posts',
  description: 'kkAuto API v2 Facebook posts: CRUD, review workflow, hashtags, captions, comments, media upload, and bulk review.',
  actions: {
    list: {
      title: 'List FB posts',
      description: 'Paginated post list with review status, type, and hashtag filters.',
      method: 'GET',
      path: '/api/v2/fb-posts',
      query: ['page', 'limit', 'status', 'post_type', 'hashtags'],
      input: {
        page: page(),
        limit: limit(),
        status: postStatusFilter.optional().describe('Use 0 to list posts waiting for approval.'),
        post_type: postType.optional(),
        hashtags: z.string().optional().describe('Hashtag filter passed through to the API.'),
      },
    },
    get: {
      title: 'Get FB post',
      description: 'One FB post by id.',
      method: 'GET',
      path: '/api/v2/fb-posts/{id}',
      input: { id: id('FB post id.') },
    },
    detail: {
      title: 'Get FB post detail',
      description: 'Expanded post payload with media, comments, and scheduling fields.',
      method: 'GET',
      path: '/api/v2/fb-posts/{id}/detail',
      input: { id: id('FB post id.') },
    },
    random: {
      title: 'Random FB post',
      description: 'Least-recently used post for the client pickup loop; update=posted marks it posted.',
      method: 'GET',
      path: '/api/v2/fb-posts/random',
      query: ['update'],
      input: { update: z.enum(['posted']).optional().describe('Set to posted to mark the picked post as posted.') },
    },
    create: {
      title: 'Create FB post',
      description: 'Create one FB post from JSON fields, remote media URLs, or media_refs from the presign upload flow.',
      method: 'POST',
      path: '/api/v2/fb-posts',
      input: {
        ...postFields,
        assistant_id: id('Post assistant id.').optional(),
        status: flag('Review status; defaults to the API default.').optional(),
        file_download: flag('Download remote media server-side.').optional(),
        media: z.array(z.string().url()).max(15).optional().describe('Remote media URLs.'),
        media_refs: z.array(mediaRef).max(15).optional().describe('Uploaded object keys from media/presign or media/local-upload.'),
        hashtags: z.union([z.string(), z.array(z.string().min(1))]).optional(),
        comments: schedulePayload.optional(),
        seeding: schedulePayload.optional(),
        scope_type: scopeType.optional(),
        scope_id: id('Scope id matching scope_type.').optional(),
      },
      guard: 'confirm',
    },
    update: {
      title: 'Update FB post',
      description: 'Update one FB post; media and media_refs replace the media set when present.',
      method: 'PUT',
      path: '/api/v2/fb-posts/{id}',
      input: {
        id: id('FB post id.'),
        title: z.string().min(1).optional(),
        content: z.string().min(1).optional(),
        post_type: postType.optional(),
        media_type: mediaType.optional(),
        post_to: postTo.optional(),
        assistant_id: id('Post assistant id.').optional(),
        status: flag('Review status.').optional(),
        file_download: flag('Download remote media server-side.').optional(),
        media: z.array(z.string().url()).max(15).optional().describe('Remote media URLs; replaces the media set.'),
        media_refs: z.array(mediaRef).max(15).optional().describe('Uploaded object keys; replaces the media set.'),
        hashtags: z.union([z.string(), z.array(z.string().min(1))]).optional(),
        comments: schedulePayload.optional(),
        seeding: schedulePayload.optional(),
        scope_type: scopeType.optional(),
        scope_id: id('Scope id matching scope_type.').optional(),
      },
    },
    delete: {
      title: 'Delete FB post',
      description: 'Delete one FB post. Requires KK_MCP_ENABLE_DELETE.',
      method: 'DELETE',
      path: '/api/v2/fb-posts/{id}',
      input: { id: id('FB post id.') },
      guard: 'delete',
    },
    status: {
      title: 'Update FB post review status',
      description: 'Approve (1), reject (-1), or return to pending review (0); approving makes the post eligible for publishing.',
      method: 'PATCH',
      path: '/api/v2/fb-posts/{id}/status',
      input: {
        id: id('FB post id.'),
        status: reviewStatus.describe('Review status to set. Status 2 (đã đăng) is runtime-managed.'),
      },
    },
    caption: {
      title: 'Update FB post caption',
      description: 'Replace the content of a post that is still pending review.',
      method: 'PUT',
      path: '/api/v2/fb-posts/{id}/caption',
      input: { id: id('FB post id.'), content: z.string().describe('New caption content.') },
    },
    hashtags: {
      title: 'Get FB post hashtags',
      description: 'Hashtag ids attached to one FB post.',
      method: 'GET',
      path: '/api/v2/fb-posts/{id}/hashtags',
      input: { id: id('FB post id.') },
    },
    'update-hashtags': {
      title: 'Set FB post hashtags',
      description: 'Replace the hashtag set of one FB post.',
      method: 'PUT',
      path: '/api/v2/fb-posts/{id}/hashtags',
      input: {
        id: id('FB post id.'),
        hashtag_ids: z.array(id('Hashtag id.')).describe('Full hashtag id set; replaces the current set.'),
      },
    },
    statistics: {
      title: 'Get FB post statistics',
      description: 'Pending, approved, posted, and rejected post counts.',
      method: 'GET',
      path: '/api/v2/fb-posts/{id}/statistics',
      input: { id: id('FB post id.') },
    },
    comments: {
      title: 'List FB post comments',
      description: 'Scheduled comments of one FB post.',
      method: 'GET',
      path: '/api/v2/fb-posts/{id}/comments',
      input: { id: id('FB post id.') },
    },
    'update-comment': {
      title: 'Update FB post comment',
      description: 'Update one scheduled comment of a post.',
      method: 'PUT',
      path: '/api/v2/fb-posts/{id}/comments/{comment_id}',
      input: {
        id: id('FB post id.'),
        comment_id: id('Comment id.'),
        comment: z.string().optional(),
        delay: z.number().min(0).optional(),
        media_url: z.string().optional(),
      },
    },
    'delete-comment': {
      title: 'Delete FB post comment',
      description: 'Delete one scheduled comment. Requires KK_MCP_ENABLE_DELETE.',
      method: 'DELETE',
      path: '/api/v2/fb-posts/{id}/comments/{comment_id}',
      input: { id: id('FB post id.'), comment_id: id('Comment id.') },
      guard: 'delete',
    },
    'source-origin': {
      title: 'Get FB post source origin',
      description: 'Source post provenance of one FB post.',
      method: 'GET',
      path: '/api/v2/fb-posts/{id}/source-origin',
      input: { id: id('FB post id.') },
    },
    'media-presign': {
      title: 'Plan media upload',
      description: 'Get an upload plan (presigned PUT or local gateway) for one media file.',
      method: 'POST',
      path: '/api/v2/fb-posts/media/presign',
      input: {
        filename: z.string().min(1),
        content_type: z.string().min(1).describe('MIME type, e.g. image/jpeg.'),
        file_size: z.number().int().positive(),
      },
    },
    'media-local-upload': {
      title: 'Upload media locally',
      description: 'Upload one local media file through the API gateway (multipart, media field).',
      method: 'POST',
      path: '/api/v2/fb-posts/media/local-upload',
      body: 'form',
      filesField: 'media',
      input: {
        media_files: z.array(z.string().min(1)).length(1).describe('Exactly one local image file path.'),
        s3_key: z.string().optional().describe('Preferred object key from the upload plan.'),
      },
    },
    'download-url': {
      title: 'Get media download URL',
      description: 'Download plan (presigned GET or streamed endpoint) for one post media row.',
      method: 'GET',
      path: '/api/v2/fb-posts/{id}/media/{media_id}/download-url',
      input: { id: id('FB post id.'), media_id: id('Media id.') },
    },
    'review-queue': {
      title: 'List review queue',
      description: 'Paginated posts waiting for review, optionally filtered by hashtag names.',
      method: 'GET',
      path: '/api/v2/fb-posts/review/queue',
      query: ['page', 'limit', 'hashtags'],
      input: {
        page: page(),
        limit: limit(),
        hashtags: z.string().optional().describe('Comma-separated hashtag names to filter the queue.'),
      },
    },
    'review-next': {
      title: 'Next post for review',
      description: 'Next pending post, with its queue position and the pending total.',
      method: 'POST',
      path: '/api/v2/fb-posts/review/next',
      input: {
        exclude_id: id('Post id to skip.').optional(),
        hashtags: z.array(z.string().min(1)).optional().describe('Hashtag names to filter the queue.'),
      },
    },
    'bulk-approve': {
      title: 'Bulk approve FB posts',
      description: 'Approve up to 500 posts in one call; unknown ids are skipped.',
      method: 'POST',
      path: '/api/v2/fb-posts/bulk-approve',
      input: {
        post_ids: z.array(id('FB post id.')).min(1).max(500).describe('Posts to approve (maximum 500).'),
      },
      guard: 'confirm',
    },
    'bulk-reject': {
      title: 'Bulk reject FB posts',
      description: 'Reject up to 500 posts in one call; unknown ids are skipped.',
      method: 'POST',
      path: '/api/v2/fb-posts/bulk-reject',
      input: {
        post_ids: z.array(id('FB post id.')).min(1).max(500).describe('Posts to reject (maximum 500).'),
      },
      guard: 'confirm',
    },
    'bulk-approve-done': {
      title: 'Bulk approve reviewed posts',
      description: 'Approve a batch straight from the review screen (bulk/approve endpoint).',
      method: 'POST',
      path: '/api/v2/fb-posts/bulk/approve',
      input: {
        post_ids: z.array(id('FB post id.')).min(1).max(500).describe('Posts to approve (maximum 500).'),
      },
      guard: 'confirm',
    },
  },
};

export function registerFbPostTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  registerResourceTools(server, client, config, fbPostSpec);
}
