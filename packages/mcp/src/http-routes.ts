import express, { Request, Response } from 'express';
import cors from 'cors';
import { store } from './store.js';
import { sseManager } from './sse.js';

export function createHttpServer() {
  const app = express();
  
  app.use(cors());
  app.use(express.json());

  app.get('/events', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    sseManager.addClient(res);
  });

  app.get('/sessions', (_req: Request, res: Response) => {
    res.json(store.getAllSessions());
  });

  app.post('/sessions', (req: Request, res: Response) => {
    const { url, sessionId } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    const session = store.createSession(url, sessionId);
    res.json(session);
  });

  app.get('/sessions/:id', (req: Request, res: Response) => {
    const session = store.getSession(req.params.id as string);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json(session);
  });

  app.post('/sessions/:id/annotations', async (req: Request, res: Response) => {
    try {
      const annotation = await store.addAnnotation(req.params.id as string, req.body);
      res.json(annotation);
    } catch (e) {
      res.status(404).json({ error: (e as Error).message });
    }
  });

  app.get('/annotations/pending', (_req: Request, res: Response) => {
    res.json(store.getPendingAnnotations());
  });

  app.patch('/annotations/:id/status', async (req: Request, res: Response) => {
    const { status, agent, reason } = req.body;
    const annotation = await store.updateAnnotationStatus(req.params.id as string, status, agent, reason);
    if (!annotation) {
      return res.status(404).json({ error: 'Annotation not found' });
    }
    res.json(annotation);
  });

  app.post('/annotations/:id/reply', async (req: Request, res: Response) => {
    const { agent, message, role } = req.body;
    if (!agent || !message) {
      return res.status(400).json({ error: 'agent and message are required' });
    }
    const annotation = await store.addReply(req.params.id as string, agent, message, role === 'human' ? 'human' : 'agent');
    if (!annotation) {
      return res.status(404).json({ error: 'Annotation not found' });
    }
    res.json(annotation);
  });

  return app;
}
