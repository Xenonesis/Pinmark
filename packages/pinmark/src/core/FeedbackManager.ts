import type { PinmarkAnnotation as FeedbackItem } from '@pinmark/core';
import type { PinmarkSettings, PinmarkConfig } from './types.js';
import { MarkdownFormatter } from '../vanilla/MarkdownFormatter.js';

export class FeedbackManager {
  private config: PinmarkConfig;
  private feedbackItems: FeedbackItem[] = [];
  private formatter: MarkdownFormatter;

  constructor(config: PinmarkConfig, initialFeedback: FeedbackItem[] = []) {
    this.config = config;
    this.feedbackItems = initialFeedback;
    this.formatter = new MarkdownFormatter();
  }

  add(item: FeedbackItem): void {
    this.feedbackItems.push(item);
    this.persist();
    if (this.config.onSync) {
      this.config.onSync(item);
    }
  }

  remove(id: string): void {
    this.feedbackItems = this.feedbackItems.filter((item) => item.id !== id);
    this.reindex();
    this.persist();
  }

  update(id: string, updates: Partial<FeedbackItem>): void {
    const index = this.feedbackItems.findIndex((item) => item.id === id);
    if (index !== -1) {
      this.feedbackItems[index] = { ...this.feedbackItems[index], ...updates };
      this.persist();
    }
  }

  getAll(): FeedbackItem[] {
    return [...this.feedbackItems];
  }

  clearAll(): void {
    this.feedbackItems = [];
    this.persist();
  }

  toMarkdown(settings?: PinmarkSettings): string {
    const url = this.config.url || window.location.href;
    return this.formatter.format(url, this.feedbackItems, settings as any);
  }

  private reindex(): void {
    this.feedbackItems.forEach((item, index) => {
      item.index = index + 1;
    });
  }

  private async persist(): Promise<void> {
    if (this.config.storage) {
      const url = this.config.url || window.location.href;
      await this.config.storage.saveFeedback(url, this.feedbackItems);
    }
  }

  async save(): Promise<void> {
    await this.persist();
  }
}
