import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { store } from "./store.js";

export function registerMcpTools(server: Server) {
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "pinmark_list_sessions",
          description: "List all active annotation sessions.",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "pinmark_get_session",
          description: "Get a specific session with all its annotations.",
          inputSchema: {
            type: "object",
            properties: {
              sessionId: {
                type: "string",
                description: "The ID of the session to retrieve.",
              },
            },
            required: ["sessionId"],
          },
        },
        {
          name: "pinmark_get_pending",
          description: "Get pending (unacknowledged) annotations for a specific session.",
          inputSchema: {
            type: "object",
            properties: {
              sessionId: {
                type: "string",
                description: "The ID of the session to retrieve pending annotations for.",
              },
            },
            required: ["sessionId"],
          },
        },
        {
          name: "pinmark_get_all_pending",
          description: "Get pending annotations across ALL active sessions.",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "pinmark_acknowledge",
          description: "Mark an annotation as acknowledged, indicating you are looking into it.",
          inputSchema: {
            type: "object",
            properties: {
              annotationId: {
                type: "string",
                description: "The ID of the annotation to acknowledge.",
              },
            },
            required: ["annotationId"],
          },
        },
        {
          name: "pinmark_resolve",
          description: "Mark an annotation as resolved after fixing the issue.",
          inputSchema: {
            type: "object",
            properties: {
              annotationId: {
                type: "string",
                description: "The ID of the annotation to resolve.",
              },
              agentName: {
                type: "string",
                description: "Your name/identifier (e.g. 'Claude Code').",
              },
            },
            required: ["annotationId", "agentName"],
          },
        },
        {
          name: "pinmark_dismiss",
          description: "Dismiss an annotation if it cannot be fixed or is irrelevant.",
          inputSchema: {
            type: "object",
            properties: {
              annotationId: {
                type: "string",
                description: "The ID of the annotation to dismiss.",
              },
              reason: {
                type: "string",
                description: "The reason for dismissing the annotation.",
              },
            },
            required: ["annotationId", "reason"],
          },
        },
        {
          name: "pinmark_highlight_element",
          description: "Highlight a specific DOM element on the user's active screen. Useful for clarifying which element an AI agent is referring to.",
          inputSchema: {
            type: "object",
            properties: {
              selector: {
                type: "string",
                description: "The CSS selector of the element to highlight.",
              },
              durationMs: {
                type: "number",
                description: "Optional. How long the highlight should flash (default 3000ms).",
              },
            },
            required: ["selector"],
          },
        },
        {
          name: "pinmark_generate_test",
          description: "Generate an automated test (Playwright/Cypress) for a specific bug report based on its recorded DOM state and session replay events.",
          inputSchema: {
            type: "object",
            properties: {
              annotationId: {
                type: "string",
                description: "The ID of the Pinmark annotation.",
              },
              framework: {
                type: "string",
                enum: ["playwright", "cypress"],
                description: "Test framework to use.",
              },
              outputDir: {
                type: "string",
                description: "Local directory to save the test file (e.g., 'tests/e2e').",
              },
            },
            required: ["annotationId", "framework", "outputDir"],
          },
        },
        {
          name: "pinmark_clone_website",
          description: "Clones a target website by capturing its raw HTML and a full rrweb DOM snapshot.",
          inputSchema: {
            type: "object",
            properties: {
              url: {
                type: "string",
                description: "The URL of the website to clone.",
              },
              outputDir: {
                type: "string",
                description: "Local directory to save the clone files.",
              },
            },
            required: ["url", "outputDir"],
          },
        },
        {
          name: "pinmark_ask_question",
          description: "Ask the user a clarifying question about an annotation. The question appears as a reply in the annotation thread.",
          inputSchema: {
            type: "object",
            properties: {
              annotationId: {
                type: "string",
                description: "The ID of the annotation to ask about.",
              },
              question: {
                type: "string",
                description: "The clarifying question to ask the user.",
              },
              agentName: {
                type: "string",
                description: "Your name/identifier (e.g. 'Claude Code').",
              },
            },
            required: ["annotationId", "question", "agentName"],
          },
        },
        {
          name: "pinmark_analyze_performance",
          description: "Analyzes the performance metrics (long tasks, layout shifts) captured when the pin was dropped.",
          inputSchema: {
            type: "object",
            properties: {
              annotationId: { type: "string" }
            },
            required: ["annotationId"]
          }
        }
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    switch (request.params.name) {
      case "pinmark_list_sessions": {
        const sessions = store.getAllSessions();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(sessions.map(s => ({
                id: s.id,
                url: s.url,
                annotationCount: s.annotations.length,
                updatedAt: new Date(s.updatedAt).toISOString()
              })), null, 2),
            },
          ],
        };
      }

      case "pinmark_get_session": {
        const sessionId = String(request.params.arguments?.sessionId);
        const session = store.getSession(sessionId);
        if (!session) {
          throw new McpError(ErrorCode.InvalidParams, `Session ${sessionId} not found`);
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(session, null, 2),
            },
          ],
        };
      }

      case "pinmark_get_pending": {
        const sessionId = String(request.params.arguments?.sessionId);
        const pending = store.getPendingAnnotations(sessionId);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(pending, null, 2),
            },
          ],
        };
      }

      case "pinmark_get_all_pending": {
        const pending = store.getPendingAnnotations();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(pending, null, 2),
            },
          ],
        };
      }

      case "pinmark_acknowledge": {
        const annotationId = String(request.params.arguments?.annotationId);
        const annotation = await store.updateAnnotationStatus(annotationId, 'acknowledged');
        if (!annotation) {
          throw new McpError(ErrorCode.InvalidParams, `Annotation ${annotationId} not found`);
        }
        return {
          content: [
            {
              type: "text",
              text: `Annotation ${annotationId} marked as acknowledged.`,
            },
          ],
        };
      }

      case "pinmark_resolve": {
        const annotationId = String(request.params.arguments?.annotationId);
        const agentName = String(request.params.arguments?.agentName);
        const annotation = await store.updateAnnotationStatus(annotationId, 'resolved', agentName);
        if (!annotation) {
          throw new McpError(ErrorCode.InvalidParams, `Annotation ${annotationId} not found`);
        }
        return {
          content: [
            {
              type: "text",
              text: `Annotation ${annotationId} marked as resolved by ${agentName}.`,
            },
          ],
        };
      }

      case "pinmark_dismiss": {
        const annotationId = String(request.params.arguments?.annotationId);
        const reason = String(request.params.arguments?.reason);
        const annotation = await store.updateAnnotationStatus(annotationId, 'dismissed', undefined, reason);
        if (!annotation) {
          throw new McpError(ErrorCode.InvalidParams, `Annotation ${annotationId} not found`);
        }
        return {
          content: [
            {
              type: "text",
              text: `Annotation ${annotationId} dismissed. Reason: ${reason}`,
            },
          ],
        };
      }

      case "pinmark_highlight_element": {
        const selector = String(request.params.arguments?.selector);
        const durationMs = request.params.arguments?.durationMs !== undefined ? Number(request.params.arguments?.durationMs) : 3000;
        
        try {
          const { sseManager } = await import('./sse.js');
          sseManager.notifyHighlight(selector, durationMs);
        } catch(e) {}

        return {
          content: [
            {
              type: "text",
              text: `Highlight requested for selector "${selector}" for ${durationMs}ms.`,
            },
          ],
        };
      }

      case "pinmark_generate_test": {
        const annotationId = String(request.params.arguments?.annotationId);
        const framework = String(request.params.arguments?.framework);
        const outputDir = String(request.params.arguments?.outputDir);

        const annotation = store.getAnnotation(annotationId);
        if (!annotation) {
          throw new McpError(ErrorCode.InvalidParams, `Annotation not found: ${annotationId}`);
        }

        // Localized agent workflow to translate rrweb events + DOM into a test script
        // In this implementation, we write a structured template containing the bug details
        // and instructions for the agent to complete the test logic.
        const testContent = framework === 'playwright' 
          ? `import { test, expect } from '@playwright/test';\n\n// Generated from Pinmark Annotation: ${annotationId}\n// Comment: ${annotation.comment}\n// URL: ${annotation.url}\n\ntest('Reproduce bug: ${annotation.comment.replace(/'/g, "\\'")}', async ({ page }) => {\n  await page.goto('${annotation.url}');\n  \n  // Target element selector: ${annotation.element.selector}\n  // Component: ${annotation.element.component?.name || 'Unknown'}\n  \n  // TODO: Agent workflow should inject rrweb event sequence here\n  // sessionReplayEvents count: ${annotation.sessionReplayEvents?.length || 0}\n  \n  // Ensure element is visible before interacting\n  await expect(page.locator('${annotation.element.selector}')).toBeVisible();\n});\n`
          : `describe('Pinmark Auto-generated Test', () => {\n  it('Reproduces bug: ${annotation.comment.replace(/'/g, "\\'")}', () => {\n    cy.visit('${annotation.url}');\n    \n    // Generated from Pinmark Annotation: ${annotationId}\n    // Target element selector: ${annotation.element.selector}\n    // Component: ${annotation.element.component?.name || 'Unknown'}\n    // sessionReplayEvents count: ${annotation.sessionReplayEvents?.length || 0}\n    \n    // TODO: Agent workflow should inject rrweb event sequence here\n    \n    cy.get('${annotation.element.selector}').should('be.visible');\n  });\n});\n`;

        try {
          const fs = await import('fs/promises');
          const path = await import('path');
          
          await fs.mkdir(outputDir, { recursive: true });
          const safeComment = annotation.comment.replace(/[^a-z0-9]/gi, '-').toLowerCase().substring(0, 30);
          const ext = framework === 'playwright' ? 'spec.ts' : 'cy.ts';
          const filename = `pinmark-bug-${safeComment}-${annotationId.substring(0, 6)}.${ext}`;
          const fullPath = path.join(outputDir, filename);
          
          await fs.writeFile(fullPath, testContent, 'utf-8');
          
          return {
            content: [
              {
                type: "text",
                text: `Test case generated successfully at ${fullPath}`,
              },
            ],
          };
        } catch (e) {
          throw new McpError(ErrorCode.InternalError, `Failed to generate test: ${(e as Error).message}`);
        }
      }
      case "pinmark_clone_website": {
        const url = String(request.params.arguments?.url);
        const outputDir = String(request.params.arguments?.outputDir);
        
        try {
          const puppeteer = await import('puppeteer');
          const fs = await import('fs/promises');
          const path = await import('path');
          
          const browser = await puppeteer.default.launch();
          const page = await browser.newPage();
          await page.goto(url, { waitUntil: 'networkidle2' });
          // Inject local UMD bundle for rrweb-snapshot
          await page.addScriptTag({ path: path.resolve(process.cwd(), 'node_modules/rrweb-snapshot/dist/rrweb-snapshot.umd.min.cjs') });
          
          const snapshot = await page.evaluate(() => {
            // @ts-ignore - injected via script tag
            return window.rrwebSnapshot.snapshot(document);
          });
          
          // Capture raw HTML and inject a <base> tag to fix relative CSS/image links
          let html = await page.content();
          if (!html.includes('<base ')) {
            html = html.replace('<head>', `<head>\n<base href="${new URL(url).origin}">`);
          }
          
          // Capture MHTML (bundled HTML + CSS + Images in one file)
          const cdp = await page.target().createCDPSession();
          const { data: mhtml } = await cdp.send('Page.captureSnapshot', { format: 'mhtml' });
          
          await browser.close();
          
          await fs.mkdir(outputDir, { recursive: true });
          const safeName = url.replace(/[^a-z0-9]/gi, '_').toLowerCase();
          
          await fs.writeFile(path.join(outputDir, `${safeName}_snapshot.json`), JSON.stringify(snapshot, null, 2));
          await fs.writeFile(path.join(outputDir, `${safeName}.html`), html);
          await fs.writeFile(path.join(outputDir, `${safeName}.mhtml`), mhtml);
          
          return {
            content: [
              {
                type: "text",
                text: `Successfully cloned ${url} into ${outputDir}.\nFiles created:\n- ${safeName}.html (Raw HTML with <base> tag)\n- ${safeName}.mhtml (Self-contained Web Archive with all CSS/images)\n- ${safeName}_snapshot.json (rrweb DOM snapshot)`,
              },
            ],
          };
        } catch (e) {
          throw new McpError(ErrorCode.InternalError, `Failed to clone website: ${(e as Error).message}`);
        }
      }


      case "pinmark_analyze_performance": {
        const annotationId = String(request.params.arguments?.annotationId);
        const annotation = store.getAnnotation(annotationId);
        if (!annotation) {
          throw new McpError(ErrorCode.InvalidParams, `Annotation ${annotationId} not found`);
        }

        const metrics = annotation.performanceMetrics || [];
        const fpsMetrics = annotation.fpsMetrics || [];
        const networkRequests = annotation.networkRequests || [];
        
        if (metrics.length === 0 && fpsMetrics.length === 0) {
          return {
            content: [{ type: "text", text: `No performance metrics captured for annotation ${annotationId}.` }]
          };
        }


        const longTasks = metrics.filter((m: any) => m.entryType === 'longtask');
        const layoutShifts = metrics.filter((m: any) => m.entryType === 'layout-shift');
        const lcps = metrics.filter((m: any) => m.entryType === 'largest-contentful-paint');
        const events = metrics.filter((m: any) => m.entryType === 'event' && m.duration > 50);
        const measures = metrics.filter((m: any) => m.entryType === 'measure');
        let tbt = 0;
        longTasks.forEach((m: any) => {
          if (m.duration > 50) tbt += (m.duration - 50);
        });

        let report = `## Performance Metrics for Annotation ${annotationId}\n\n`;
        report += `**Total Blocking Time (TBT):** ${tbt.toFixed(2)}ms\n\n`;
        if (fpsMetrics.length > 0) {
          const avgFps = fpsMetrics.reduce((sum: number, f: any) => sum + f.fps, 0) / fpsMetrics.length;
          const drops = fpsMetrics.filter((f: any) => f.fps < 30).length;
          report += `### Framerate (FPS)\n`;
          report += `- Average: ${avgFps.toFixed(1)} FPS\n`;
          if (drops > 0) report += `- **Severe drops detected** (<30 FPS): ${drops} seconds\n`;
          report += `\n`;
        }

        report += `### Long Tasks (${longTasks.length})\n`;
        longTasks.forEach((lt: any, i: number) => {
          report += `- Task ${i + 1}: ${lt.duration.toFixed(2)}ms (Start: ${lt.startTime.toFixed(2)}ms)\n`;
          const correlatedNet = networkRequests.filter((nr: any) => {
              const reqEnd = nr.responseEnd || (nr.startTime && nr.duration ? nr.startTime + nr.duration : null) || nr.timestamp;
              if (!reqEnd) return false;
              return reqEnd >= lt.startTime - 100 && reqEnd <= lt.startTime + lt.duration;
          });
          if (correlatedNet.length > 0) {
              report += `  - *Correlated Network Activity:* ${correlatedNet.map((n: any) => {
                  try { return new URL(n.name || n.url).pathname.split('/').pop() || (n.name || n.url); } catch(e) { return (n.name || n.url); }
              }).join(', ')}\n`;
          }
        });

        if (events.length > 0) {
          report += `\n### Slow Events (INP Potential)\n`;
          events.forEach((ev: any, i: number) => {
            report += `- Event ${i + 1}: '${ev.name || ev.type}' took ${ev.duration.toFixed(2)}ms\n`;
          });
        }

        if (measures.length > 0) {
          report += `\n### Component/User Timings\n`;
          measures.forEach((m: any) => {
            if (m.duration > 10) report += `- ${m.name}: ${m.duration.toFixed(2)}ms\n`;
          });
        }
        report += `\n### Layout Shifts (${layoutShifts.length})\n`;
        layoutShifts.forEach((ls: any, i: number) => {
          report += `- Shift ${i + 1}: score ${ls.value?.toFixed(4) || 0}\n`;
        });

        report += `\n### LCP (${lcps.length})\n`;
        lcps.forEach((lcp: any, i: number) => {
          report += `- Paint ${i + 1}: ${lcp.startTime.toFixed(2)}ms\n`;
        });

        return {
          content: [
            {
              type: "text",
              text: report,
            },
          ],
        };
      }

      case "pinmark_ask_question": {
        const annotationId = String(request.params.arguments?.annotationId);
        const question = String(request.params.arguments?.question);
        const agentName = String(request.params.arguments?.agentName);
        const annotation = await store.addReply(annotationId, agentName, question);
        if (!annotation) {
          throw new McpError(ErrorCode.InvalidParams, `Annotation ${annotationId} not found`);
        }
        return {
          content: [
            {
              type: "text",
              text: `Question added to annotation ${annotationId}: "${question}" (by ${agentName})`,
            },
          ],
        };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, "Unknown tool");
    }
  });
}
