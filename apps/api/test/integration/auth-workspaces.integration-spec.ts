import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  PASSWORD,
  createAgent,
  createTestContext,
  createWorkspace,
  del,
  patch,
  post,
  registerAndLogin,
  truncateAll,
} from './helpers.js';
import type { TestContext } from './helpers.js';

describe('EduPlatform database integration', () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await createTestContext();
  });

  beforeEach(async () => {
    await truncateAll(context.prisma);
    context.mail.verifications.length = 0;
    context.mail.passwordResets.length = 0;
    context.mail.invitations.length = 0;
  });

  afterAll(async () => {
    await context.app.close();
  });

  describe('authentication', () => {
    it('persists a user with an Argon2id hash and authenticates through a session cookie', async () => {
      const { client } = await registerAndLogin(context, 'owner@example.com');

      const stored = await context.prisma.user.findUnique({
        where: { email: 'owner@example.com' },
      });

      expect(stored?.passwordHash.startsWith('$argon2id$')).toBe(true);
      expect(stored?.passwordHash).not.toContain(PASSWORD);

      const me = await client.get('/api/v1/auth/me');

      expect(me.status).toBe(200);
      expect(me.body.user.email).toBe('owner@example.com');
      expect(me.body.activeWorkspaceId).toBeNull();
    });

    it('rejects duplicate email registration', async () => {
      await registerAndLogin(context, 'owner@example.com');

      const second = await post(createAgent(context), '/auth/register').send({
        firstName: 'Other',
        email: 'OWNER@example.com',
        password: PASSWORD,
      });

      expect(second.status).toBe(409);
    });

    it('rejects a wrong password without revealing which field failed', async () => {
      const client = createAgent(context);

      await post(client, '/auth/register').send({
        firstName: 'Test',
        email: 'owner@example.com',
        password: PASSWORD,
      });

      const login = await post(client, '/auth/login').send({
        email: 'owner@example.com',
        password: 'wrong-password-here',
      });

      expect(login.status).toBe(401);
      expect(login.body.message).toBe('Invalid email or password');
    });

    it('invalidates the stored session on logout', async () => {
      const { client } = await registerAndLogin(context, 'owner@example.com');

      expect(await context.prisma.session.count()).toBe(1);

      const logout = await post(client, '/auth/logout').send({});

      expect(logout.status).toBe(200);
      expect(await context.prisma.session.count()).toBe(0);
      expect((await client.get('/api/v1/auth/me')).status).toBe(401);
    });

    it('verifies an email address with the captured token and rejects reuse', async () => {
      const { client } = await registerAndLogin(context, 'owner@example.com');
      const token = context.mail.verifications[0]?.token;

      expect(token).toBeTruthy();

      const verified = await post(client, '/auth/email/verify').send({ token });

      expect(verified.status).toBe(200);

      const stored = await context.prisma.user.findUnique({
        where: { email: 'owner@example.com' },
      });

      expect(stored?.emailVerifiedAt).not.toBeNull();
      expect((await post(client, '/auth/email/verify').send({ token })).status).toBe(400);
    });

    it('resets a password and revokes existing sessions', async () => {
      const { client } = await registerAndLogin(context, 'owner@example.com');

      const forgot = await post(client, '/auth/password/forgot').send({
        email: 'owner@example.com',
      });

      expect(forgot.status).toBe(200);
      expect(context.mail.passwordResets).toHaveLength(1);

      const reset = await post(client, '/auth/password/reset').send({
        token: context.mail.passwordResets[0]!.token,
        password: 'new-correct-horse',
      });

      expect(reset.status).toBe(200);
      expect(await context.prisma.session.count()).toBe(0);
      expect((await client.get('/api/v1/auth/me')).status).toBe(401);

      const oldLogin = await post(client, '/auth/login').send({
        email: 'owner@example.com',
        password: PASSWORD,
      });

      expect(oldLogin.status).toBe(401);

      const newLogin = await post(client, '/auth/login').send({
        email: 'owner@example.com',
        password: 'new-correct-horse',
      });

      expect(newLogin.status).toBe(200);
    });

    it('rejects unsafe requests without an allowed origin', async () => {
      const { client } = await registerAndLogin(context, 'owner@example.com');

      const crossOrigin = await client
        .post('/api/v1/workspaces')
        .set('Origin', 'http://evil.example')
        .send({ name: 'Other', type: 'TEACHER' });

      expect(crossOrigin.status).toBe(403);

      const missingOrigin = await client
        .post('/api/v1/workspaces')
        .send({ name: 'Other', type: 'TEACHER' });

      expect(missingOrigin.status).toBe(403);
    });
  });

  describe('workspaces', () => {
    it('creates a workspace with an owner membership and activates it', async () => {
      const { client, user } = await registerAndLogin(context, 'owner@example.com');
      const workspace = await createWorkspace(client, 'Colombo Maths');

      expect(workspace.role).toBe('OWNER');

      const membership = await context.prisma.membership.findUnique({
        where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
      });

      expect(membership?.role).toBe('OWNER');

      const me = await client.get('/api/v1/auth/me');

      expect(me.body.activeWorkspaceId).toBe(workspace.id);
    });

    it('switches between workspaces and restores the active workspace from the session', async () => {
      const { client } = await registerAndLogin(context, 'owner@example.com');
      const first = await createWorkspace(client, 'First');
      const second = await createWorkspace(client, 'Second');

      expect((await client.get('/api/v1/auth/me')).body.activeWorkspaceId).toBe(second.id);

      const switched = await post(client, `/workspaces/${first.id}/switch`).send({});

      expect(switched.status).toBe(200);
      expect((await client.get('/api/v1/auth/me')).body.activeWorkspaceId).toBe(first.id);
    });

    it('refuses to switch to a workspace the user does not belong to', async () => {
      const owner = await registerAndLogin(context, 'owner@example.com');
      const outsider = await registerAndLogin(context, 'outsider@example.com');
      const workspace = await createWorkspace(owner.client, 'Private');

      const switched = await post(outsider.client, `/workspaces/${workspace.id}/switch`).send({});

      expect(switched.status).toBe(403);
    });

    it('prevents cross-tenant workspace, member and invitation access', async () => {
      const owner = await registerAndLogin(context, 'owner@example.com');
      const outsider = await registerAndLogin(context, 'outsider@example.com');
      const workspace = await createWorkspace(owner.client, 'Private');

      expect((await outsider.client.get(`/api/v1/workspaces/${workspace.id}`)).status).toBe(403);
      expect((await outsider.client.get(`/api/v1/workspaces/${workspace.id}/members`)).status).toBe(
        403,
      );
      expect(
        (await outsider.client.get(`/api/v1/workspaces/${workspace.id}/invitations`)).status,
      ).toBe(403);
    });
  });

  describe('invitations and memberships', () => {
    it('accepts an invitation, creates the membership and activates the workspace', async () => {
      const owner = await registerAndLogin(context, 'owner@example.com');
      const member = await registerAndLogin(context, 'member@example.com');
      const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');

      const invitation = await post(owner.client, `/workspaces/${workspace.id}/invitations`).send({
        email: 'member@example.com',
        role: 'TEACHER',
      });

      expect(invitation.status).toBe(201);
      expect(context.mail.invitations).toHaveLength(1);

      const accepted = await post(member.client, '/invitations/accept').send({
        token: context.mail.invitations[0]!.token,
      });

      expect(accepted.status).toBe(200);

      const membership = await context.prisma.membership.findUnique({
        where: {
          userId_workspaceId: { userId: member.user.id, workspaceId: workspace.id },
        },
      });

      expect(membership?.role).toBe('TEACHER');
      expect(membership?.status).toBe('ACTIVE');
      expect((await member.client.get('/api/v1/auth/me')).body.activeWorkspaceId).toBe(
        workspace.id,
      );

      const stored = await context.prisma.workspaceInvitation.findFirst({
        where: { workspaceId: workspace.id },
      });

      expect(stored?.status).toBe('ACCEPTED');
    });

    it('rejects acceptance from a different email address', async () => {
      const owner = await registerAndLogin(context, 'owner@example.com');
      const other = await registerAndLogin(context, 'other@example.com');
      const workspace = await createWorkspace(owner.client, 'Institute');

      await post(owner.client, `/workspaces/${workspace.id}/invitations`).send({
        email: 'member@example.com',
        role: 'TEACHER',
      });

      const accepted = await post(other.client, '/invitations/accept').send({
        token: context.mail.invitations[0]!.token,
      });

      expect(accepted.status).toBe(403);
      expect(await context.prisma.membership.count()).toBe(1);
    });

    it('allows the owner, but not an admin, to invite an administrator', async () => {
      const owner = await registerAndLogin(context, 'owner@example.com');
      const admin = await registerAndLogin(context, 'admin@example.com');
      const workspace = await createWorkspace(owner.client, 'Institute');

      await post(owner.client, `/workspaces/${workspace.id}/invitations`).send({
        email: 'admin@example.com',
        role: 'ADMIN',
      });

      await post(admin.client, '/invitations/accept').send({
        token: context.mail.invitations[0]!.token,
      });

      const adminInvitesAdmin = await post(
        admin.client,
        `/workspaces/${workspace.id}/invitations`,
      ).send({ email: 'another@example.com', role: 'ADMIN' });

      expect(adminInvitesAdmin.status).toBe(403);

      const ownerInvitesAdmin = await post(
        owner.client,
        `/workspaces/${workspace.id}/invitations`,
      ).send({ email: 'another@example.com', role: 'ADMIN' });

      expect(ownerInvitesAdmin.status).toBe(201);

      const ownerInvitesOwner = await post(
        owner.client,
        `/workspaces/${workspace.id}/invitations`,
      ).send({ email: 'third@example.com', role: 'OWNER' });

      expect(ownerInvitesOwner.status).toBe(400);
    });

    it('lets the owner change a member role and remove the member', async () => {
      const owner = await registerAndLogin(context, 'owner@example.com');
      const member = await registerAndLogin(context, 'member@example.com');
      const workspace = await createWorkspace(owner.client, 'Institute');

      await post(owner.client, `/workspaces/${workspace.id}/invitations`).send({
        email: 'member@example.com',
        role: 'TEACHER',
      });

      await post(member.client, '/invitations/accept').send({
        token: context.mail.invitations[0]!.token,
      });

      const membership = await context.prisma.membership.findUniqueOrThrow({
        where: {
          userId_workspaceId: { userId: member.user.id, workspaceId: workspace.id },
        },
      });

      const promoted = await patch(
        owner.client,
        `/workspaces/${workspace.id}/members/${membership.id}`,
      ).send({ role: 'ADMIN' });

      expect(promoted.status).toBe(200);
      expect(promoted.body.role).toBe('ADMIN');

      expect((await member.client.get('/api/v1/auth/me')).body.activeWorkspaceId).toBe(
        workspace.id,
      );

      const removed = await del(
        owner.client,
        `/workspaces/${workspace.id}/members/${membership.id}`,
      );

      expect(removed.status).toBe(200);
      expect(
        await context.prisma.membership.findUnique({
          where: { id: membership.id },
        }),
      ).toBeNull();
      expect((await member.client.get('/api/v1/auth/me')).body.activeWorkspaceId).toBeNull();
    });

    it('blocks teachers from listing members and invitations', async () => {
      const owner = await registerAndLogin(context, 'owner@example.com');
      const teacher = await registerAndLogin(context, 'teacher@example.com');
      const workspace = await createWorkspace(owner.client, 'Institute');

      await post(owner.client, `/workspaces/${workspace.id}/invitations`).send({
        email: 'teacher@example.com',
        role: 'TEACHER',
      });

      await post(teacher.client, '/invitations/accept').send({
        token: context.mail.invitations[0]!.token,
      });

      expect((await teacher.client.get(`/api/v1/workspaces/${workspace.id}/members`)).status).toBe(
        403,
      );
      expect(
        (await teacher.client.get(`/api/v1/workspaces/${workspace.id}/invitations`)).status,
      ).toBe(403);
    });

    it('rejects duplicate invitations for an existing member', async () => {
      const owner = await registerAndLogin(context, 'owner@example.com');
      const member = await registerAndLogin(context, 'member@example.com');
      const workspace = await createWorkspace(owner.client, 'Institute');

      await post(owner.client, `/workspaces/${workspace.id}/invitations`).send({
        email: 'member@example.com',
        role: 'TEACHER',
      });

      await post(member.client, '/invitations/accept').send({
        token: context.mail.invitations[0]!.token,
      });

      const duplicate = await post(owner.client, `/workspaces/${workspace.id}/invitations`).send({
        email: 'member@example.com',
        role: 'ADMIN',
      });

      expect(duplicate.status).toBe(409);
    });

    it('revokes an invitation and blocks its acceptance', async () => {
      const owner = await registerAndLogin(context, 'owner@example.com');
      const member = await registerAndLogin(context, 'member@example.com');
      const workspace = await createWorkspace(owner.client, 'Institute');

      const invitation = await post(owner.client, `/workspaces/${workspace.id}/invitations`).send({
        email: 'member@example.com',
        role: 'TEACHER',
      });

      const revoked = await del(
        owner.client,
        `/workspaces/${workspace.id}/invitations/${invitation.body.id}`,
      );

      expect(revoked.status).toBe(200);

      const accepted = await post(member.client, '/invitations/accept').send({
        token: context.mail.invitations[0]!.token,
      });

      expect(accepted.status).toBe(400);
      expect(
        (
          await context.prisma.workspaceInvitation.findUniqueOrThrow({
            where: { id: invitation.body.id },
          })
        ).status,
      ).toBe('REVOKED');
    });

    it('expires an invitation and refuses acceptance', async () => {
      const owner = await registerAndLogin(context, 'owner@example.com');
      const member = await registerAndLogin(context, 'member@example.com');
      const workspace = await createWorkspace(owner.client, 'Institute');

      const invitation = await post(owner.client, `/workspaces/${workspace.id}/invitations`).send({
        email: 'member@example.com',
        role: 'TEACHER',
      });

      await context.prisma.workspaceInvitation.update({
        where: { id: invitation.body.id },
        data: { expiresAt: new Date(Date.now() - 60_000) },
      });

      const accepted = await post(member.client, '/invitations/accept').send({
        token: context.mail.invitations[0]!.token,
      });

      expect(accepted.status).toBe(400);
      expect(
        (
          await context.prisma.workspaceInvitation.findUniqueOrThrow({
            where: { id: invitation.body.id },
          })
        ).status,
      ).toBe('EXPIRED');
      expect(await context.prisma.membership.count()).toBe(1);
    });
  });
});
