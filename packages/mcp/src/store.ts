import { EventEmitter } from 'node:events';
import type { Session, PinmarkAnnotation } from '@pinmark/core';
import { sseManager } from './sse.js';

export class Store extends EventEmitter {
  private sessions: Map<string, Session> = new Map();
  createSession(url: string, sessionId?: string): Session {
    const id = sessionId || Math.random().toString(36).substring(2, 9);
    // Return existing session to avoid losing annotations
    const existing = this.sessions.get(id);
    if (existing) return existing;
    const session: Session = {
      id,
      url,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      annotations: []
    };
    this.sessions.set(id, session);
    return session;
  }

  getSession(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  getAllSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  async addAnnotation(sessionId: string, annotation: PinmarkAnnotation): Promise<PinmarkAnnotation> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    // Set defaults if not provided
    annotation.status = annotation.status || 'pending';
    
    session.annotations.push(annotation);
    session.updatedAt = Date.now();
    
    // Broadcast via SSE and emit internal event
    try {
      sseManager.notifyAnnotationUpdate(annotation);
    } catch(e) {}
    
    this.emit('annotation_added', { sessionId, annotation });
    return annotation;
  }

  getAnnotation(annotationId: string): PinmarkAnnotation | undefined {
    for (const session of this.sessions.values()) {
      const annotation = session.annotations.find(a => a.id === annotationId);
      if (annotation) return annotation;
    }
    return undefined;
  }

  async updateAnnotationStatus(annotationId: string, status: PinmarkAnnotation['status'], agent?: string, reason?: string): Promise<PinmarkAnnotation | undefined> {
    const annotation = this.getAnnotation(annotationId);
    if (!annotation) return undefined;

    annotation.status = status;
    if (status === 'resolved') {
      annotation.resolvedBy = agent;
      annotation.resolvedAt = Date.now();
    } else if (status === 'dismissed') {
      annotation.dismissReason = reason;
    }

    // Update session updatedAt
    for (const session of this.sessions.values()) {
      if (session.annotations.some(a => a.id === annotationId)) {
        session.updatedAt = Date.now();
      }
    }

    try {
      sseManager.notifyAnnotationUpdate(annotation);
    } catch(e) {}

    return annotation;
  }

  async addReply(annotationId: string, author: string, message: string, role: 'human' | 'agent' = 'agent'): Promise<PinmarkAnnotation | undefined> {
    const annotation = this.getAnnotation(annotationId);
    if (!annotation) return undefined;

    if (!annotation.replies) {
      annotation.replies = [];
    }

    annotation.replies.push({
      id: crypto.randomUUID(),
      author: role,
      message: `[${author}] ${message}`,
      timestamp: Date.now()
    });

    // Update session updatedAt
    for (const session of this.sessions.values()) {
      if (session.annotations.some(a => a.id === annotationId)) {
        session.updatedAt = Date.now();
      }
    }

    try {
      sseManager.notifyAnnotationUpdate(annotation);
    } catch(e) {}

    return annotation;
  }

  getPendingAnnotations(sessionId?: string): PinmarkAnnotation[] {
    const pending: PinmarkAnnotation[] = [];
    const sessionsToCheck = sessionId 
      ? [this.sessions.get(sessionId)].filter(Boolean) as Session[] 
      : this.getAllSessions();

    for (const session of sessionsToCheck) {
      pending.push(...session.annotations.filter(a => a.status === 'pending' || a.status === 'acknowledged'));
    }
    return pending;
  }

  async waitForAnnotations(options: {
    sessionId?: string;
    batchWindowSeconds?: number;
    timeoutSeconds?: number;
    sinceTimestamp?: number;
  } = {}): Promise<{ count: number; annotations: PinmarkAnnotation[]; timedOut: boolean }> {
    const batchWindowMs = Math.min(Math.max(options.batchWindowSeconds ?? 10, 1), 60) * 1000;
    const timeoutMs = Math.min(Math.max(options.timeoutSeconds ?? 120, 5), 600) * 1000;
    const startTime = options.sinceTimestamp ?? (Date.now() - 5000);

    // Check if there are already pending annotations added recently or pending
    const existing = this.getPendingAnnotations(options.sessionId).filter(
      a => (a.timestamp || 0) >= startTime || a.status === 'pending'
    );
    if (existing.length > 0) {
      return { count: existing.length, annotations: existing, timedOut: false };
    }

    let resolve!: (value: { count: number; annotations: PinmarkAnnotation[]; timedOut: boolean }) => void;
    const promise = new Promise<{ count: number; annotations: PinmarkAnnotation[]; timedOut: boolean }>((res) => {
      resolve = res;
    });
    const collected: PinmarkAnnotation[] = [];
    let batchTimer: NodeJS.Timeout | undefined;
    let overallTimer: NodeJS.Timeout | undefined;

    const finish = (timedOut: boolean) => {
      clearTimeout(batchTimer);
      clearTimeout(overallTimer);
      this.off('annotation_added', onAnnotation);
      resolve({
        count: collected.length,
        annotations: collected,
        timedOut,
      });
    };

    const onAnnotation = (data: { sessionId: string; annotation: PinmarkAnnotation }) => {
      if (options.sessionId && data.sessionId !== options.sessionId) {
        return;
      }
      if (!collected.some(a => a.id === data.annotation.id)) {
        collected.push(data.annotation);
      }

      // Reset or start batch timer
      clearTimeout(batchTimer);
      batchTimer = setTimeout(() => {
        finish(false);
      }, batchWindowMs);
    };

    this.on('annotation_added', onAnnotation);

    overallTimer = setTimeout(() => {
      finish(collected.length === 0);
    }, timeoutMs);

    return promise;
  }
}

export const store = new Store();
