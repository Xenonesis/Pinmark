import type { Session, PinmarkAnnotation } from '@pinmark/core';

export class Store {
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
    
    // Broadcast via SSE
    try {
      const { sseManager } = await import('./sse.js');
      sseManager.notifyAnnotationUpdate(annotation);
    } catch(e) {}
    
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
      const { sseManager } = await import('./sse.js');
      sseManager.notifyAnnotationUpdate(annotation);
    } catch(e) {}

    return annotation;
  }

  async addReply(annotationId: string, author: string, message: string): Promise<PinmarkAnnotation | undefined> {
    const annotation = this.getAnnotation(annotationId);
    if (!annotation) return undefined;

    if (!annotation.replies) {
      annotation.replies = [];
    }

    annotation.replies.push({
      id: Math.random().toString(36).substring(2, 15),
      author: 'agent',
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
      const { sseManager } = await import('./sse.js');
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
}

export const store = new Store();
