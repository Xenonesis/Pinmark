import type { FeedbackItem, ExtensionSettings } from '../../shared/types';
import { saveFeedback } from '../../shared/storage';
import { MarkdownFormatter } from './MarkdownFormatter';

export class FeedbackManager {
  private url: string;
  private feedbackItems: FeedbackItem[] = [];
  private formatter: MarkdownFormatter;

  constructor(url: string, initialFeedback: FeedbackItem[] = []) {
    this.url = url;
    this.feedbackItems = initialFeedback;
    this.formatter = new MarkdownFormatter();
  }

  add(item: FeedbackItem): void {
    this.feedbackItems.push(item);
    this.persist();
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

  toMarkdown(settings?: ExtensionSettings): string {
    return this.formatter.format(this.url, this.feedbackItems, settings);
  }

  private reindex(): void {
    this.feedbackItems.forEach((item, index) => {
      item.index = index + 1;
    });
  }

  private async persist(): Promise<void> {
    await saveFeedback(this.url, this.feedbackItems);
  }

  async save(): Promise<void> {
    await this.persist();
  }
}
