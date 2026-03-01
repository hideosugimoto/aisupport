import { Resend } from "resend";
import type { Logger } from "../logger/types";

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export interface SendEmailResult {
  id: string;
  success: boolean;
}

export interface EmailService {
  sendEmail(params: SendEmailParams): Promise<SendEmailResult>;
}

export class ResendEmailService implements EmailService {
  private readonly resend: Resend;

  constructor(
    private readonly fromEmail: string,
    private readonly fromName: string,
    private readonly logger: Logger
  ) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not set");
    }
    this.resend = new Resend(apiKey);
  }

  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    try {
      const result = await this.resend.emails.send({
        from: `${this.fromName} <${this.fromEmail}>`,
        to: params.to,
        subject: params.subject,
        html: params.html,
      });

      if (result.error) {
        this.logger.error("Email send failed", {
          to: params.to,
          error: result.error.message,
        });
        return { id: "", success: false };
      }

      this.logger.info("Email sent", { to: params.to, id: result.data?.id });
      return { id: result.data?.id ?? "", success: true };
    } catch (error) {
      this.logger.error("Email send error", {
        message: error instanceof Error ? error.message : String(error),
      });
      return { id: "", success: false };
    }
  }
}
