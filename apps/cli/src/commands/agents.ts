import type { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createGateway, handleError, printTable } from './shared.js';

interface AgentTemplate {
  id: string;
  label?: string;
  description?: string;
  model?: { provider?: string; name?: string; fallbacks?: string[] };
  instructions?: Record<string, string>;
  mcpServers?: Array<{ id: string; name: string; description: string; url: string }>;
}

const TEMPLATES_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../templates');

async function loadTemplate(nameOrPath: string): Promise<AgentTemplate> {
  const path = isAbsolute(nameOrPath) || nameOrPath.includes('/')
    ? nameOrPath
    : resolve(TEMPLATES_DIR, `${nameOrPath}.json`);
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw) as AgentTemplate;
}

type GatewayClient = ReturnType<typeof createGateway>;

async function applyTemplateToAgent(
  gateway: GatewayClient,
  agentId: string,
  tmpl: AgentTemplate,
): Promise<void> {
  // 1. Instructions
  if (tmpl.instructions) {
    for (const [key, content] of Object.entries(tmpl.instructions)) {
      await gateway.setInstruction(agentId, key, content);
      console.log(`  · instructions/${key} set`);
    }
  }

  // 2. Model — merge into existing config so we don't clobber other fields.
  if (tmpl.model) {
    try {
      const cfg = await gateway.getAgentConfig(agentId);
      const next = { ...cfg, model: { ...(cfg.model as object | undefined ?? {}), ...tmpl.model } };
      await gateway.putAgentConfig(agentId, next);
      console.log(`  · model set to ${tmpl.model.name ?? '(unspecified)'}`);
    } catch (err) {
      console.warn(`  · could not update model config: ${(err as Error).message}`);
    }
  }

  // 3. MCP servers — register each (idempotent upsert) and enable for this agent.
  if (tmpl.mcpServers && tmpl.mcpServers.length > 0) {
    for (const server of tmpl.mcpServers) {
      try {
        await gateway.registerMcpServer({
          id: server.id,
          name: server.name,
          description: server.description,
          url: server.url,
        });
      } catch (err) {
        // Ignore conflict (already registered); surface other errors.
        const msg = (err as Error).message ?? '';
        if (!/conflict|exists|409/i.test(msg)) {
          console.warn(`  · could not register MCP "${server.id}": ${msg}`);
          continue;
        }
      }
      try {
        await gateway.enableMcpServer(server.id, agentId);
        console.log(`  · mcp/${server.id} enabled`);
      } catch (err) {
        console.warn(`  · could not enable MCP "${server.id}": ${(err as Error).message}`);
      }
    }
    console.log('  · note: MCP servers using stdio:// URLs require a stdio-capable transport in your gateway. Edit URLs as needed.');
  }
}

export const registerAgentsCommand = (program: Command): void => {
  const agents = program
    .command('agents')
    .description('Manage agents');

  // --- list ---
  agents
    .command('list')
    .description('List all registered agents')
    .action(async () => {
      try {
        const gateway = createGateway();
        const list = await gateway.listAgents();

        if (list.length === 0) {
          console.log('No agents registered.');
          return;
        }

        printTable(
          list.map((a) => ({
            id: a.agentId,
            name: a.name ?? '',
            status: a.status,
            workspace: a.workspaceDir ?? '',
          })),
          [
            { key: 'id', label: 'ID' },
            { key: 'name', label: 'Name' },
            { key: 'status', label: 'Status', width: 10 },
            { key: 'workspace', label: 'Workspace' },
          ],
        );
      } catch (error) {
        handleError(error);
      }
    });

  // --- create ---
  agents
    .command('create <agentId>')
    .description('Create a new agent')
    .option('--name <name>', 'Display name for the agent')
    .option('--workspace-dir <path>', 'Custom workspace directory')
    .option('--owner <userId>', 'Owner user ID')
    .option('--sandbox <preset>', 'Sandbox preset to provision (defaults to gateway autoProvisionSandbox)')
    .option('--no-sandbox', 'Skip sandbox provisioning entirely')
    .option('--template <nameOrPath>', 'Apply a built-in template (e.g. "coder") or a path to a template JSON file after creation')
    .action(async (agentId: string, opts: {
      name?: string;
      workspaceDir?: string;
      owner?: string;
      sandbox?: string | false;
      template?: string;
    }) => {
      try {
        const gateway = createGateway();
        const sandboxField: { sandbox: string | null } | object =
          opts.sandbox === false
            ? { sandbox: null }
            : typeof opts.sandbox === 'string'
              ? { sandbox: opts.sandbox }
              : {};
        const result = await gateway.createAgent({
          agentId,
          ...(opts.name ? { name: opts.name } : {}),
          ...(opts.workspaceDir ? { workspaceDir: opts.workspaceDir } : {}),
          ...(opts.owner ? { ownerUserId: opts.owner } : {}),
          ...sandboxField,
        });
        console.log(`Agent created: ${result.agentId} (${result.status})`);

        if (opts.template) {
          const tmpl = await loadTemplate(opts.template);
          await applyTemplateToAgent(gateway, agentId, tmpl);
          console.log(`Template applied: ${tmpl.label ?? tmpl.id}`);
        }
      } catch (error) {
        handleError(error);
      }
    });

  // --- apply-template ---
  agents
    .command('apply-template <agentId> <nameOrPath>')
    .description('Apply a template to an existing agent (sets instructions, model, registers MCP servers)')
    .action(async (agentId: string, nameOrPath: string) => {
      try {
        const gateway = createGateway();
        const tmpl = await loadTemplate(nameOrPath);
        await applyTemplateToAgent(gateway, agentId, tmpl);
        console.log(`Template "${tmpl.label ?? tmpl.id}" applied to ${agentId}.`);
      } catch (error) {
        handleError(error);
      }
    });

  // --- start ---
  agents
    .command('start <agentId>')
    .description('Start a stopped agent')
    .action(async (agentId: string) => {
      try {
        const gateway = createGateway();
        const result = await gateway.manageAgent(agentId, 'start');
        console.log(`Agent ${result.agentId}: ${result.status}`);
      } catch (error) {
        handleError(error);
      }
    });

  // --- stop ---
  agents
    .command('stop <agentId>')
    .description('Stop a running agent')
    .action(async (agentId: string) => {
      try {
        const gateway = createGateway();
        const result = await gateway.manageAgent(agentId, 'stop');
        console.log(`Agent ${result.agentId}: ${result.status}`);
      } catch (error) {
        handleError(error);
      }
    });

  // --- restart ---
  agents
    .command('restart <agentId>')
    .description('Restart an agent')
    .action(async (agentId: string) => {
      try {
        const gateway = createGateway();
        const result = await gateway.manageAgent(agentId, 'restart');
        console.log(`Agent ${result.agentId}: ${result.status}`);
      } catch (error) {
        handleError(error);
      }
    });

  // --- delete ---
  agents
    .command('delete <agentId>')
    .description('Delete an agent and all its data (must be stopped first)')
    .action(async (agentId: string) => {
      try {
        const gateway = createGateway();

        const health = await gateway.agentHealth(agentId);
        if (health.status === 'running') {
          console.error(`Agent ${agentId} is still running. Stop it first with: hermit agents stop ${agentId}`);
          process.exit(1);
        }

        await gateway.deleteAgent(agentId);
        console.log(`Agent deleted: ${agentId}`);
      } catch (error) {
        handleError(error);
      }
    });
};
