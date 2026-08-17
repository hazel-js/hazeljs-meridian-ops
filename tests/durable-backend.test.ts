import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createMeridianDurableStore, meridianDurableBackend } from '../src/durable/create-meridian-durable';

describe('Meridian durable backend', () => {
  const prevBackend = process.env.AGENT_OS_DURABLE_BACKEND;
  const prevDir = process.env.AGENT_OS_DURABLE_DIR;

  afterEach(() => {
    if (prevBackend === undefined) delete process.env.AGENT_OS_DURABLE_BACKEND;
    else process.env.AGENT_OS_DURABLE_BACKEND = prevBackend;
    if (prevDir === undefined) delete process.env.AGENT_OS_DURABLE_DIR;
    else process.env.AGENT_OS_DURABLE_DIR = prevDir;
  });

  it('defaults to file', () => {
    delete process.env.AGENT_OS_DURABLE_BACKEND;
    expect(meridianDurableBackend()).toBe('file');
  });

  it('creates file durable store under AGENT_OS_DURABLE_DIR', async () => {
    process.env.AGENT_OS_DURABLE_BACKEND = 'file';
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'meridian-durable-'));
    process.env.AGENT_OS_DURABLE_DIR = dir;
    const store = createMeridianDurableStore();
    expect(store.backend).toBe('file');
    const run = await store.runRepository.create({
      id: 'run-test-1',
      agentName: 'support-desk',
      input: { message: 'ping' },
    });
    expect(run.id).toBe('run-test-1');
    expect(run.agentName).toBe('support-desk');
  });
});
