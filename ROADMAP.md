# Product Roadmap

This roadmap is a working plan. Scope and ordering may change after discovery. Do not mark a task complete until it is implemented (where applicable), checked and reviewed.

Status: `[ ]` not started · `[~]` in progress · `[x]` completed and verified · `[!]` blocked

## Phase 0 — Product discovery and planning

- [~] **0.1 Product vision and target customers**
  - Define the product as a SaaS LMS + IMS for individual tuition teachers and institutes.
  - Acceptance: vision, customer groups and initial problem statement are documented.
- [ ] **0.2 Customer and competitor research**
  - Interview tuition teachers, institute owners/managers, students and parents.
  - Acceptance: findings, recurring pain points and evidence are recorded.
- [ ] **0.3 MVP scope and release priorities**
  - Separate must-have MVP features from later enhancements.
  - Acceptance: prioritized MVP backlog and explicit exclusions are documented.
- [ ] **0.4 Requirements and user journeys**
  - Map onboarding and key workflows for platform admin, institute owner, teacher, student and parent.
  - Acceptance: role permissions and primary journeys are documented.
- [ ] **0.5 Architecture and technology decisions**
  - Confirm stack, tenant model, deployment assumptions and integrations.
  - Acceptance: decisions and trade-offs are recorded in architecture decision records.

## Phase 1 — Repository and engineering foundation

- [ ] 1.1 Confirm monorepo structure and tooling
- [ ] 1.2 Add formatting, linting and type-checking
- [ ] 1.3 Establish environment configuration and secret handling
- [ ] 1.4 Add local development environment and Docker setup
- [ ] 1.5 Add CI checks and contribution workflow

## Phase 2 — Authentication and multi-tenancy

- [ ] 2.1 Authentication, sessions and account recovery
- [ ] 2.2 Tenant/workspace creation and onboarding
- [ ] 2.3 Tenant isolation strategy and automated security tests
- [ ] 2.4 Role-based access control
- [ ] 2.5 Invitations and membership management
- [ ] 2.6 Audit logging for sensitive actions

## Phase 3 — Dashboards and core navigation

- [ ] 3.1 Platform administrator dashboard
- [ ] 3.2 Institute owner dashboard
- [ ] 3.3 Teacher dashboard
- [ ] 3.4 Student dashboard
- [ ] 3.5 Parent dashboard
- [ ] 3.6 Responsive navigation and accessibility baseline

## Phase 4 — People and organization management

- [ ] 4.1 Student profiles and enrollment
- [ ] 4.2 Teacher and staff profiles
- [ ] 4.3 Guardians and parent relationships
- [ ] 4.4 Branches, departments and groups
- [ ] 4.5 Bulk import/export with validation

## Phase 5 — Classes, batches and courses

- [ ] 5.1 Subjects and course catalog
- [ ] 5.2 Classes and batches
- [ ] 5.3 Teacher assignments and enrollments
- [ ] 5.4 Timetables and schedules
- [ ] 5.5 Course and batch visibility rules

## Phase 6 — Learning management system

- [ ] 6.1 Course sections and lessons
- [ ] 6.2 PDF, video and downloadable learning resources
- [ ] 6.3 Assignments and submissions
- [ ] 6.4 Teacher feedback and marking
- [ ] 6.5 Learning progress tracking
- [ ] 6.6 Completion records and certificates

## Phase 7 — Exams and question bank

- [ ] 7.1 Question bank with categories and difficulty levels
- [ ] 7.2 MCQ, true/false and structured question types
- [ ] 7.3 Timed exams and attempt rules
- [ ] 7.4 Automatic and manual marking
- [ ] 7.5 Results, rankings and performance reports

## Phase 8 — Attendance and institute operations

- [ ] 8.1 Manual attendance
- [ ] 8.2 QR-based attendance (subject to abuse prevention)
- [ ] 8.3 Attendance history and reports
- [ ] 8.4 Staff and branch operations

## Phase 9 — Finance

- [ ] 9.1 Fee structures and student balances
- [ ] 9.2 Payment recording and verification
- [ ] 9.3 Receipts and downloadable payment slips
- [ ] 9.4 Discounts, refunds and adjustments
- [ ] 9.5 Expenses and financial reports
- [ ] 9.6 Payment gateway integration, after provider and compliance review

## Phase 10 — Live classroom and competitions

- [ ] 10.1 Live quiz sessions and join codes
- [ ] 10.2 Real-time answers, countdowns and leaderboards
- [ ] 10.3 Polls, Q&A and team activities
- [ ] 10.4 Interactive whiteboard exploration
- [ ] 10.5 Session analytics

## Phase 11 — Communication and parent portal

- [ ] 11.1 Announcements and targeted notifications
- [ ] 11.2 Parent view of attendance, results and progress
- [ ] 11.3 Fee and class reminders
- [ ] 11.4 Email, push and SMS integrations

## Phase 12 — AI capabilities

- [ ] 12.1 Question and quiz generation with teacher review
- [ ] 12.2 Learning material summarization
- [ ] 12.3 Answer evaluation assistance
- [ ] 12.4 Student weakness analysis and recommendations
- [ ] 12.5 Teacher assistant and report generation
- [ ] 12.6 AI safety, privacy, cost controls and usage limits

## Phase 13 — SaaS subscriptions and platform administration

- [ ] 13.1 Subscription plans and trials
- [ ] 13.2 Renewals, expiry and plan changes
- [ ] 13.3 Feature and usage limits
- [ ] 13.4 Billing history and platform revenue reports
- [ ] 13.5 Tenant suspension and reactivation workflows

## Phase 14 — Branding and localization

- [ ] 14.1 Tenant logo and theme customization
- [ ] 14.2 Sinhala, Tamil and English localization
- [ ] 14.3 Time zone, currency, date and number formatting
- [ ] 14.4 Custom domains and white-label options

## Phase 15 — Mobile applications

- [ ] 15.1 Student mobile app
- [ ] 15.2 Parent mobile app
- [ ] 15.3 Teacher mobile app
- [ ] 15.4 Push notifications and secure authentication
- [ ] 15.5 Offline access to permitted learning materials

## Phase 16 — Quality, security and production

- [ ] 16.1 Unit, integration, API and end-to-end tests
- [ ] 16.2 Tenant-isolation and authorization security testing
- [ ] 16.3 Performance and load testing
- [ ] 16.4 Backups and recovery drills
- [ ] 16.5 Monitoring, logging and alerting
- [ ] 16.6 Production deployment, domain and TLS
- [ ] 16.7 Operational readiness and release checklist

## MVP candidate

The initial MVP should be confirmed during Phase 0. A reasonable candidate is:

- Tenant/workspace onboarding and secure role-based access
- Student, teacher, class, batch and course management
- Learning materials (PDF/video links)
- Basic exams/quizzes with automatic marking
- Attendance
- Fee and payment records
- Student portal for materials, exams, results and progress
- Institute dashboard and basic reports
- Platform admin view for tenants and subscription status

A simple live quiz may be considered an early differentiator, but should not delay validating the core workflows.
