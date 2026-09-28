/**
 * Meridian Skillgate options + commerce module wiring (product glue only).
 */

import {
  Skillgate,
  defaultSkillgateOptions,
  enrichSpecWithAgentSkills,
  normalizeOpenApiPaths,
  type OpenApiLike,
  type SkillgateOptions,
} from '@hazeljs/skillgate';
import { collectControllersFromModule } from '@hazeljs/core';
import { createOpenApiDocument } from '@hazeljs/swagger';
import { CommerceApiModule } from '../api/commerce-api.module';
import { AGENT_NAME, apiBaseUrl, skillgateFlags } from '../config';

export { normalizeOpenApiPaths };

export function skillgateInvokeOptions(): SkillgateOptions['invoke'] {
  const flags = skillgateFlags();
  return {
    baseUrl: apiBaseUrl(),
    headers: {
      Authorization: 'Bearer ${API_TOKEN}',
      'X-Meridian-Agent': 'api-concierge',
    },
    ssrfProtection: flags.ssrfProtection,
  };
}

export function skillgateClassifyOptions(): SkillgateOptions['classify'] {
  const flags = skillgateFlags();
  return {
    writeRequiresApproval: true,
    allowDestructive: flags.allowDestructive,
    allowAdmin: flags.allowAdmin,
  };
}

/** Shared production-safe defaults for both paths. */
export function baseSkillgateOptions(partial: SkillgateOptions = {}): SkillgateOptions {
  return defaultSkillgateOptions({
    agentName: AGENT_NAME,
    warnAbove: 12,
    maxTools: 24,
    strictDescriptions: true,
    ...partial,
    include: {
      mode: 'opt-in',
      tags: ['agent', 'skillgate'],
      deny: [/\/internal\//i],
      ...partial.include,
    },
    classify: { ...skillgateClassifyOptions(), ...partial.classify },
    invoke: { ...skillgateInvokeOptions(), ...partial.invoke },
  });
}

const commerceSwagger = () => ({
  title: 'Meridian Commerce Ops API',
  description: 'First-party REST surface curated into agent skills by Skillgate',
  version: '1.0.0',
  servers: [{ url: apiBaseUrl() }],
  autoGenerateOperations: true,
});

/** Build OpenAPI from CommerceApiModule with @AgentSkill enrichment + path normalize. */
export function buildCommerceOpenApi(): OpenApiLike {
  const spec = createOpenApiDocument(CommerceApiModule, commerceSwagger()) as OpenApiLike;
  enrichSpecWithAgentSkills(spec, collectControllersFromModule(CommerceApiModule));
  return normalizeOpenApiPaths(spec);
}

/**
 * Path B — Skillgate.fromModule (swagger + enrich + normalize inside the package).
 */
export function buildGateFromModule(partial: SkillgateOptions = {}): Skillgate {
  return Skillgate.fromModule(CommerceApiModule, {
    ...baseSkillgateOptions(partial),
    swagger: commerceSwagger(),
  });
}

/** Path A — hand-written / exported OpenAPI JSON. */
export function buildGateFromOpenApi(
  spec: OpenApiLike,
  partial: SkillgateOptions = {}
): Skillgate {
  return Skillgate.fromOpenApi(normalizeOpenApiPaths(structuredClone(spec)), baseSkillgateOptions(partial));
}
