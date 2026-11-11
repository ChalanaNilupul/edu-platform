# Product Roadmap

This roadmap is the working plan for Edu Platform, a Sri Lanka-first, multi-tenant SaaS LMS + IMS for independent tuition teachers and educational institutes.

Status: `[ ]` not started · `[~]` in progress · `[x]` completed and reviewed · `[!]` blocked

**MVP labels:** `[MVP]` required for the approved first release; `[Later]` planned after the first release; `[Future]` optional/future exploration. A task is not complete merely because it is included in the MVP scope.

## Phase 0 — Product discovery and planning

- [x] **0.1 Product vision and target customers**
  - Define the product as a SaaS LMS + IMS for independent tuition teachers and institutes.
  - Initial market: Sri Lanka; planned languages: English, Sinhala and Tamil; initial currency: LKR.
  - Acceptance: vision, customer groups and initial market direction are documented and approved.
- [~] **0.2 Customer and competitor research**
  - Use desk research: competitor product pages, public documentation, public reviews and common tuition/institute workflows.
  - Build realistic teacher, institute, student and parent scenarios. Teacher interviews are not a dependency.
  - Acceptance: findings, recurring pain points, competitor comparison and assumptions are recorded with sources.
- [x] **0.3 MVP scope and release priorities**
  - Approved full six-module MVP plus parent portal, announcements/notifications and basic reports.
  - Acceptance: prioritized MVP scope, onboarding paths and explicit first-release exclusions are documented.
- [~] **0.4 Requirements and user journeys**
  - Define roles, permissions, onboarding and key journeys for platform admin, independent teacher, institute owner/admin, teacher/staff, student and parent/guardian.
  - Acceptance: role-permission matrix, primary user journeys, key business rules and edge cases are documented.
- [ ] **0.5 Architecture and technology decisions**
  - Confirm stack, tenant model, deployment assumptions, file storage, notification strategy and integrations.
  - Acceptance: decisions and trade-offs are recorded in architecture decision records.

## Approved first-release scope

### Onboarding and access foundation

- [MVP] Independent teacher onboarding without requiring an institute.
- [MVP] Institute onboarding with organization setup, branch support and staff invitations.
- [MVP] Secure authentication, tenant/workspace isolation and role-based permissions.
- [MVP] Platform administrator capabilities needed to operate and support the SaaS.

### Module 1 — Student and teacher management

- [MVP] Student profiles and enrollment.
- [MVP] Teacher and staff profiles.
- [MVP] Parent/guardian details and student-to-guardian relationships.
- [MVP] Validated CSV import for relevant records.
- [MVP] Search, filtering and record history appropriate to each role.

### Module 2 — Class and batch management

- [MVP] Subjects and class/course catalog.
- [MVP] Classes and batches.
- [MVP] Teacher assignments and student enrollments.
- [MVP] Timetables and schedules.
- [MVP] Visibility rules so users only see relevant classes and batches.

### Module 3 — Attendance and finance

- [MVP] Manual attendance marking and attendance history.
- [MVP] Monthly fee structures and student fee balances.
- [MVP] Cash and bank payment recording, including payment date and reference/details.
- [MVP] Outstanding balance tracking and payment history.
- [MVP] Receipts or downloadable payment records.
- [Later] QR-based attendance, after abuse-prevention design.
- [Later] Online payment gateway integration, after provider and compliance review.
- [Later] Advanced accounting, payroll and automated reconciliation.

### Module 4 — Learning management

- [MVP] Course/class sections and lessons.
- [MVP] PDF and video learning resources (video upload or supported links to be decided in technical design).
- [MVP] Assignments and student submissions.
- [MVP] Teacher feedback and marking.
- [MVP] Basic learning progress visibility.
- [Later] Advanced course authoring and certificate workflows.

### Module 5 — Examinations

- [MVP] Question bank with categories.
- [MVP] MCQ and true/false question types.
- [MVP] Timed exams and basic attempt rules.
- [MVP] Automatic marking for supported objective question types.
- [MVP] Results and class/batch rankings.
- [Later] Rich structured-question marking workflows and advanced exam analytics.

### Module 6 — Student portal

- [MVP] Secure student login.
- [MVP] Enrolled classes and schedules.
- [MVP] Access to permitted learning resources.
- [MVP] Assignment instructions and submission.
- [MVP] Exam participation, results and rankings.
- [MVP] Attendance and relevant learning progress.

### Additional first-release capability — Parent portal

- [MVP] Parent/guardian login and secure child linking.
- [MVP] View linked child's classes and announcements.
- [MVP] View attendance, examination results and fee status.
- [MVP] Parent access must be restricted to their linked child/children.

### Additional first-release capability — Announcements and notifications

- [MVP] Create and publish announcements.
- [MVP] Target announcements to an organization, branch, class, batch or appropriate user audience.
- [MVP] In-app notifications for relevant users.
- [Later] Email, push and SMS delivery integrations.

### Additional first-release capability — Basic reports

- [MVP] Student/enrollment summaries.
- [MVP] Attendance summaries.
- [MVP] Examination results and basic performance summaries.
- [MVP] Fee collection and outstanding-balance summaries.
- [MVP] Reports must respect tenant and role permissions.
- [Later] Advanced analytics, predictive insights and AI-generated reports.

## Explicitly outside the first release

- Live video classroom, real-time quiz competitions, leaderboards, polls, Q&A and interactive whiteboard.
- AI question generation, AI marking assistance, material summarization and predictive student weakness analysis.
- Native Flutter student, parent and teacher applications (web-first responsive experience for MVP).
- QR attendance.
- Online payment gateway integration.
- Advanced accounting, payroll and tax automation.
- Full white-label/custom-domain capabilities.
- International market launch, foreign currencies, country-specific payment providers and compliance workflows.

The architecture should be extensible for future countries, currencies, languages, time zones and providers, without implementing all international requirements in the Sri Lankan MVP.

## Later product releases

### Release 2 — Engagement and intelligence

- [Later] Live quiz sessions, join codes, real-time answers and leaderboards.
- [Later] Polls, Q&A and interactive classroom features.
- [Later] AI-assisted question generation, summarization and teacher workflows, with human review.
- [Later] Advanced student performance and weakness analysis.
- [Later] Parent reminders and expanded communication channels.
- [Later] Online payment integration and QR attendance, subject to design and validation.

### Release 3 — Mobile applications

- [Later] Flutter student app.
- [Later] Flutter parent app.
- [Later] Flutter teacher app.
- [Later] Push notifications and offline access to permitted resources.

### Future — International expansion

- [Future] Additional currencies, locales, time zones and country settings.
- [Future] Country-specific payment providers, tax and compliance support.
- [Future] International rollout after validating the Sri Lankan product.

## Remaining engineering phases

- [ ] **Phase 1 — Repository and engineering foundation**
  - Monorepo structure, formatting/linting/type-checking, environment configuration, Docker and CI.
- [ ] **Phase 2 — Authentication and multi-tenancy**
  - Authentication, tenant onboarding, tenant isolation tests, RBAC, invitations and audit logs.
- [ ] **Phase 3 — Dashboards and core navigation**
  - Role-specific dashboards and responsive navigation.
- [ ] **Phase 4 — People and organization management**
  - Student, teacher, staff, guardian, branch and import workflows.
- [ ] **Phase 5 — Classes, batches and courses**
  - Subjects, classes, batches, assignments, enrollments and schedules.
- [ ] **Phase 6 — Learning management system**
  - Lessons, resources, assignments, submissions, feedback and progress.
- [ ] **Phase 7 — Exams and question bank**
  - Question authoring, exam attempts, marking and results.
- [ ] **Phase 8 — Attendance and institute operations**
  - Manual attendance, history and operational workflows.
- [ ] **Phase 9 — Finance**
  - Fees, payments, receipts and financial summaries.
- [ ] **Phase 10 — Live classroom and competitions [Later]**
- [ ] **Phase 11 — Communication and parent portal**
  - MVP parent portal and announcements are first-release requirements; later delivery channels and reminders remain follow-on work.
- [ ] **Phase 12 — AI capabilities [Later]**
- [ ] **Phase 13 — SaaS subscriptions and platform administration**
- [ ] **Phase 14 — Branding and localization**
  - MVP must be prepared for English/Sinhala/Tamil and LKR; advanced branding and international localization can follow.
- [ ] **Phase 15 — Mobile applications [Later]**
- [ ] **Phase 16 — Quality, security and production**
  - Automated tests, tenant isolation, performance, backups, monitoring and release readiness.

## Release acceptance principles

The MVP is ready for release only when:

1. An independent teacher can onboard and run classes without creating an institute.
2. An institute can onboard, manage branches and invite staff.
3. Tenant boundaries and role permissions are tested, including attempts to access another tenant's records.
4. Core student, class, learning, exam, attendance and finance workflows work end-to-end.
5. Students and parents can access only the information they are authorized to see.
6. Announcements, notifications and basic reports work within tenant and role boundaries.
7. Relevant automated tests, security checks and release checks pass.
