import { z } from 'zod';

/** Shared field primitives for grouped resource specs. */
export const id = (what = 'Resource id.') => z.number().int().positive().describe(what);
export const page = () => z.number().int().positive().optional().describe('Page number, starting at 1.');
export const limit = () => z.number().int().positive().optional().describe('Items per page. Capped by KK_MCP_MAX_LIST_LIMIT.');
export const search = (what = 'Partial text match.') => z.string().optional().describe(what);
export const sortBy = (columns: string[]) =>
  z.enum(columns as [string, ...string[]]).optional().describe('Sort column (whitelisted by the API).');
export const sortOrder = () => z.enum(['ASC', 'DESC']).optional().describe('Sort direction, default DESC.');
export const flag = (what: string) => z.union([z.literal(0), z.literal(1)]).describe(what);
export const text = (what: string, max?: number) => {
  const schema = z.string().describe(what);
  return max === undefined ? schema : schema.max(max);
};
