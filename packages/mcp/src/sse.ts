import type { Response } from 'express';
import type { PinmarkAnnotation } from '@pinmark/core';

type Client = {
  id: string;
  res: Response;
};

class SseManager {
  private clients: Client[] = [];

  addClient(res: Response) {
    const id = Math.random().toString(36).substring(2, 9);
    this.clients.push({ id, res });
    
    // Remove client on close
    res.on('close', () => {
      this.clients = this.clients.filter(client => client.id !== id);
    });
  }

  broadcast(event: string, data: any) {
    this.clients.forEach(client => {
      client.res.write(`event: ${event}\n`);
      client.res.write(`data: ${JSON.stringify(data)}\n\n`);
    });
  }

  notifyAnnotationUpdate(annotation: PinmarkAnnotation) {
    this.broadcast('annotation:update', annotation);
  }

  notifyHighlight(selector: string, durationMs: number = 3000) {
    this.broadcast('pinmark:highlight', { selector, durationMs });
  }
}

export const sseManager = new SseManager();
