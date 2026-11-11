# Product Requirements

**Project:** Education SaaS Platform (LMS + IMS)  
**Status:** Approved MVP scope  
**Market:** Sri Lanka first  
**Approval date:** 2026-11-11

## 1. Product vision

Build one modular education SaaS platform combining Learning Management System (LMS) and Institute Management System (IMS) capabilities. It must serve independent tuition teachers and educational institutes, including multi-branch organizations, through the same core platform.

Initial languages: English, Sinhala and Tamil. Initial currency: LKR. International expansion is later.

## 2. Customer and service models

### Shared SaaS — first delivery model

Anyone can register and create workspaces. The platform operator manages central application infrastructure, database and storage. Workspace data and files are isolated. Customers use the platform domain.

### White-label SaaS — planned for later

The same core platform can support customer-specific name, logo, colors and custom domain while remaining on shared infrastructure. A custom domain does not automatically mean a separate deployment.

### Dedicated enterprise — planned for later

Selected customers may receive a separate application deployment, database and storage, custom domain/branding and support arrangements.

## 3. Onboarding paths

- **Independent teacher:** Register, create a workspace, configure profile, create subjects/classes and add students without needing an institute.
- **Institute:** Register, create an organization, establish branches, invite staff and teachers, create classes and enroll students.

Both paths use the same multi-tenant platform and authorization foundations.

## 4. Approved MVP scope

### 4.1 Student and teacher management

- Student and teacher/staff profiles.
- Parent/guardian details and links.
- Student enrollment.
- Validated CSV import.

### 4.2 Class and batch management

- Subjects, classes and batches.
- Teacher assignments.
- Timetables and schedules.
- Branch-aware organization.

### 4.3 Attendance and finance

- Manual attendance.
- Monthly fee structures.
- Cash and bank payment records.
- Outstanding balances.
- Receipts and payment history.

### 4.4 Learning management

- Lessons and learning resources.
- PDF and video resources.
- Assignments and submissions.
- Teacher feedback and marking.

### 4.5 Examinations

- Question bank.
- Multiple-choice and true/false questions.
- Timed examinations.
- Automatic marking for supported question types.
- Results and rankings.

### 4.6 Student portal

- Student login.
- Enrolled classes.
- Learning materials.
- Assignments and exams.
- Attendance and results.

### 4.7 Basic parent portal

- Parent login.
- Linked children.
- Attendance, results and fee status.
- Announcements.

### 4.8 Announcements and notifications

- In-app notifications.
- Audience targeting.

### 4.9 Basic reports

- Student and enrollment reports.
- Attendance reports.
- Examination and performance reports.
- Financial summaries.

## 5. Roles and security requirements

Roles:

- Platform administrator.
- Institute/workspace owner.
- Institute administrator.
- Branch manager.
- Independent teacher (workspace owner with teaching permissions).
- Teacher/staff.
- Student.
- Parent/guardian.

Security rules:

- Enforce tenant boundaries server-side; never trust client-supplied tenant IDs without validating authenticated membership.
- Parents access only explicitly linked children.
- Students access only their own permitted records.
- Teachers access assigned classes and permitted student fields.
- Branch managers are restricted to assigned branches.
- Sensitive finance and administrative actions are audited.
- Platform administrator access to private customer/student records must be temporary, explicitly approved, purpose-limited, scoped, time-limited and audited. No default unrestricted access.

## 6. Subscription and pricing foundations

Support configurable tiered plans (illustrative examples: Free/Starter, Teacher Pro, Institute, Business/White-label and Enterprise), with entitlements such as active students, teachers/staff, branches, storage, enabled modules, branding, custom domains and support level.

Initial subscription activation and renewal are manual. Automated payment gateway integration is later. Enterprise plans may use custom quotes and setup fees.

Exceeding plan limits must not delete existing data. Grace periods and post-expiry data handling must be configurable. SaaS subscription billing is separate from institute finance records.

## 7. Explicitly outside MVP

- Live video classrooms.
- Live quiz competitions/leaderboards, polls, Q&A and interactive whiteboards.
- AI question generation, AI marking assistance, material summarization and predictive weakness analysis.
- Online payment gateway (MVP records cash/bank payments).
- QR attendance (manual attendance first).
- Native Flutter mobile apps (web-first responsive MVP).
- Advanced accounting, payroll and tax automation.
- Full white-label/custom-domain feature set (architecture planned; implementation later).
- Dedicated enterprise deployments.
- International market, payment and compliance support.

Architecture should remain extensible without implementing these capabilities prematurely.

## 8. Research status

Customer/competitor desk research remains in progress. The product direction and MVP scope have been approved, but research must not be marked complete until its own acceptance criteria are met.
