import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function main() {
  const transport = new StdioClientTransport({
    command: "node",
    args: ["packages/mcp/dist/cli.js", "server"]
  });

  const client = new Client(
    { name: "test-client", version: "1.0.0" },
    { capabilities: {} }
  );

  await client.connect(transport);
  
  // Wait a bit for HTTP server to start
  await new Promise(r => setTimeout(r, 1000));
  
  // 1. Create a session via HTTP
  const sessionRes = await fetch("http://127.0.0.1:4747/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: "file:///test-page.html", sessionId: "test-session" })
  });
  
  if (!sessionRes.ok) {
    console.error("Session fail", await sessionRes.text());
    process.exit(1);
  }
  
  // 2. Add an annotation
  const annotation = {
    id: "ann-123",
    index: 1,
    comment: "Button is missing padding",
    url: "file:///test-page.html",
    timestamp: Date.now(),
    element: {
      selector: "button#test-button",
      tagName: "BUTTON",
      classes: [],
      dataAttributes: {},
      boundingRect: { x: 10, y: 10, width: 100, height: 40, top: 10, left: 10, right: 110, bottom: 50 }
    },
    sessionReplayEvents: [
      { type: 1, data: {}, timestamp: Date.now() - 5000 },
      { type: 2, data: {}, timestamp: Date.now() - 4000 }
    ]
  };
  
  const annRes = await fetch("http://127.0.0.1:4747/sessions/test-session/annotations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(annotation)
  });
  
  if (!annRes.ok) {
    console.error("Ann fail", await annRes.text());
    process.exit(1);
  }
  
  console.log("Annotation created.");

  // Call pinmark_generate_test
  console.log("Calling pinmark_generate_test...");
  const testResult = await client.callTool({
    name: "pinmark_generate_test",
    arguments: {
      annotationId: "ann-123",
      framework: "playwright",
      outputDir: "generated-tests"
    }
  });
  console.log("Test generated:", JSON.stringify(testResult, null, 2));

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});