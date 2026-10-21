import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { KkAutoApiClient } from '../kkauto-api-client.js';
import type { KkAutoMcpConfig } from '../types.js';
import { registerResourceTools, type ResourceSpec } from './resource.js';
import { registerCapabilityTools } from './capabilities.js';
import { mobileFarmSpec, proxySpec } from './infrastructure.js';
import { affiliateProductSpec } from './affiliate.js';
import { aiProviderSpec, fbPostAssistantSpec, fbAiManagerSpec } from './ai-config.js';
import { captchaServiceSpec } from './captcha.js';
import { configSpec } from './config.js';
import { dataImageSpec } from './data-images.js';
import { dataProfileNameSpec } from './data-profile-names.js';
import { fbAccountPersonaSpec } from './fb-account-persona.js';
import { fbAccountSpec } from './fb-accounts.js';
import { fbBlockUidSpec } from './fb-block-uids.js';
import { fbCampaignSpec } from './fb-campaigns.js';
import { fbFanpageSpec } from './fb-fanpages.js';
import { fbGroupSpec } from './fb-groups.js';
import { fbKeywordSpec } from './fb-keywords.js';
import { fbLogSpec } from './fb-logs.js';
import { fbPostSpec } from './fb-posts.js';
import { fbTaskSpec } from './fb-tasks.js';
import { fbCategorySpec, fbTagSpec } from './fb-taxonomy.js';
import { fbUidSpec } from './fb-uids.js';
import { hashtagSpec } from './hashtags.js';
import { hidemiumSpec } from './hidemium.js';
import { igPostSpec, igTaskSpec } from './ig.js';
import { dataVideoSpec, dataImageCategorySpec } from './media.js';
import { productCategorySpec, productAttributeSpec } from './products-extra.js';
import { productSpec } from './products.js';
import { profileSpec } from './profiles.js';
import { socialAccountSpec } from './social-accounts.js';
import { sourceCrawlerSpec } from './source-crawlers.js';
import { sourcePostSpec } from './source-posts.js';
import { sourceCrawlerTaskSpec, sourcePostWorkflowSpec } from './source-tasks.js';
import { storefrontSpec } from './storefront.js';
import { adminUserSpec, apiTokenSpec, notificationSpec, storageBackendSpec } from './system.js';
import { accountWorkflowSpec, fanpageWorkflowSpec, groupWorkflowSpec } from './workflows.js';
import { zaloGroupSpec } from './zalo-groups.js';

/** Every grouped `manage_<resource>` tool spec, in registration order. */
export const RESOURCE_SPECS: ResourceSpec[] = [
  proxySpec,
  mobileFarmSpec,
  affiliateProductSpec,
  aiProviderSpec,
  fbPostAssistantSpec,
  fbAiManagerSpec,
  captchaServiceSpec,
  configSpec,
  dataImageSpec,
  dataProfileNameSpec,
  fbAccountPersonaSpec,
  fbAccountSpec,
  fbBlockUidSpec,
  fbCampaignSpec,
  fbFanpageSpec,
  fbGroupSpec,
  fbKeywordSpec,
  fbLogSpec,
  fbPostSpec,
  fbTaskSpec,
  fbCategorySpec,
  fbTagSpec,
  fbUidSpec,
  hashtagSpec,
  hidemiumSpec,
  igPostSpec,
  igTaskSpec,
  dataVideoSpec,
  dataImageCategorySpec,
  productCategorySpec,
  productAttributeSpec,
  productSpec,
  profileSpec,
  socialAccountSpec,
  sourceCrawlerSpec,
  sourcePostSpec,
  sourceCrawlerTaskSpec,
  sourcePostWorkflowSpec,
  storefrontSpec,
  adminUserSpec,
  apiTokenSpec,
  notificationSpec,
  storageBackendSpec,
  accountWorkflowSpec,
  fanpageWorkflowSpec,
  groupWorkflowSpec,
  zaloGroupSpec,
];

export function registerAllTools(server: McpServer, client: KkAutoApiClient, config: KkAutoMcpConfig): void {
  for (const spec of RESOURCE_SPECS) {
    registerResourceTools(server, client, config, spec);
  }

  registerCapabilityTools(server, client, config);
}
