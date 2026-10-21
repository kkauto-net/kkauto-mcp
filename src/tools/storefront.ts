import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { KkAutoMcpConfig } from '../types.js';
import { id, limit, page, search, sortBy, sortOrder } from './schemas.js';
import { registerResourceTools, type ResourceSpec } from './resource.js';

/**
 * storefront: orders and customers (settings live in manage_config group
 * `storefront.settings`).
 */

export const storefrontSpec: ResourceSpec = {
  name: 'manage_storefront',
  title: 'Manage storefront orders and customers',
  description: 'kkAuto API v2 storefront: order list/read/status/payment confirmation and customer list/read.',
  actions: {
    'list-orders': {
      title: 'List orders',
      description: 'Paginated order list with status/payment/customer filters.',
      method: 'GET',
      path: '/api/v2/storefront/orders',
      query: ['page', 'limit', 'search', 'status', 'payment_status', 'customer_id', 'sort_by', 'sort_order'],
      input: {
        page: page(),
        limit: limit(),
        search: search('Partial match on order code, customer name, phone or email.'),
        status: z.string().optional().describe('Order status filter.'),
        payment_status: z.string().optional().describe('Payment status filter.'),
        customer_id: id('Customer id filter.').optional(),
        sort_by: sortBy(['id', 'order_code', 'status', 'payment_status', 'total_amount', 'placed_at', 'created_at', 'updated_at']),
        sort_order: sortOrder(),
      },
    },
    'get-order': {
      title: 'Get order',
      description: 'One order with its items and payments.',
      method: 'GET',
      path: '/api/v2/storefront/orders/{id}',
      input: { id: id('Order id.') },
    },
    'order-status': {
      title: 'Set order status',
      description: 'Transition one order to another status.',
      method: 'PATCH',
      path: '/api/v2/storefront/orders/{id}/status',
      input: { id: id('Order id.'), status: z.string().describe('New order status.') },
    },
    'confirm-payment': {
      title: 'Confirm payment',
      description: 'Mark the latest payment of the order as paid and advance the order.',
      method: 'POST',
      path: '/api/v2/storefront/orders/{id}/confirm-payment',
      input: { id: id('Order id.') },
      guard: 'confirm',
    },
    'list-customers': {
      title: 'List customers',
      description: 'Paginated customer list with status filter.',
      method: 'GET',
      path: '/api/v2/storefront/customers',
      query: ['page', 'limit', 'search', 'status', 'sort_by', 'sort_order'],
      input: {
        page: page(),
        limit: limit(),
        search: search('Partial match on phone, name or email.'),
        status: z.string().optional().describe('Customer status filter.'),
        sort_by: sortBy(['id', 'name', 'phone', 'email', 'status', 'last_login_at', 'created_at']),
        sort_order: sortOrder(),
      },
    },
    'get-customer': {
      title: 'Get customer',
      description: 'One customer by id (password hash is never returned).',
      method: 'GET',
      path: '/api/v2/storefront/customers/{id}',
      input: { id: id('Customer id.') },
    },
  },
};

export function registerStorefrontTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  registerResourceTools(server, client, config, storefrontSpec);
}
