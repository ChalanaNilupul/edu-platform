import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { MailService } from '../../src/mail/mail.service.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

export const WEB_ORIGIN = 'http://localhost:3000';
export const PASSWORD = 'correct-horse-battery';

export type CapturedMail = {
  verifications: { email: string; token: string }[];
  passwordResets: { email: string; token: string }[];
  invitations: { email: string; token: string }[];
};

export type TestContext = {
  app: INestApplication;
  prisma: PrismaService;
  mail: CapturedMail;
};

export async function createTestContext(): Promise<TestContext> {
  const mail: CapturedMail = {
    verifications: [],
    passwordResets: [],
    invitations: [],
  };

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MailService)
    .useValue({
      sendEmailVerification: async (email: string, token: string) => {
        mail.verifications.push({ email, token });
      },
      sendPasswordReset: async (email: string, token: string) => {
        mail.passwordResets.push({ email, token });
      },
      sendWorkspaceInvitation: async (email: string, token: string) => {
        mail.invitations.push({ email, token });
      },
    })
    .compile();

  const app = moduleRef.createNestApplication();
  configureApp(app, app.get(ConfigService));
  await app.init();

  return {
    app,
    prisma: app.get(PrismaService),
    mail,
  };
}

export async function truncateAll(prisma: PrismaService) {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "audit_events", "enrollments", "classes", "student_guardians", "guardians", "students", "sessions", ' +
      '"workspace_invitations", "memberships", "email_verification_tokens", "password_reset_tokens", ' +
      '"workspaces", "users", "database_health" RESTART IDENTITY CASCADE',
  );
}

export function createAgent(context: TestContext) {
  return request.agent(context.app.getHttpServer());
}

export function post(client: ReturnType<typeof createAgent>, path: string) {
  return client.post(`/api/v1${path}`).set('Origin', WEB_ORIGIN);
}

export function patch(client: ReturnType<typeof createAgent>, path: string) {
  return client.patch(`/api/v1${path}`).set('Origin', WEB_ORIGIN);
}

export function del(client: ReturnType<typeof createAgent>, path: string) {
  return client.delete(`/api/v1${path}`).set('Origin', WEB_ORIGIN);
}

export async function registerAndLogin(context: TestContext, email: string) {
  const client = createAgent(context);

  const registration = await post(client, '/auth/register').send({
    firstName: 'Test',
    email,
    password: PASSWORD,
  });

  if (registration.status !== 201) {
    throw new Error(`Registration failed for ${email}: ${registration.status}`);
  }

  const login = await post(client, '/auth/login').send({ email, password: PASSWORD });

  if (login.status !== 200) {
    throw new Error(`Login failed for ${email}: ${login.status}`);
  }

  return { client, user: login.body.user as { id: string; email: string } };
}

export async function registerVerifiedUser(context: TestContext, email: string) {
  const registered = await registerAndLogin(context, email);

  await verifyEmail(context, registered.client, email);

  return registered;
}

export async function verifyEmail(
  context: TestContext,
  client: ReturnType<typeof createAgent>,
  email: string,
) {
  const verification = [...context.mail.verifications]
    .reverse()
    .find((entry) => entry.email === email);

  if (!verification) {
    throw new Error(`No verification email captured for ${email}`);
  }

  const response = await post(client, '/auth/email/verify').send({ token: verification.token });

  if (response.status !== 200) {
    throw new Error(`Email verification failed for ${email}: ${response.status}`);
  }
}

export async function createWorkspace(
  client: ReturnType<typeof createAgent>,
  name: string,
  type: 'TEACHER' | 'INSTITUTE' = 'TEACHER',
) {
  const response = await post(client, '/workspaces').send({ name, type });

  if (response.status !== 201) {
    throw new Error(`Workspace creation failed: ${response.status}`);
  }

  return response.body as { id: string; name: string; role: string };
}
