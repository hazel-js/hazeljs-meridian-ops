/**
 * Build a Skillgate from the live Hazel module (Path B — fromModule)
 * or from a hand-written OpenAPI document (Path A — fromOpenApi).
 */

import {
  Skillgate,
  defaultSkillgateOptions,
  enrichSpecWithAgentSkills,
  type OpenApiLike,
  type SkillgateOptions,
} from '@hazeljs/skillgate';
import { collectControllersFromModule } from '@hazeljs/core';
import { createOpenApiDocument } from '@hazeljs/swagger';
import { CommerceApiModule } from '../api/commerce-api.module';
import { AGENT_NAME, apiBaseUrl, skillgateFlags } from '../config';

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

/**
 * Hazel swagger keeps Express-style `:id` paths; createSkillInvoker expects OpenAPI `{id}`.
 */
export function normalizeOpenApiPaths(spec: OpenApiLike): OpenApiLike {
  const paths = spec.paths ?? {};
  const next: NonNullable<OpenApiLike['paths']> = {};
  for (const [path, item] of Object.entries(paths)) {
    const openApiPath = path.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, '{$1}');
    next[openApiPath] = item;
  }
  spec.paths = next;
  return spec;
}

/** Build OpenAPI from CommerceApiModule with @AgentSkill enrichment + path normalize. */
export function buildCommerceOpenApi(): OpenApiLike {
  const spec = createOpenApiDocument(CommerceApiModule, {
    title: 'Meridian Commerce Ops API',
    description: 'First-party REST surface curated into agent skills by Skillgate',
    version: '1.0.0',
    servers: [{ url: apiBaseUrl() }],
    autoGenerateOperations: true,
  }) as OpenApiLike;

  const controllers = collectControllersFromModule(CommerceApiModule);
  enrichSpecWithAgentSkills(spec, controllers);
  return normalizeOpenApiPaths(spec);
}

/**
 * Path B — controllers + @AgentSkill → OpenAPI → governed skills.
 * Uses the same pipeline as Skillgate.fromModule, plus Express→OpenAPI path normalize.
 */
export function buildGateFromModule(partial: SkillgateOptions = {}): Skillgate {
  return Skillgate.fromOpenApi(buildCommerceOpenApi(), baseSkillgateOptions(partial));
}

/** Path A — hand-written / exported OpenAPI JSON. */
export function buildGateFromOpenApi(
  spec: OpenApiLike,
  partial: SkillgateOptions = {}
): Skillgate {
  return Skillgate.fromOpenApi(normalizeOpenApiPaths(structuredClone(spec)), baseSkillgateOptions(partial));
}
