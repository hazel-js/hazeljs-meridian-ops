import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import type { OpenApiLike } from '@hazeljs/skillgate';
import { ToolRegistry } from '@hazeljs/agent';
import {
  buildGateFromModule,
  buildGateFromOpenApi,
  buildCommerceOpenApi,
  normalizeOpenApiPaths,
} from '../src/skillgate/build-gate';

describe('Meridian Skillgate — Meridian Commerce', () => {
  it('fromModule path includes reads/writes and denies destructive/admin/health/catalog', () => {
    const gate = buildGateFromModule();
    const names = gate.list().map((s) => s.name);
    const denied = gate.report().denied.map((s) => s.name);

    expect(names).toEqual(
      expect.arrayContaining([
        'listOrders',
        'getOrder',
        'getShipment',
        'createTicket',
        'listRefunds',
        'createRefund',
        'listTickets',
      ])
    );
    expect(names).not.toContain('deleteOrder');
    expect(names).not.toContain('listAdminUsers');
    expect(names).not.toContain('healthCheck');
    expect(names).not.toContain('listCatalog');

    expect(denied).toEqual(
      expect.arrayContaining(['deleteOrder', 'listAdminUsers', 'healthCheck'])
    );

    const createRefund = gate.list().find((s) => s.name === 'createRefund')!;
    expect(createRefund.requiresApproval).toBe(true);
    expect(createRefund.class).toBe('write');

    const getOrder = gate.list().find((s) => s.name === 'getOrder')!;
    expect(getOrder.readOnly).toBe(true);
    expect(getOrder.path).toContain('{id}');
  });

  it('fromOpenApi path matches curated openapi file', () => {
    const specPath = path.join(__dirname, '../openapi/meridian-commerce.openapi.json');
    const spec = JSON.parse(fs.readFileSync(specPath, 'utf8')) as OpenApiLike;
    const gate = buildGateFromOpenApi(spec);
    expect(gate.list().map((s) => s.name)).toContain('getOrder');
    expect(gate.report().denied.some((d) => d.name === 'deleteOrder')).toBe(true);
  });

  it('registers tools on a ToolRegistry', () => {
    const gate = buildGateFromModule();
    const registry = new ToolRegistry();
    const count = gate.register(registry, 'api-concierge');
    expect(count).toBe(gate.list().length);
    const tools = registry.getAgentTools('api-concierge');
    expect(tools.some((t) => t.name === 'getOrder' && t.metadata?.skillgate)).toBe(true);
    expect(tools.find((t) => t.name === 'createRefund')?.requiresApproval).toBe(true);
  });

  it('normalizes Express :id paths to OpenAPI {id}', () => {
    const spec = buildCommerceOpenApi();
    const paths = Object.keys(spec.paths ?? {});
    expect(paths.some((p) => p.includes('{id}'))).toBe(true);
    expect(paths.some((p) => /:id\b/.test(p))).toBe(false);

    const again = normalizeOpenApiPaths({
      paths: { '/orders/:id': { get: { summary: 'x', tags: ['agent'] } } },
    });
    expect(Object.keys(again.paths!)[0]).toBe('/orders/{id}');
  });

  it('allowDestructive + allowAdmin opts destructive/admin skills back in', () => {
    const gate = buildGateFromModule({
      classify: { allowDestructive: true, allowAdmin: true },
    });
    const names = gate.list().map((s) => s.name);
    expect(names).toContain('deleteOrder');
    expect(names).toContain('listAdminUsers');
    expect(names).toContain('healthCheck');
  });
});
