import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { KkAutoMcpConfig } from '../types.js';
import { id, limit, page } from './schemas.js';
import { registerResourceTools, type ResourceSpec } from './resource.js';

const sourcePlatform = z.enum([
  'facebook',
  'instagram',
  'twitter',
  'youtube',
  'tiktok',
  'reddit',
  'pinterest',
  'website',
  'linkedin',
  'telegram',
  'discord',
  'other',
]);
const workflowStatus = z.enum(['pending', 'approved', 'rejected', 'waiting_confirmation']);
const sourceFormat = z.enum(['feed_post', 'reel', 'story', 'short', 'live', 'carousel', 'article', 'unknown', 'other']);
const topicType = z.enum(['normal', 'tutorial', 'share', 'review', 'comparison', 'introduction', 'promotion', 'news', 'event']);
const lengthType = z.enum(['short', 'medium', 'long']);
const contentShape = z.enum(['text_only', 'image_only', 'video_only', 'text_image', 'text_video', 'image_video', 'text_image_video']);
const mediaPayload = z.object({
  media_type: z.enum(['image', 'video']).default('image'),
  media_url: z.string().url(),
});
const offset = z.number().int().min(0).optional();

const statusFilter = {
  workflow_status: workflowStatus.optional().describe('Canonical lifecycle status.'),
  status: workflowStatus.optional().describe('Deprecated API alias for workflow_status.'),
};

export const sourcePostSpec: ResourceSpec = {
  name: 'manage_source_post',
  title: 'Manage source posts',
  description: 'kkAuto API v2 source posts: CRUD, search, platform/hashtag views, randomness, statistics, and bulk review.',
  actions: {
    list: {
      title: 'List source posts',
      description: 'Offset-paginated source post list with platform, lifecycle, format, and date filters.',
      method: 'GET',
      path: '/api/v2/source-posts',
      query: [
        'source_platform',
        'workflow_status',
        'status',
        'source_format',
        'topic_type',
        'content_shape',
        'length_type',
        'post_type',
        'hashtag',
        'date_from',
        'date_to',
        'search',
        'order_by',
        'order_direction',
        'limit',
        'offset',
      ],
      input: {
        source_platform: sourcePlatform.optional(),
        ...statusFilter,
        source_format: sourceFormat.optional(),
        topic_type: topicType.optional(),
        content_shape: contentShape.optional(),
        length_type: lengthType.optional(),
        post_type: lengthType.optional().describe('Deprecated API alias for length_type.'),
        hashtag: z.string().min(1).optional(),
        date_from: z.string().min(1).optional(),
        date_to: z.string().min(1).optional(),
        search: z.string().min(1).optional(),
        order_by: z
          .enum(['published_at', 'id', 'created_at', 'updated_at', 'quality_score', 'popularity_score'])
          .optional(),
        order_direction: z.enum(['ASC', 'DESC']).optional(),
        limit: limit(),
        offset,
      },
    },
    get: {
      title: 'Get source post',
      description: 'One source post by id.',
      method: 'GET',
      path: '/api/v2/source-posts/{id}',
      input: { id: id('Source post id.') },
    },
    random: {
      title: 'Random source post',
      description: 'Random approved source post, optionally filtered.',
      method: 'GET',
      path: '/api/v2/source-posts/random',
      query: ['workflow_status', 'status', 'source_platform', 'topic_type', 'hashtag'],
      input: {
        ...statusFilter,
        source_platform: sourcePlatform.optional(),
        topic_type: topicType.optional(),
        hashtag: z.string().min(1).optional(),
      },
    },
    popular: {
      title: 'Popular source posts',
      description: 'Source posts ranked by popularity score.',
      method: 'GET',
      path: '/api/v2/source-posts/popular',
      query: ['limit'],
      input: { limit: limit() },
    },
    'high-quality': {
      title: 'High-quality source posts',
      description: 'Source posts ranked by quality score.',
      method: 'GET',
      path: '/api/v2/source-posts/high-quality',
      query: ['limit'],
      input: { limit: limit() },
    },
    search: {
      title: 'Search source posts',
      description: 'Keyword search over source posts.',
      method: 'GET',
      path: '/api/v2/source-posts/search',
      query: ['q', 'workflow_status', 'status', 'limit', 'offset'],
      input: {
        q: z.string().min(1),
        ...statusFilter,
        limit: limit(),
        offset,
      },
    },
    statistics: {
      title: 'Get source post statistics',
      description: 'Aggregate source post statistics.',
      method: 'GET',
      path: '/api/v2/source-posts/statistics',
      input: {},
    },
    'by-platform': {
      title: 'List source posts by platform',
      description: 'Source posts of one platform.',
      method: 'GET',
      path: '/api/v2/source-posts/by-platform/{platform}',
      query: ['workflow_status', 'status', 'limit', 'offset'],
      input: {
        platform: sourcePlatform,
        ...statusFilter,
        limit: limit(),
        offset,
      },
    },
    'by-hashtag': {
      title: 'List source posts by hashtag',
      description: 'Source posts carrying one hashtag.',
      method: 'GET',
      path: '/api/v2/source-posts/by-hashtag/{hashtag}',
      query: ['workflow_status', 'status', 'limit', 'offset'],
      input: {
        hashtag: z.string().min(1),
        ...statusFilter,
        limit: limit(),
        offset,
      },
    },
    create: {
      title: 'Create source post',
      description: 'Create a source post with remote media URLs.',
      method: 'POST',
      path: '/api/v2/source-posts',
      input: {
        title: z.string().min(3).max(500),
        content: z.string().min(1),
        source_platform: sourcePlatform,
        source_channel: z.string().min(1).max(255),
        source_author: z.string().min(1).max(255),
        source_url: z.string().url().max(1000),
        source_post_id: z.string().min(1).max(255),
        published_at: z.string().min(1).describe('Timestamp accepted by the API, e.g. 2026-05-26 10:30:00.'),
        source_format: sourceFormat.optional(),
        ...statusFilter,
        topic_type: topicType.optional(),
        length_type: lengthType.optional(),
        post_type: lengthType.optional().describe('Deprecated API alias for length_type.'),
        source_crawler_id: id('Source crawler id.').optional(),
        media: z.array(mediaPayload).max(50).optional(),
        hashtags: z.union([z.string(), z.array(z.string().min(1))]).optional(),
        comments: z.array(z.record(z.string(), z.unknown())).max(200).optional(),
        analytics: z.record(z.string(), z.unknown()).optional(),
      },
    },
    update: {
      title: 'Update source post',
      description: 'Partial update of one source post; media replaces the media set when present.',
      method: 'PUT',
      path: '/api/v2/source-posts/{id}',
      input: {
        id: id('Source post id.'),
        title: z.string().min(3).max(500).optional(),
        content: z.string().min(1).optional(),
        source_platform: sourcePlatform.optional(),
        source_channel: z.string().min(1).max(255).optional(),
        source_author: z.string().min(1).max(255).optional(),
        source_url: z.string().url().max(1000).optional(),
        source_format: sourceFormat.optional(),
        ...statusFilter,
        topic_type: topicType.optional(),
        length_type: lengthType.optional(),
        post_type: lengthType.optional().describe('Deprecated API alias for length_type.'),
        media: z.array(mediaPayload).max(50).optional().describe('Only send when replacing media rows.'),
      },
    },
    status: {
      title: 'Update source post status',
      description: 'Set the workflow status of one source post.',
      method: 'PATCH',
      path: '/api/v2/source-posts/{id}/status',
      input: {
        id: id('Source post id.'),
        workflow_status: workflowStatus.optional(),
        status: workflowStatus.optional().describe('Deprecated API alias for workflow_status.'),
        notes: z.string().optional(),
      },
    },
    'bulk-approve': {
      title: 'Bulk approve source posts',
      description: 'Mark up to 500 source posts as approved; unknown ids are skipped.',
      method: 'POST',
      path: '/api/v2/source-posts/bulk-approve',
      input: {
        post_ids: z.array(id('Source post id.')).min(1).max(500).describe('Posts to approve (maximum 500).'),
      },
    },
    'bulk-reject': {
      title: 'Bulk reject source posts',
      description: 'Mark up to 500 source posts as rejected; unknown ids are skipped.',
      method: 'POST',
      path: '/api/v2/source-posts/bulk-reject',
      input: {
        post_ids: z.array(id('Source post id.')).min(1).max(500).describe('Posts to reject (maximum 500).'),
      },
    },
    delete: {
      title: 'Delete source post',
      description: 'Delete one source post. Requires KK_MCP_ENABLE_DELETE.',
      method: 'DELETE',
      path: '/api/v2/source-posts/{id}',
      input: { id: id('Source post id.') },
      guard: 'delete',
    },
  },
};

export function registerSourcePostTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  registerResourceTools(server, client, config, sourcePostSpec);
}
