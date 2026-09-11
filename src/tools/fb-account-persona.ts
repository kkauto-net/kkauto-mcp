import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { ApiEnvelope, KkAutoMcpConfig } from '../types.js';
import { jsonResult, pruneUndefined } from './shared.js';

const positiveInt = z.number().int().positive();
const maxLength = (max: number) => z.string().max(max);
const mediaUrl = z
  .union([z.string().max(500), z.null()])
  .describe('HTTP(S) source URL; empty string clears to null. Must use http:// or https://.')
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

const getSchema = {
  id: positiveInt,
};

const updateSchema = {
  id: positiveInt,
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

const boolish = z.union([z.boolean(), z.number().int().min(0).max(1), z.enum(['true', 'false', '0', '1'])]);

const generateSchema = {
  id: positiveInt,
  provider_id: positiveInt.optional().describe('Override the AI provider; falls back to the default active provider.'),
  model_type: z.string().optional().describe('Optional model selector for the resolved provider.'),
  persona_overrides: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Per-request persona seed with the writable PUT persona shape; unknown keys are ignored.'),
  reference_text: z.string().max(4000).optional().describe('Additional reference context, treated as data, not instructions.'),
  generate_fullname: boolish.optional().describe('Default true. When false, AI-returned display names are dropped.'),
  merge_data_profile_name: boolish.optional().describe('Default true. May link one unused same-gender Data Profile Name to this account.'),
  data_profile_gender: z.enum(['male', 'female']).nullable().optional().describe('Gender fallback when social gender is blank or invalid.'),
  save_data_profile_gender: boolish.optional().describe('Default true. Persists the selected fallback gender after generation succeeds.'),
};

const normalizeBoolish = (value: boolean | number | 'true' | 'false' | '0' | '1' | undefined): boolean | undefined => {
  if (value === undefined) {
    return undefined;
  }
  return value === true || value === 1 || value === 'true' || value === '1';
};

type GetInput = z.infer<z.ZodObject<typeof getSchema>>;
type UpdateInput = z.infer<z.ZodObject<typeof updateSchema>>;
type GenerateInput = z.infer<z.ZodObject<typeof generateSchema>>;

export function registerFbAccountPersonaTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  server.registerTool(
    'get_fb_account_persona',
    {
      title: 'Get FB account persona',
      description: 'Get the persona record attached to one kkAuto API v2 FB account.',
      inputSchema: getSchema,
    },
    async (input: GetInput) => {
      const response = await client.get<ApiEnvelope>(`/api/v2/fb-accounts/${input.id}/persona`);

      return jsonResult(response);
    },
  );

  server.registerTool(
    'update_fb_account_persona',
    {
      title: 'Update FB account persona',
      description:
        'Update persona fields of one kkAuto API v2 FB account. Only keys present in the payload are updated; unknown keys are ignored by the API and returned as warnings.',
      inputSchema: updateSchema,
    },
    async (input: UpdateInput) => {
      const { id, ...fields } = input;
      const payload = pruneUndefined(fields);

      if (Object.keys(payload).length === 0) {
        throw new Error('At least one persona field is required for update_fb_account_persona');
      }

      const response = await client.put<ApiEnvelope>(`/api/v2/fb-accounts/${id}/persona`, { body: payload });

      return jsonResult(response);
    },
  );

  server.registerTool(
    'generate_fb_account_persona',
    {
      title: 'Generate FB account persona',
      description:
        'One-click AI generation that fills missing persona fields and writes a personal-style ai_instruction for one kkAuto API v2 FB account. NOTE: the API calls an AI provider and auto-persists the merged persona, and may link or backfill a Data Profile Name.',
      inputSchema: generateSchema,
    },
    async (input: GenerateInput) => {
      const { id, ...fields } = input;
      const payload = pruneUndefined({
        ...fields,
        generate_fullname: normalizeBoolish(fields.generate_fullname),
        merge_data_profile_name: normalizeBoolish(fields.merge_data_profile_name),
        save_data_profile_gender: normalizeBoolish(fields.save_data_profile_gender),
      });

      const response = await client.post<ApiEnvelope>(`/api/v2/fb-accounts/${id}/persona/generate`, { body: payload });

      return jsonResult(response);
    },
  );
}