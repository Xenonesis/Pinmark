import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { registerMcpTools } from "./src/mcp-tools.js";
import { store } from "./src/store.js";
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";

let toolsHandler: any = null;
const server = {
    setRequestHandler: (schema: any, handler: any) => {
        if (schema === CallToolRequestSchema) toolsHandler = handler;
    }
} as any;
registerMcpTools(server);
store.createSession("http://test", "test-session");
const fakeAnnotation = {
    id: "ann-123",
    index: 1,
    comment: "slow",
    url: "http://test",
    timestamp: Date.now(),
    element: { selector: "div", tagName: "div", classes: ["heavy-chart"], dataAttributes: {}, boundingRect: {x:0, y:0, width:1, height:1, top:0, left:0, bottom:0, right:0}, component: { name: "SalesChart", framework: "react" } },
    domMetrics: { totalNodes: 2300, elementDepth: 25 },
    memoryMetrics: { jsHeapSizeLimit: 2000 * 1024 * 1024, totalJSHeapSize: 300 * 1024 * 1024, usedJSHeapSize: 250 * 1024 * 1024 },
    networkRequests: [
        { name: "https://example.com/heavy-bundle.js", responseEnd: 150 },
        { url: "https://api.example.com/submit", method: "POST", status: 500, requestBody: { user: "abc", pin: 1 }, responseBody: "Internal Server Error: db timeout", timestamp: Date.now(), duration: 2300, isError: true }
    ],
    performanceMetrics: [
        { entryType: "longtask", duration: 520.5, startTime: 100.0 },
        { entryType: "event", name: "click", duration: 80, startTime: 110.0 },
        { entryType: "measure", name: "AppRender", duration: 400.0 }
    ],
    fpsMetrics: [
        { timestamp: Date.now(), fps: 60 },
        { timestamp: Date.now(), fps: 12 },
        { timestamp: Date.now(), fps: 15 }
    ],
    stateSnapshot: {
        detected: ["redux", "vuex", "zustand"],
        snapshot: { redux: { user: { id: 42, name: "Harness User" } }, vuex: { auth: { loggedIn: true } } }
    },
    a11yIssues: [
        { type: "contrast", severity: "error", message: "Text contrast 2.1:1 is below WCAG AA 4.5:1.", wcag: "1.4.3" },
        { type: "image-alt", severity: "error", message: "<img> has no alt attribute.", wcag: "1.1.1" }
    ],
    errorTrace: [
        {
            type: "error",
            name: "TypeError",
            message: "Cannot read properties of undefined (reading 'data')",
            location: "app.js:42:18",
            timestamp: Date.now() - 1200,
            stack: [
                { fn: "loadTable", file: "app.js", line: 42, col: 18 },
                { fn: "render", file: "app.js", line: 88, col: 5 }
            ]
        }
    ],
    networkRequests: [
        { url: "https://api.example.com/items", method: "GET", status: 500, isError: true, responseBody: "{\"error\":\"db timeout\"}", timestamp: Date.now() - 500 }
    ],
    triage: {
        category: "bug",
        intent: "fix",
        severity: "blocking",
        summary: "Auto-triage: bug (blocking) — 1 runtime error(s) captured (TypeError). Also: 1 failing request(s) (GET 500); 1 long task(s).",
        reasons: [
            "1 runtime error(s) captured (TypeError)",
            "1 failing request(s) (GET 500)",
            "1 long task(s) (180ms total blocking time)"
        ]
    }
};
// Add to store
const session = store.getSession("test-session");
session.annotations.push(fakeAnnotation);

// Regression: minimal element (no classes/component) + frame without `file` —
// used to crash pinmark_suggest_perf_fix (`el.classes.join`) and
// pinmark_trace_errors (`f.file.startsWith`).
session.annotations.push({
    id: "ann-min",
    index: 1,
    comment: "minimal element payload",
    url: "http://test",
    timestamp: Date.now(),
    element: { selector: "#login-btn", tagName: "button" },
    performanceMetrics: [{ entryType: "longtask", duration: 210, startTime: 10 }],
    errorTrace: [
        { type: "error", name: "TypeError", message: "x is undefined", location: "app.js:7:3", timestamp: Date.now() - 900,
          stack: [{ fn: "<anonymous>", line: 7 }, { fn: "boot", file: "vendor.js", line: 1, col: 1 }] }
    ]
});

async function test() {
    try {
        // Find the handler for CallToolRequestSchema
        const req = {
            method: "tools/call",
            params: {
                name: "pinmark_analyze_performance",
                arguments: { annotationId: "ann-123" }
            }
        };
        const result = await toolsHandler(req, {});
        console.log(result.content[0].text);
        console.log('\n--- Suggest Fix Tool ---');
        const req2 = {
            method: "tools/call",
            params: {
                name: "pinmark_suggest_perf_fix",
                arguments: { annotationId: "ann-123" }
            }
        };
        const result2 = await toolsHandler(req2, {});
        console.log(result2.content[0].text);
        console.log('\n--- State Snapshot Tool ---');
        const req3 = {
            method: "tools/call",
            params: {
                name: "pinmark_get_state_snapshot",
                arguments: { annotationId: "ann-123" }
            }
        };
        const result3 = await toolsHandler(req3, {});
        console.log(result3.content[0].text);
        console.log('\n--- A11y Audit Tool ---');
        const req4 = {
            method: "tools/call",
            params: {
                name: "pinmark_audit_a11y",
                arguments: { annotationId: "ann-123" }
            }
        };
        const result4 = await toolsHandler(req4, {});
        console.log(result4.content[0].text);
        console.log('\n--- Error Trace Tool ---');
        const req5 = {
            method: "tools/call",
            params: {
                name: "pinmark_trace_errors",
                arguments: { annotationId: "ann-123" }
            }
        };
        const result5 = await toolsHandler(req5, {});
        console.log(result5.content[0].text);
        console.log('\n--- Triage Tool ---');
        const req6 = {
            method: "tools/call",
            params: {
                name: "pinmark_triage",
                arguments: { annotationId: "ann-123" }
            }
        };
        const result6 = await toolsHandler(req6, {});
        console.log(result6.content[0].text);
        console.log('\n--- Regression: suggest + trace on minimal annotation (no classes/file) ---');
        const rMin1 = await toolsHandler({ method: "tools/call", params: { name: "pinmark_suggest_perf_fix", arguments: { annotationId: "ann-min" } } }, {});
        const hasClasses = rMin1.content[0].text.includes('with classes:');
        console.log('suggest minimal OK:', !rMin1.isError, '| has classes line:', hasClasses);
        const rMin2 = await toolsHandler({ method: "tools/call", params: { name: "pinmark_trace_errors", arguments: { annotationId: "ann-min" } } }, {});
        console.log('trace minimal OK:', !rMin2.isError, '| has hint:', rMin2.content[0].text.includes('Trace hint'));
    } catch (e) {
        console.error(e);
    }
}
test();
