import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  createLocalPlatform,
  parsePlatformDocuments,
  parseDna,
  type AgentDna,
} from '@hazeljs/agent';
import { applyDnaOverlays, safeOverlayDna } from '../src/platform/dna-overlay';
import { createStandaloneAgentOsWithOverlay } from '../src/agents/agents.module';

describe('Meridian platform apply', () => {
  it('strips tools from safe overlay', () => {
    const dna = parseDna({
      format: 'hazeljs.agent.dna',
      version: '1.0.0',
      name: 'support-desk',
      systemPrompt: 'x',
      tools: [{ name: 'lookupOrder' }],
      exportedAt: new Date().toISOString(),
    } as AgentDna);
    expect(safeOverlayDna(dna).tools).toBeUndefined();
  });

  it('apply is ready and overlay picks up platform prompt', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'meridian-plat-'));
    const prev = {
      cwd: process.cwd(),
      overlay: process.env.AGENT_OS_DNA_OVERLAY,
      store: process.env.AGENT_OS_PLATFORM_STORE,
      file: process.env.AGENT_OS_DNA_OVERLAY_FILE,
    };
    try {
      process.chdir(tmp);
      process.env.AGENT_OS_DNA_OVERLAY = '1';
      delete process.env.AGENT_OS_DNA_OVERLAY_FILE;
      const storePath = path.join(tmp, '.hazel', 'platform', 'resources.json');
      process.env.AGENT_OS_PLATFORM_STORE = storePath;

      const prompt = `[platform-meridian-${Date.now()}] Use tools.`;
      const yaml = `
apiVersion: agent.hazeljs.dev/v1alpha1
kind: AgentDefinition
metadata:
  name: support-agent
spec:
  dna:
    format: hazeljs.agent.dna
    version: "2.0.0"
    name: support-desk
    systemPrompt: ${JSON.stringify(prompt)}
    tools:
      - name: lookupOrder
    exportedAt: "2026-08-07T00:00:00.000Z"
---
apiVersion: agent.hazeljs.dev/v1alpha1
kind: AgentDeployment
metadata:
  name: support
spec:
  definitionRef:
    name: support-agent
  runtimeClassName: local
`;
      const platform = createLocalPlatform({ storePath, projectRoot: tmp, events: false });
      for (const doc of parsePlatformDocuments(yaml)) {
        expect((await platform.reconciler.applyResource(doc)).ready).toBe(true);
      }

      // Minimal runtime without full Skillgate HTTP (API may be down)
      process.env.API_BASE_URL = 'http://127.0.0.1:9';
      const runtime = await createStandaloneAgentOsWithOverlay();
      const report = await applyDnaOverlays(runtime, tmp);
      expect(report.applied.some((a) => a.result.agentName === 'support-desk')).toBe(true);
      expect(runtime.getAgentMetadata('support-desk')?.systemPrompt).toBe(prompt);
    } finally {
      process.chdir(prev.cwd);
      if (prev.overlay === undefined) delete process.env.AGENT_OS_DNA_OVERLAY;
      else process.env.AGENT_OS_DNA_OVERLAY = prev.overlay;
      if (prev.store === undefined) delete process.env.AGENT_OS_PLATFORM_STORE;
      else process.env.AGENT_OS_PLATFORM_STORE = prev.store;
      if (prev.file === undefined) delete process.env.AGENT_OS_DNA_OVERLAY_FILE;
      else process.env.AGENT_OS_DNA_OVERLAY_FILE = prev.file;
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }, 60_000);
});
