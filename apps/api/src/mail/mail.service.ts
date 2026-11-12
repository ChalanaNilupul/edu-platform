import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type MailKind = 'email verification' | 'password reset' | 'workspace invitation';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  async sendEmailVerification(email: string, token: string): Promise<void> {
    this.deliver('email verification', email, `/verify-email?token=${encodeURIComponent(token)}`);
  }

  async sendPasswordReset(email: string, token: string): Promise<void> {
    this.deliver('password reset', email, `/reset-password?token=${encodeURIComponent(token)}`);
  }

  async sendWorkspaceInvitation(email: string, token: string): Promise<void> {
    this.deliver(
      'workspace invitation',
      email,
      `/invitations/accept?token=${encodeURIComponent(token)}`,
    );
  }

  private deliver(kind: MailKind, email: string, path: string): void {
    const driver = this.config.get<string>('MAIL_DRIVER', 'console');

    if (driver === 'console' && this.config.get<string>('NODE_ENV') !== 'production') {
      const webUrl = this.config.get<string>('APP_WEB_URL', 'http://localhost:3000');

      this.logger.log(`${kind} link for ${email}: ${webUrl}${path}`);
      return;
    }

    this.logger.warn(
      `${kind} email for ${email} was not sent. Configure a mail provider before production use.`,
    );
  }
}
