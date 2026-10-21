import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { KkAutoMcpConfig } from '../types.js';
import { id } from './schemas.js';
import { registerResourceTools, type ResourceSpec } from './resource.js';

const maxLength = (max: number) => z.string().max(max);
const mediaUrl = z
  .union([z.string().max(500), z.null()])
  .describe('HTTP(S) source URL; empty string clears to null.')
  .refine((value) => value === null || value.trim() === '' || /^https?:\/\//i.test(value.trim()), {
    message: 'media URLs must use http:// or https://, be an empty string to clear, or null',
  });
const stringList = z.union([
  z.string(),
  z.array(z.string().max(80)).max(20).describe('Up to 20 items, 80 chars each.'),
]);
const year = z.number().int().min(1900).max(2100).nullable().optional();

const familyList = z.union([
  z
    .array(
      z
        .object({
          name: z.string().max(190).optional(),
          relationship: z.string().max(190).optional(),
        })
        .passthrough(),
    )
    .max(20),
  z.string(),
]);

const workHistoryList = z.union([
  z
    .array(
      z
        .object({
          company: z.string().max(190).optional(),
          position: z.string().max(190).optional(),
          city: z.string().max(190).optional(),
          start_year: year,
          end_year: year,
        })
        .passthrough(),
    )
    .max(20),
  z.string(),
]);

const educationList = z.union([
  z
    .array(
      z
        .object({
          school: z.string().max(190).optional(),
          type: z.string().max(190).optional(),
          degree: z.string().max(190).optional(),
          field: z.string().max(190).optional(),
          start_year: year,
          end_year: year,
        })
        .passthrough(),
    )
    .max(20),
  z.string(),
]);

const linksList = z.union([
  z
    .array(
      z
        .object({
          label: z.string().max(190).optional(),
          url: z.string().max(500).optional(),
        })
        .passthrough(),
    )
    .max(20),
  z.string(),
]);

const personaFields = {
  display_name: maxLength(190).optional(),
  age_range: maxLength(20).optional(),
  occupation: maxLength(190).optional(),
  bio: maxLength(2000).optional(),
  avatar_url: mediaUrl.optional(),
  cover_url: mediaUrl.optional(),
  hometown: maxLength(190).optional(),
  current_city: maxLength(190).optional(),
  relationship_status: maxLength(190).optional(),
  name_pronunciation: maxLength(190).optional(),
  interests: stringList.optional(),
  concerns: stringList.optional(),
  travel_places: stringList.optional(),
  favorite_quotes: stringList.optional(),
  languages: stringList.optional(),
  nicknames: stringList.optional(),
  family: familyList.optional(),
  work_history: workHistoryList.optional(),
  education: educationList.optional(),
  links: linksList.optional(),
  ai_instruction: maxLength(2000).optional().describe('Personal-style AI instruction written by the operator.'),
};

const boolish = z
  .union([z.boolean(), z.number().int().min(0).max(1), z.enum(['true', 'false', '0', '1'])])
  .transform((value) => value === true || value === 1 || value === 'true' || value === '1');

export const fbAccountPersonaSpec: ResourceSpec = {
  name: 'manage_fb_account_persona',
  title: 'Manage FB account persona',
  description: 'kkAuto API v2 personae attached to Facebook accounts, including one-click AI generation.',
  actions: {
    get: {
      title: 'Get FB account persona',
      description: 'One persona record by FB account id.',
      method: 'GET',
      path: '/api/v2/fb-accounts/{id}/persona',
      input: { id: id('FB account id.') },
    },
    update: {
      title: 'Update FB account persona',
      description: 'Update persona fields; only supplied keys change and unknown keys are returned as warnings.',
      method: 'PUT',
      path: '/api/v2/fb-accounts/{id}/persona',
      input: { id: id('FB account id.'), ...personaFields },
    },
    generate: {
      title: 'Generate FB account persona',
      description:
        'AI-generate missing persona fields and the personal-style ai_instruction, then persist the merge. Calls an AI provider and may link a data profile name.',
      method: 'POST',
      path: '/api/v2/fb-accounts/{id}/persona/generate',
      input: {
        id: id('FB account id.'),
        provider_id: id('AI provider id; defaults to the active default.').optional(),
        model_type: z.string().optional().describe('Optional model selector for the resolved provider.'),
        persona_overrides: z.record(z.string(), z.unknown()).optional().describe('Persona seed with the writable PUT shape; unknown keys are ignored.'),
        reference_text: z.string().max(4000).optional().describe('Extra reference context, treated as data, not instructions.'),
        generate_fullname: boolish.optional().describe('Default true; false drops AI-returned display names.'),
        merge_data_profile_name: boolish.optional().describe('Default true; may link one unused same-gender data profile name.'),
        data_profile_gender: z.enum(['male', 'female']).nullable().optional().describe('Gender fallback when social gender is blank or invalid.'),
        save_data_profile_gender: boolish.optional().describe('Default true; persists the chosen fallback gender.'),
      },
      guard: 'confirm',
    },
  },
};

export function registerFbAccountPersonaTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  registerResourceTools(server, client, config, fbAccountPersonaSpec);
}
