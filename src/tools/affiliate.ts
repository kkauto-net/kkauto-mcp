import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { KkAutoMcpConfig } from '../types.js';
import { id, limit, page, search, sortBy, sortOrder } from './schemas.js';
import { registerResourceTools, type ResourceSpec } from './resource.js';

/**
 * goods: affiliate products with their media assets, tracked links and hashtags.
 */

export const affiliateProductSpec: ResourceSpec = {
  name: 'manage_affiliate_product',
  title: 'Manage affiliate products',
  description: 'kkAuto API v2 affiliate products: CRUD, bulk status, assets, links, stats and hashtag helpers.',
  actions: {
    list: {
      title: 'List affiliate products',
      description: 'Paginated affiliate product list with channel/status/hashtag filters.',
      method: 'GET',
      path: '/api/v2/affiliate-products',
      query: ['page', 'limit', 'search', 'affiliate_channel', 'status', 'hashtag', 'sort_by', 'sort_order'],
      input: {
        page: page(),
        limit: limit(),
        search: search('Partial match on the product name or description.'),
        affiliate_channel: z.string().optional().describe('Affiliate channel filter.'),
        status: z.string().optional().describe('Status filter.'),
        hashtag: z.string().optional().describe('Hashtag name filter.'),
        sort_by: sortBy(['id', 'product_name', 'product_price', 'discount_rate', 'status', 'created_at', 'updated_at']),
        sort_order: sortOrder(),
      },
    },
    get: {
      title: 'Get affiliate product',
      description: 'One affiliate product with assets, links and hashtags.',
      method: 'GET',
      path: '/api/v2/affiliate-products/{id}',
      input: { id: id('Product id.') },
    },
    create: {
      title: 'Create affiliate product',
      description: 'Create an affiliate product and link its hashtags.',
      method: 'POST',
      path: '/api/v2/affiliate-products',
      input: {
        affiliate_channel: z.string().describe('Affiliate channel (e.g. shopee).'),
        product_name: z.string().min(1).max(255).describe('Product name.'),
        product_price: z.number().nonnegative().describe('Product price.'),
        discount_rate: z.number().nonnegative().optional().describe('Discount rate.'),
        product_description: z.string().optional().describe('Description.'),
        status: z.string().optional().describe('Status.'),
        hashtags: z.array(z.union([z.number().int().positive(), z.string()])).optional().describe('Hashtag ids or names.'),
      },
    },
    update: {
      title: 'Update affiliate product',
      description: 'Update affiliate product fields; omitted keys are kept.',
      method: 'PUT',
      path: '/api/v2/affiliate-products/{id}',
      input: {
        id: id('Product id.'),
        affiliate_channel: z.string().optional().describe('Affiliate channel.'),
        product_name: z.string().min(1).max(255).optional().describe('Product name.'),
        product_price: z.number().nonnegative().optional().describe('Product price.'),
        discount_rate: z.number().nonnegative().optional().describe('Discount rate.'),
        product_description: z.string().optional().describe('Description.'),
        status: z.string().optional().describe('Status.'),
        hashtags: z.array(z.union([z.number().int().positive(), z.string()])).optional().describe('Hashtag ids or names.'),
      },
    },
    delete: {
      title: 'Delete affiliate product',
      description: 'Delete one affiliate product. Requires KK_MCP_ENABLE_DELETE.',
      method: 'DELETE',
      path: '/api/v2/affiliate-products/{id}',
      input: { id: id('Product id.') },
      guard: 'delete',
    },
    status: {
      title: 'Set affiliate status',
      description: 'Update the status of this product (and any ids supplied in the body).',
      method: 'PATCH',
      path: '/api/v2/affiliate-products/{id}/status',
      input: {
        id: id('Product id.'),
        status: z.string().describe('New status.'),
        ids: z.array(z.number().int().positive()).optional().describe('Additional product ids to update.'),
      },
    },
    assets: {
      title: 'Add asset',
      description: 'Upload one local image or video asset for the product.',
      method: 'POST',
      path: '/api/v2/affiliate-products/{id}/assets',
      body: 'form',
      filesField: 'file',
      input: {
        id: id('Product id.'),
        media_files: z.array(z.string().min(1)).max(1).describe('Local image/video file path.'),
        asset_type: z.enum(['image', 'video']).optional().describe('Asset type, default image.'),
      },
    },
    'delete-asset': {
      title: 'Delete asset',
      description: 'Delete one product asset. Requires KK_MCP_ENABLE_DELETE.',
      method: 'DELETE',
      path: '/api/v2/affiliate-products/{id}/assets/{assetId}',
      input: { id: id('Product id.'), assetId: id('Asset id.') },
      guard: 'delete',
    },
    links: {
      title: 'Add affiliate link',
      description: 'Attach one affiliate URL to the product.',
      method: 'POST',
      path: '/api/v2/affiliate-products/{id}/links',
      input: {
        id: id('Product id.'),
        affiliate_url: z.string().url().describe('Affiliate URL.'),
        link_name: z.string().max(255).optional().describe('Link label.'),
        link_type: z.enum(['primary', 'secondary', 'backup']).optional().describe('Link role.'),
      },
    },
    'delete-link': {
      title: 'Delete affiliate link',
      description: 'Delete one product link. Requires KK_MCP_ENABLE_DELETE.',
      method: 'DELETE',
      path: '/api/v2/affiliate-products/{id}/links/{linkId}',
      input: { id: id('Product id.'), linkId: id('Link id.') },
      guard: 'delete',
    },
    stats: {
      title: 'Affiliate product stats',
      description: 'Clicks and conversions of one affiliate product.',
      method: 'GET',
      path: '/api/v2/affiliate-products/{id}/stats',
      input: { id: id('Product id.') },
    },
    'search-hashtags': {
      title: 'Search hashtags',
      description: 'Hashtag search for the affiliate product editor.',
      method: 'GET',
      path: '/api/v2/affiliate-products/search-hashtags',
      query: ['q', 'search', 'limit'],
      input: {
        q: z.string().optional().describe('Partial hashtag name.'),
        search: z.string().optional().describe('Alias of q.'),
        limit: limit(),
      },
    },
    'quick-create-hashtag': {
      title: 'Quick create hashtag',
      description: 'Find-or-create one hashtag by name.',
      method: 'POST',
      path: '/api/v2/affiliate-products/quick-create-hashtag',
      input: { name: z.string().min(2).max(100).describe('Hashtag name.') },
    },
  },
};

export function registerAffiliateProductTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  registerResourceTools(server, client, config, affiliateProductSpec);
}
