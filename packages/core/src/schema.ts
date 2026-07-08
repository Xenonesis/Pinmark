import { z } from 'zod';

export const ComponentInfoSchema = z.object({
  framework: z.enum(['react', 'angular', 'vue', 'svelte', 'unknown']),
  name: z.string(),
  props: z.record(z.string(), z.unknown()).optional(),
  filePath: z.string().optional(),
  lineNumber: z.number().optional(),
  hierarchy: z.array(z.string()).optional()
});

export const ElementInfoSchema = z.object({
  selector: z.string(),
  tagName: z.string(),
  id: z.string().optional(),
  classes: z.array(z.string()),
  textContent: z.string().optional(),
  dataAttributes: z.record(z.string(), z.string()),
  component: ComponentInfoSchema.optional(),
  boundingRect: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
    top: z.number(),
    right: z.number(),
    bottom: z.number(),
    left: z.number()
  }),
  computedStyles: z.record(z.string(), z.string()).optional(),
  accessibility: z.record(z.string(), z.string()).optional(),
  selectionText: z.string().optional(),
  screenshot: z.string().optional()
});

export const ThreadReplySchema = z.object({
  id: z.string(),
  author: z.enum(['human', 'agent']),
  message: z.string(),
  timestamp: z.number()
});

export const PinmarkAnnotationSchema = z.object({
  id: z.string(),
  index: z.number(),
  comment: z.string(),
  url: z.string(),
  timestamp: z.number(),
  element: ElementInfoSchema,
  
  // Advanced Diagnostics
  consoleLogs: z.array(z.any()).optional(),
  networkRequests: z.array(z.any()).optional(),
  sessionRecording: z.array(z.any()).optional(),
  areaRect: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number()
  }).optional(),
  
  // State Capture
  state: z.object({
    localStorage: z.record(z.string(), z.string()).optional(),
    sessionStorage: z.record(z.string(), z.string()).optional(),
    cookies: z.string().optional()
  }).optional(),

  // Classification
  category: z.enum(['bug', 'improvement', 'question', 'design']).optional(),
  intent: z.enum(['fix', 'change', 'question', 'approve']).optional(),
  severity: z.enum(['blocking', 'important', 'suggestion']).optional(),
  kind: z.enum(['feedback', 'placement', 'rearrange']).optional(),
  markerType: z.enum(['single', 'multi', 'area']).optional(),

  // Status (managed by server)
  status: z.enum(['pending', 'acknowledged', 'resolved', 'dismissed']).optional(),
  resolvedBy: z.string().optional(),
  resolvedAt: z.number().optional(),
  dismissReason: z.string().optional(),

  // Threading
  replies: z.array(ThreadReplySchema).optional()
});

export type PinmarkAnnotation = z.infer<typeof PinmarkAnnotationSchema>;
export type ElementInfo = z.infer<typeof ElementInfoSchema>;
export type ComponentInfo = z.infer<typeof ComponentInfoSchema>;
export type ThreadReply = z.infer<typeof ThreadReplySchema>;

export const SessionSchema = z.object({
  id: z.string(),
  url: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  annotations: z.array(PinmarkAnnotationSchema)
});

export type Session = z.infer<typeof SessionSchema>;
