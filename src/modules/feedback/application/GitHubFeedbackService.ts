import { InfraError } from "../../../shared/errors/AppError.js";

export interface FeedbackPayload {
  name: string;
  email: string;
  category: "bug" | "improvement" | "question" | "security";
  message: string;
  pageUrl?: string;
  userAgent?: string;
  requestId?: string;
  ip?: string;
}

export interface GitHubFeedbackServiceOptions {
  token?: string;
  owner?: string;
  repo?: string;
  labels?: string;
}

export interface FeedbackSubmitResult {
  issueNumber: number;
  issueUrl: string;
}

/**
 * Sends feedback records to GitHub Issues using repository-scoped token.
 */
export class GitHubFeedbackService {
  private readonly token: string;
  private readonly owner: string;
  private readonly repo: string;
  private readonly labels: string[];

  public constructor(options: GitHubFeedbackServiceOptions) {
    this.token = options.token?.trim() ?? "";
    this.owner = options.owner?.trim() ?? "";
    this.repo = options.repo?.trim() ?? "";
    this.labels = (options.labels ?? "feedback")
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  public isConfigured(): boolean {
    return this.token.length > 0 && this.owner.length > 0 && this.repo.length > 0;
  }

  public async submit(payload: FeedbackPayload): Promise<FeedbackSubmitResult> {
    if (!this.isConfigured()) {
      throw new InfraError("Feedback integration is not configured");
    }

    const safeMessage = payload.message.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim();
    const safeName = payload.name.trim();
    const safeEmail = payload.email.trim().toLowerCase();

    const title = `[Feedback][${payload.category}] ${safeMessage.slice(0, 72)}`;
    const bodyLines = [
      `## Feedback`,
      `- Name: ${safeName}`,
      `- Email: ${safeEmail}`,
      `- Category: ${payload.category}`,
      `- RequestId: ${payload.requestId ?? "n/a"}`,
      `- Source IP: ${payload.ip ?? "n/a"}`,
      `- User Agent: ${payload.userAgent ?? "n/a"}`,
      `- Page URL: ${payload.pageUrl ?? "n/a"}`,
      "",
      "## Message",
      safeMessage
    ];

    const response = await fetch(
      `https://api.github.com/repos/${this.owner}/${this.repo}/issues`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
          "User-Agent": "fraudsense-feedback-bot"
        },
        body: JSON.stringify({
          title,
          body: bodyLines.join("\n"),
          labels: this.labels
        })
      }
    );

    if (!response.ok) {
      throw new InfraError("Feedback could not be forwarded", {
        provider: "github",
        status: response.status
      });
    }

    const data = (await response.json()) as {
      number?: number;
      html_url?: string;
    };

    if (!data.number || !data.html_url) {
      throw new InfraError("Feedback provider returned unexpected payload", {
        provider: "github"
      });
    }

    return {
      issueNumber: data.number,
      issueUrl: data.html_url
    };
  }
}
