import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  createTestContext,
  createWorkspace,
  patch,
  post,
  registerAndLogin,
  registerVerifiedUser,
  truncateAll,
  verifyEmail,
} from './helpers.js';
import type { TestContext } from './helpers.js';

type Client = Awaited<ReturnType<typeof registerAndLogin>>['client'];

describe('Teachers integration', () => {
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

  async function addMember(
    ownerClient: Client,
    workspaceId: string,
    email: string,
    role: 'TEACHER' | 'ADMIN' | 'STUDENT' = 'TEACHER',
  ) {
    const member = await registerAndLogin(context, email);

    await verifyEmail(context, member.client, email);

    const invitation = await post(ownerClient, `/workspaces/${workspaceId}/invitations`).send({
      email,
      role,
    });

    expect(invitation.status).toBe(201);

    const accepted = await post(member.client, '/invitations/accept').send({
      token: context.mail.invitations.at(-1)!.token,
    });

    expect(accepted.status).toBe(200);

    return member;
  }

  async function membershipIdFor(ownerClient: Client, workspaceId: string, email: string) {
    const response = await ownerClient.get(`/api/v1/workspaces/${workspaceId}/members`);

    expect(response.status).toBe(200);

    const membership = (response.body as { id: string; user: { email: string } }[]).find(
      (item) => item.user.email === email,
    );

    expect(membership).toBeDefined();

    return membership!.id;
  }

  it('lists teachers, creates a profile and exposes it on the detail page', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    await addMember(owner.client, workspace.id, 'teacher@example.com');

    const list = await owner.client.get(`/api/v1/workspaces/${workspace.id}/teachers`);

    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0].user.email).toBe('teacher@example.com');
    expect(list.body.items[0].teacherProfile).toBeNull();

    const membershipId = await membershipIdFor(owner.client, workspace.id, 'teacher@example.com');

    const update = await patch(
      owner.client,
      `/workspaces/${workspace.id}/teachers/${membershipId}/profile`,
    ).send({
      phone: '0771234567',
      qualifications: 'B.Sc. Mathematics',
      specializations: ['Mathematics', 'Science', 'Mathematics'],
      joinedAt: '2025-01-15',
      bio: 'Grade 6–11 mathematics teacher',
    });

    expect(update.status).toBe(200);
    expect(update.body.specializations).toEqual(['Mathematics', 'Science']);
    expect(update.body.joinedAt).toContain('2025-01-15');

    const detail = await owner.client.get(
      `/api/v1/workspaces/${workspace.id}/teachers/${membershipId}`,
    );

    expect(detail.status).toBe(200);
    expect(detail.body.teacherProfile.phone).toBe('0771234567');

    const audit = await context.prisma.auditEvent.findMany({
      where: { type: 'TEACHER_PROFILE_CREATED', targetId: membershipId },
    });

    expect(audit).toHaveLength(1);

    const updated = await patch(
      owner.client,
      `/workspaces/${workspace.id}/teachers/${membershipId}/profile`,
    ).send({ phone: null });

    expect(updated.status).toBe(200);
    expect(updated.body.phone).toBeNull();

    const updateAudit = await context.prisma.auditEvent.findMany({
      where: { type: 'TEACHER_PROFILE_UPDATED', targetId: membershipId },
    });

    expect(updateAudit).toHaveLength(1);
  });

  it('lets a teacher edit their own profile but not another member profile', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    const teacher = await addMember(owner.client, workspace.id, 'teacher@example.com');

    const teacherMembershipId = await membershipIdFor(
      owner.client,
      workspace.id,
      'teacher@example.com',
    );
    const ownerMembershipId = await membershipIdFor(
      owner.client,
      workspace.id,
      'owner@example.com',
    );

    const ownProfile = await patch(
      teacher.client,
      `/workspaces/${workspace.id}/teachers/${teacherMembershipId}/profile`,
    ).send({ bio: 'I teach mathematics.' });

    expect(ownProfile.status).toBe(200);
    expect(ownProfile.body.bio).toBe('I teach mathematics.');

    const otherProfile = await patch(
      teacher.client,
      `/workspaces/${workspace.id}/teachers/${ownerMembershipId}/profile`,
    ).send({ bio: 'Should not work' });

    expect(otherProfile.status).toBe(403);
  });

  it('lets managers profile a non-teaching member so they appear in the directory', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Tuition', 'TEACHER');
    const ownerMembershipId = await membershipIdFor(
      owner.client,
      workspace.id,
      'owner@example.com',
    );

    const profile = await patch(
      owner.client,
      `/workspaces/${workspace.id}/teachers/${ownerMembershipId}/profile`,
    ).send({ qualifications: 'M.Sc. Physics', specializations: ['Physics'] });

    expect(profile.status).toBe(200);

    const list = await owner.client.get(`/api/v1/workspaces/${workspace.id}/teachers`);

    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0].user.email).toBe('owner@example.com');
    expect(list.body.items[0].teacherProfile.qualifications).toBe('M.Sc. Physics');
  });

  it('blocks students and non-members from the teacher directory', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    const student = await addMember(owner.client, workspace.id, 'student@example.com', 'STUDENT');
    const outsider = await registerVerifiedUser(context, 'outsider@example.com');

    const asStudent = await student.client.get(`/api/v1/workspaces/${workspace.id}/teachers`);
    const asOutsider = await outsider.client.get(`/api/v1/workspaces/${workspace.id}/teachers`);

    expect(asStudent.status).toBe(403);
    expect(asOutsider.status).toBe(403);
  });

  it('prevents a teacher in one workspace from reading another workspace directory', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const otherOwner = await registerVerifiedUser(context, 'other@example.com');
    const workspace = await createWorkspace(owner.client, 'First', 'INSTITUTE');
    await createWorkspace(otherOwner.client, 'Second', 'INSTITUTE');
    const teacher = await addMember(owner.client, workspace.id, 'teacher@example.com');

    const otherWorkspace = await otherOwner.client.get('/api/v1/workspaces');
    const otherWorkspaceId = (otherWorkspace.body as { id: string }[])[0]!.id;

    const response = await teacher.client.get(`/api/v1/workspaces/${otherWorkspaceId}/teachers`);

    expect(response.status).toBe(403);
  });
});
