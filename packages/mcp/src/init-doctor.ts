import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';

interface AgentConfigTarget {
  name: string;
  category: 'desktop' | 'cli' | 'ide';
  getPath: () => string;
  configKey?: string;
}

function getAppDataDir(): string {
  if (process.platform === 'win32') {
    return process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support');
  }
  return path.join(os.homedir(), '.config');
}

const AGENT_TARGETS: AgentConfigTarget[] = [
  {
    name: 'Claude Desktop',
    category: 'desktop',
    getPath: () => {
      if (process.platform === 'darwin') {
        return path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
      }
      if (process.platform === 'win32') {
        return path.join(getAppDataDir(), 'Claude', 'claude_desktop_config.json');
      }
      return path.join(os.homedir(), '.config', 'Claude', 'claude_desktop_config.json');
    },
  },
  {
    name: 'Claude Code',
    category: 'cli',
    getPath: () => path.join(os.homedir(), '.claude.json'),
  },
  {
    name: 'Cursor (Global)',
    category: 'ide',
    getPath: () => path.join(os.homedir(), '.cursor', 'mcp.json'),
  },
  {
    name: 'Cursor (Project Workspace)',
    category: 'ide',
    getPath: () => path.join(process.cwd(), '.cursor', 'mcp.json'),
  },
  {
    name: 'Windsurf',
    category: 'ide',
    getPath: () => path.join(os.homedir(), '.codeium', 'windsurf', 'mcp_config.json'),
  },
  {
    name: 'VS Code Roo Code',
    category: 'ide',
    getPath: () => {
      if (process.platform === 'win32') {
        return path.join(getAppDataDir(), 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline', 'settings', 'cline_mcp_settings.json');
      }
      if (process.platform === 'darwin') {
        return path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline', 'settings', 'cline_mcp_settings.json');
      }
      return path.join(os.homedir(), '.config', 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline', 'settings', 'cline_mcp_settings.json');
    },
  },
  {
    name: 'VS Code Cline',
    category: 'ide',
    getPath: () => {
      if (process.platform === 'win32') {
        return path.join(getAppDataDir(), 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json');
      }
      if (process.platform === 'darwin') {
        return path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json');
      }
      return path.join(os.homedir(), '.config', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json');
    },
  },
  {
    name: 'Project Local MCP (mcp.json)',
    category: 'ide',
    getPath: () => path.join(process.cwd(), '.mcp.json'),
  },
];

export async function runInit(): Promise<void> {
  console.log('\n🚀 \x1b[1m\x1b[35mPinmark AI Agent Setup Wizard\x1b[0m');
  console.log('Detecting installed AI agents and configuring MCP servers...\n');

  let configuredCount = 0;

  for (const target of AGENT_TARGETS) {
    const configPath = target.getPath();
    const configDir = path.dirname(configPath);

    const dirExists = fs.existsSync(configDir);
    const fileExists = fs.existsSync(configPath);

    if (dirExists || fileExists || target.name.includes('Project')) {
      try {
        if (!dirExists) {
          fs.mkdirSync(configDir, { recursive: true });
        }

        let configData: Record<string, unknown> = {};
        if (fileExists) {
          try {
            const raw = fs.readFileSync(configPath, 'utf8');
            configData = JSON.parse(raw) as Record<string, unknown>;
          } catch {
            configData = {};
          }
        }

        const mcpServers = (configData.mcpServers && typeof configData.mcpServers === 'object')
          ? (configData.mcpServers as Record<string, unknown>)
          : {};

        mcpServers.pinmark = {
          command: 'npx',
          args: ['-y', '@pinmark/mcp', 'server'],
        };
        configData.mcpServers = mcpServers;

        fs.writeFileSync(configPath, JSON.stringify(configData, null, 2) + '\n', 'utf8');
        console.log(`  \x1b[32m✓\x1b[0m Configured \x1b[1m${target.name}\x1b[0m → ${configPath}`);
        configuredCount++;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.log(`  \x1b[31m✗\x1b[0m Failed to configure ${target.name}: ${message}`);
      }
    }
  }

  if (configuredCount === 0) {
    try {
      const cursorDir = path.join(process.cwd(), '.cursor');
      if (!fs.existsSync(cursorDir)) fs.mkdirSync(cursorDir, { recursive: true });
      const cursorPath = path.join(cursorDir, 'mcp.json');
      fs.writeFileSync(cursorPath, JSON.stringify({
        mcpServers: {
          pinmark: {
            command: 'npx',
            args: ['-y', '@pinmark/mcp', 'server'],
          },
        },
      }, null, 2) + '\n', 'utf8');
      console.log(`  \x1b[32m✓\x1b[0m Created Workspace MCP config → ${cursorPath}`);
      configuredCount++;
    } catch {}
  }

  console.log(`\n🎉 \x1b[32mSuccessfully configured ${configuredCount} agent target(s)!\x1b[0m`);
  console.log('To verify connectivity, run: \x1b[36mnpx @pinmark/mcp doctor\x1b[0m\n');
}

export async function runDoctor(port: number = 4747): Promise<void> {
  console.log('\n🩺 \x1b[1m\x1b[35mPinmark Health & Diagnostics (Doctor)\x1b[0m\n');

  // 1. Environment Checks
  console.log('\x1b[1m[1/3] Environment & Runtime\x1b[0m');
  const nodeVer = process.version;
  const majorNode = parseInt(nodeVer.replace('v', '').split('.')[0], 10);
  if (majorNode >= 18) {
    console.log(`  \x1b[32m✓\x1b[0m Node.js: ${nodeVer} (Supported)`);
  } else {
    console.log(`  \x1b[31m✗\x1b[0m Node.js: ${nodeVer} (Node 18+ required)`);
  }
  console.log(`  \x1b[32m✓\x1b[0m OS: ${process.platform} (${os.arch()})`);

  // 2. AI Agent MCP Config Checks
  console.log('\n\x1b[1m[2/3] Agent Configurations\x1b[0m');
  let foundAny = false;
  for (const target of AGENT_TARGETS) {
    const p = target.getPath();
    if (fs.existsSync(p)) {
      try {
        const content = JSON.parse(fs.readFileSync(p, 'utf8')) as Record<string, unknown>;
        const servers = content.mcpServers as Record<string, unknown> | undefined;
        if (servers && 'pinmark' in servers) {
          console.log(`  \x1b[32m✓\x1b[0m ${target.name}: Pinmark server registered (${p})`);
          foundAny = true;
        } else {
          console.log(`  \x1b[33m!\x1b[0m ${target.name}: Config found, but pinmark not added yet`);
        }
      } catch {
        console.log(`  \x1b[31m✗\x1b[0m ${target.name}: Invalid JSON file (${p})`);
      }
    }
  }

  if (!foundAny) {
    console.log('  \x1b[33m!\x1b[0m No configured agents detected. Run \x1b[36mnpx @pinmark/mcp init\x1b[0m to configure.');
  }

  // 3. Port & HTTP Server Check
  console.log('\n\x1b[1m[3/3] Pinmark Bridge Server Status\x1b[0m');
  const isServerRunning = await checkHttpServer(port);
  if (isServerRunning) {
    console.log(`  \x1b[32m✓\x1b[0m Pinmark HTTP Bridge is active on port \x1b[36mhttp://localhost:${port}\x1b[0m`);
    console.log(`  \x1b[32m✓\x1b[0m SSE stream ready at \x1b[36mhttp://localhost:${port}/events\x1b[0m`);
  } else {
    console.log(`  \x1b[33m!\x1b[0m Pinmark HTTP Bridge is not currently running on port ${port}.`);
    console.log(`    (It will auto-start when your agent launches the MCP server, or you can run: \x1b[36mnpx @pinmark/mcp server\x1b[0m)`);
  }

  console.log('\n✨ \x1b[1mDiagnostics complete!\x1b[0m\n');
}

function checkHttpServer(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/api/sessions`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => {
      resolve(false);
    });
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}
