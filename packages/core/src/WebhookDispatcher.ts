import type { PinmarkAnnotation } from './schema.js';

export interface WebhookConfig {
  type: 'slack' | 'discord' | 'github' | 'linear' | 'generic';
  url: string;
  token?: string;
  repo?: string; // e.g. "owner/repo" for GitHub
  teamId?: string; // for Linear
}

export class WebhookDispatcher {
  /**
   * Format annotation for Slack incoming webhook (Block Kit)
   */
  static formatSlackPayload(annotation: PinmarkAnnotation) {
    const severity = annotation.triage?.severity || annotation.severity || 'suggestion';
    const severityEmoji = severity === 'blocking' ? '🔴' : severity === 'important' ? '🟡' : '🔵';
    const source = annotation.element.component?.filePath
      ? `${annotation.element.component.filePath}:${annotation.element.component.lineNumber || 1}`
      : 'N/A';

    return {
      text: `Pinmark Visual Feedback on ${annotation.url}`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `🎯 Pinmark Visual Feedback (${severityEmoji} ${severity.toUpperCase()})`,
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Feedback:*\n>${annotation.comment.replace(/\n/g, '\n>')}`,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Location:*\n\`${annotation.element.selector}\``,
            },
            {
              type: 'mrkdwn',
              text: `*Source File:*\n\`${source}\``,
            },
            {
              type: 'mrkdwn',
              text: `*URL:*\n<${annotation.url}|${new URL(annotation.url).pathname || '/'}>`,
            },
            {
              type: 'mrkdwn',
              text: `*Component:*\n\`${annotation.element.component?.name || annotation.element.tagName}\``,
            },
          ],
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Recorded with *Pinmark* · Timestamp: <!date^${Math.floor(annotation.timestamp / 1000)}^{date_num} {time_secs}|${new Date(annotation.timestamp).toISOString()}>`,
            },
          ],
        },
      ],
    };
  }

  /**
   * Format annotation for Discord Webhook (Rich Embeds)
   */
  static formatDiscordPayload(annotation: PinmarkAnnotation) {
    const severity = annotation.triage?.severity || annotation.severity || 'suggestion';
    const color = severity === 'blocking' ? 0xef4444 : severity === 'important' ? 0xf59e0b : 0x3b82f6;
    const source = annotation.element.component?.filePath
      ? `${annotation.element.component.filePath}:${annotation.element.component.lineNumber || 1}`
      : 'N/A';

    return {
      username: 'Pinmark Visual Feedback',
      avatar_url: 'https://raw.githubusercontent.com/Xenonesis/Pinmark/main/packages/extension/assets/icon128.png',
      embeds: [
        {
          title: `🎯 Feedback on ${new URL(annotation.url).pathname || '/'}`,
          description: annotation.comment,
          url: annotation.url,
          color: color,
          fields: [
            {
              name: 'Location / Selector',
              value: `\`${annotation.element.selector}\``,
              inline: true,
            },
            {
              name: 'Source File',
              value: `\`${source}\``,
              inline: true,
            },
            {
              name: 'Severity',
              value: severity.toUpperCase(),
              inline: true,
            },
            {
              name: 'Component Tree',
              value: annotation.element.component?.hierarchy?.join(' > ') || annotation.element.component?.name || annotation.element.tagName,
              inline: false,
            },
          ],
          footer: {
            text: 'Pinmark AI Feedback Standard',
          },
          timestamp: new Date(annotation.timestamp).toISOString(),
        },
      ],
    };
  }

  /**
   * Format annotation for GitHub Issue
   */
  static formatGitHubIssue(annotation: PinmarkAnnotation) {
    const severity = annotation.triage?.severity || annotation.severity || 'suggestion';
    const title = `[Pinmark] ${severity.toUpperCase()}: ${annotation.comment.slice(0, 60)}`;
    const source = annotation.element.component?.filePath
      ? `\`${annotation.element.component.filePath}:${annotation.element.component.lineNumber || 1}\``
      : 'N/A';

    let body = `### Visual Feedback Report\n\n`;
    body += `**URL:** ${annotation.url}\n`;
    body += `**Comment:** ${annotation.comment}\n`;
    body += `**Location:** \`${annotation.element.selector}\`\n`;
    body += `**Source:** ${source}\n`;
    body += `**Severity:** \`${severity}\`\n\n`;

    if (annotation.triage) {
      body += `#### AI Auto-Triage\n`;
      body += `- **Category:** ${annotation.triage.category}\n`;
      body += `- **Intent:** ${annotation.triage.intent}\n`;
      body += `- **Summary:** ${annotation.triage.summary}\n\n`;
    }

    if (annotation.breadcrumbs && annotation.breadcrumbs.length > 0) {
      body += `#### User Navigation Trail\n`;
      annotation.breadcrumbs.forEach((b, i) => {
        body += `${i + 1}. \`${b.type}\` ${b.target ? `on \`${b.target}\`` : ''}\n`;
      });
      body += `\n`;
    }

    body += `---\n*Generated by Pinmark AI Visual Feedback*`;

    return { title, body };
  }

  /**
   * Format annotation for Linear Issue
   */
  static formatLinearIssue(annotation: PinmarkAnnotation, teamId?: string) {
    const severity = annotation.triage?.severity || annotation.severity || 'suggestion';
    const priority = severity === 'blocking' ? 1 : severity === 'important' ? 2 : 3;
    const { title, body } = this.formatGitHubIssue(annotation);

    return {
      title,
      description: body,
      priority,
      teamId,
    };
  }

  /**
   * Dispatch payload to configured webhook endpoint
   */
  static async dispatch(config: WebhookConfig, annotation: PinmarkAnnotation): Promise<{ success: boolean; error?: string }> {
    try {
      let payload: any;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (config.type === 'slack') {
        payload = this.formatSlackPayload(annotation);
      } else if (config.type === 'discord') {
        payload = this.formatDiscordPayload(annotation);
      } else if (config.type === 'github') {
        if (config.token) headers['Authorization'] = `Bearer ${config.token}`;
        payload = this.formatGitHubIssue(annotation);
      } else if (config.type === 'linear') {
        if (config.token) headers['Authorization'] = config.token;
        payload = this.formatLinearIssue(annotation, config.teamId);
      } else {
        payload = annotation;
      }

      if (config.token && !headers['Authorization']) {
        headers['Authorization'] = `Bearer ${config.token}`;
      }

      const res = await fetch(config.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        return { success: false, error: `HTTP ${res.status}: ${res.statusText}` };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  }
}
