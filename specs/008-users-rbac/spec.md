# Feature Specification: Users & RBAC

**Feature Branch**: `008-users-rbac`  
**Created**: 2026-04-12  
**Status**: in-progress  
**Input**: Add user authentication via Supabase Auth and role-based access control with three roles (admin, salesperson, field worker). Admin manages users and assigns roles. Email/password authentication.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - User Login (Priority: P1)

A user navigates to FullBloom and sees a login page. They can either enter their email and password, or click "Sign in with Google" to use their enterprise Google Workspace account. After login, they see the app with navigation appropriate to their role. If they enter incorrect credentials or use an email from a non-allowed domain, they see a clear error message.

**Why this priority**: Nothing works without authentication. Every other feature depends on knowing who the user is.

**Independent Test**: Can be fully tested by navigating to the app unauthenticated, logging in with valid credentials, and verifying the app loads with role-appropriate navigation.

**Acceptance Scenarios**:

1. **Given** an unauthenticated user navigates to any page, **When** the page loads, **Then** they are redirected to the login page.
2. **Given** a user is on the login page, **When** they enter valid email and password, **Then** they are authenticated and redirected to the home page.
3. **Given** a user is on the login page, **When** they enter invalid credentials, **Then** they see an error message and remain on the login page.
4. **Given** an authenticated user, **When** they click "Log out", **Then** their session is ended and they are redirected to the login page.
5. **Given** an authenticated user closes the browser and returns later, **When** the session is still valid, **Then** they are automatically logged in without re-entering credentials.

---

### User Story 2 - Role-Based Navigation (Priority: P2)

After login, users see only the navigation items and pages their role permits. An admin sees everything including a "Users" section. A salesperson sees orders, customers, inventory, and pricing with full access, plus view-only products. A data manager sees products, customers, pricing, and harvest status with full access, plus view-only orders and inventory. A field worker sees inventory counts/estimates/harvest status with full access, plus view-only orders, customers, and products.

**Why this priority**: Without role-based navigation, users see controls they can't use, creating confusion.

**Independent Test**: Can be tested by logging in as each role and verifying the sidebar shows only permitted navigation items.

**Acceptance Scenarios**:

1. **Given** a user with the "admin" role logs in, **When** the app loads, **Then** they see all navigation items. The Settings section includes a "Users" sub-item visible only to admins.
2. **Given** a user with the "salesperson" role logs in, **When** the app loads, **Then** they see Orders, Standing Orders, Customers, Inventory, and Products in the sidebar. They do NOT see "Users" under Settings.
3. **Given** a user with the "data_manager" role logs in, **When** the app loads, **Then** they see Orders (view-only), Customers, Products, Pricing, Inventory (view-only except Harvest Status), Import, and Settings. They do NOT see "Users" under Settings.
4. **Given** a user with the "field_worker" role logs in, **When** the app loads, **Then** they see Inventory (Counts, Estimates, Harvest Status, Availability) and view-only sections for Orders, Customers, and Products. They do NOT see Pricing or "Users" under Settings.
5. **Given** a field worker navigates to an orders page, **When** the page loads, **Then** the "New Order", "Edit", and "Delete" buttons are hidden. They can view orders but not modify them.

---

### User Story 3 - API Authorization (Priority: P3)

Every API endpoint verifies the user's authentication token and checks their role before allowing access. Unauthenticated requests receive a 401 response. Requests from users without the required role receive a 403 response. The user's identity is captured in audit logs (`entered_by`).

**Why this priority**: Frontend role checks alone are insufficient — the API must enforce authorization independently so direct API calls can't bypass permissions.

**Independent Test**: Can be tested by calling API endpoints with no token (401), wrong role (403), and correct role (200).

**Acceptance Scenarios**:

1. **Given** a request to any API endpoint without an authentication token, **When** the request is processed, **Then** the server returns 401 Unauthorized.
2. **Given** a field worker's token is used to call `PUT /api/v1/orders/{id}`, **When** the request is processed, **Then** the server returns 403 Forbidden (field workers cannot edit orders).
3. **Given** a salesperson's token is used to call `POST /api/v1/orders`, **When** the request is processed, **Then** the server returns 201 Created (salespeople can create orders).
4. **Given** an authenticated user creates or edits a record, **When** the record is saved, **Then** the `entered_by` field is populated from the authenticated user's email (not from the request body).

---

### User Story 4 - Admin User Management (Priority: P4)

An admin navigates to a "Users" section in the app. They see a list of all users with their email, name, role, and active status. They can invite new users by entering an email and assigning a role. They can change a user's role. They can deactivate a user (preventing login without deleting their data).

**Why this priority**: Someone needs to manage who has access. This is admin-only functionality.

**Independent Test**: Can be tested by logging in as admin, navigating to Users, inviting a new user, changing a role, and deactivating a user.

**Acceptance Scenarios**:

1. **Given** an admin navigates to the Users page, **When** the page loads, **Then** they see a list of all users with email, display name, role, and active status.
2. **Given** an admin clicks "Invite User", **When** they enter an email and select a role, **Then** an invitation is sent and the user appears in the list as "pending".
3. **Given** an admin selects a user, **When** they change the user's role from "salesperson" to "field_worker", **Then** the role is updated and takes effect on the user's next page load.
4. **Given** an admin deactivates a user, **When** that user tries to log in, **Then** they are denied access with a message that their account has been deactivated.
5. **Given** a non-admin user, **When** they try to access the Users page (via URL or API), **Then** they are denied access with a 403 response.

---

### User Story 5 - Password Reset (Priority: P5)

A user who has forgotten their password can request a reset. They enter their email on the login page, receive a reset link, and set a new password.

**Why this priority**: Essential for self-service account management, but lower priority than core auth flow.

**Independent Test**: Can be tested by clicking "Forgot Password", entering an email, and verifying the reset flow works.

**Acceptance Scenarios**:

1. **Given** a user is on the login page, **When** they click "Forgot Password" and enter their email, **Then** a password reset email is sent.
2. **Given** a user receives a reset email, **When** they click the reset link, **Then** they can set a new password.
3. **Given** a user has reset their password, **When** they log in with the new password, **Then** they are authenticated successfully.

---

### User Story 6 - User Profile (Priority: P6)

Any authenticated user can view and edit their own profile under Settings. They can update their display name, phone number, and other personal details. The profile page is accessible to all roles.

**Why this priority**: Nice-to-have personalization — doesn't block core auth or RBAC.

**Independent Test**: Can be tested by logging in, navigating to Settings > Profile, editing a field, saving, and verifying changes persist.

**Acceptance Scenarios**:

1. **Given** any authenticated user navigates to Settings, **When** they click "Profile", **Then** they see their profile with display name, email (read-only), phone, and role (read-only).
2. **Given** a user edits their display name, **When** they save, **Then** the display name is updated and reflected in the app.
3. **Given** a user views their profile, **When** they see their role, **Then** it is displayed as read-only (users cannot change their own role).

---

### User Story 7 - Test Coverage (Priority: P7)

All authentication and authorization endpoints have comprehensive backend test coverage.

**Why this priority**: Required by constitution.

**Independent Test**: Can be verified by running the test suite.

**Acceptance Scenarios**:

1. **Given** the test suite runs, **When** auth tests execute, **Then** they cover: login, token validation, role-based endpoint access (401/403/200), user CRUD, role changes, and deactivation.

---

### Edge Cases

- What happens when a user's role is changed while they are logged in? The role change takes effect on their next API call or page refresh — no need to force logout.
- What happens when a deactivated user's token is used? The API rejects the request with 401 and the frontend redirects to login.
- What happens when the only admin tries to deactivate themselves? The system prevents it — there must always be at least one active admin.
- What happens when an invited user doesn't complete registration? They remain in "pending" status. The admin can resend the invitation or remove the pending user.
- What happens to existing `entered_by` and `salesperson_email` fields? They continue to work but are now populated from the authenticated user's identity rather than the request body.

## Clarifications

### Session 2026-04-12

- Q: Where should the avatar badge live? → A: Bottom of the sidebar — avatar + name when expanded, click for dropdown with Profile/Logout.
- Q: What does the data manager see in the sidebar? → A: Orders (view-only), Customers, Products, Pricing, Inventory, Import, Settings. No User Management.

## Requirements *(mandatory)*

### Functional Requirements

**Authentication:**

- **FR-001**: The system MUST require authentication to access any page or API endpoint (except the login page and password reset).
- **FR-002**: Users MUST be able to authenticate with email/password or Google SSO (enterprise Google Workspace accounts).
- **FR-003**: The system MUST maintain user sessions so users don't need to re-authenticate on every page load.
- **FR-004**: The system MUST provide a logout mechanism that ends the user's session.
- **FR-005**: The system MUST provide a password reset flow via email.

**Roles & Permissions:**

- **FR-006**: The system MUST support four roles: admin, salesperson, data_manager, and field_worker.
- **FR-007**: Each user MUST have exactly one role.
- **FR-008**: The permission matrix MUST be enforced as follows:

| Area | Admin | Salesperson | Data Manager | Field Worker |
|------|-------|-------------|--------------|--------------|
| User Management | Read/Write | No access | No access | No access |
| Orders & Standing Orders | Read/Write | Read/Write | View only | View only |
| Customers | Read/Write | Read/Write | Read/Write | View only |
| Inventory (Counts, Estimates) | Read/Write | View only | View only | Read/Write |
| Inventory (Harvest Status) | Read/Write | Read/Write | Read/Write | Read/Write |
| Inventory (Availability, Comparison) | Read/Write | View only | View only | View only |
| Products (Varieties, Product Lines, Types, Colors) | Read/Write | View only | Read/Write | View only |
| Pricing (Sales Items, Price Lists, Customer Prices) | Read/Write | Read/Write | Read/Write | No access |
| Import | Read/Write | No access | Read/Write | No access |

- **FR-009**: The frontend MUST hide navigation items, buttons, and controls that the user's role does not permit.
- **FR-010**: The API MUST independently enforce role permissions on every request, returning 403 for unauthorized actions regardless of what the frontend shows.

**User Management (Admin only):**

- **FR-011**: Admins MUST be able to view a list of all users with email, display name, role, and active status.
- **FR-012**: Admins MUST be able to invite new users by email with an assigned role.
- **FR-013**: Admins MUST be able to change a user's role.
- **FR-014**: Admins MUST be able to deactivate a user (preventing login) without deleting their data.
- **FR-015**: The system MUST prevent deactivating the last active admin.
- **FR-015c**: The Users admin page MUST include a visual permissions reference table showing all roles as columns and all application areas as rows, with clear indicators (checkmarks/icons) for Read/Write, View Only, and No Access per cell — so admins can see at a glance what each role can do before assigning it.
- **FR-015a**: Email domain restriction MUST be handled by Supabase Auth's "Restrict email domains" setting, configured in the Supabase dashboard. The FullBloom application does NOT enforce domain restrictions in its own code.
- **FR-015b**: ~~The allowed domains list MUST be configurable by the platform operator~~ Replaced by FR-015a — domain management is done in Supabase dashboard.

**User Profile:**

- **FR-016**: All authenticated users MUST be able to view and edit their own profile under Settings > Profile.
- **FR-016a**: The profile MUST include: display name (editable), email (read-only), phone (editable), profile picture (Google avatar or initials, not uploadable), and role (read-only).
- **FR-016c**: The app MUST display a user avatar badge at the bottom of the sidebar showing the user's Google avatar (or initials if unavailable). The user's display name MUST be shown next to the avatar when the sidebar is expanded.
- **FR-016d**: Clicking the avatar badge MUST show a dropdown with Profile and Logout options.
- **FR-016b**: The Settings section in the sidebar MUST be visible to all roles. "Users" under Settings is admin-only. "Profile" under Settings is visible to all.

**Audit Trail Integration:**

- **FR-016**: All `entered_by` fields across the application MUST be populated from the authenticated user's identity, not from request body fields.
- **FR-017**: The `salesperson_email` field on orders and standing orders MUST default to the authenticated user's email but MUST be changeable to any active salesperson via a dropdown. Salespeople and admins can assign orders to other salespeople.

### Key Entities

- **User**: A person who can authenticate with the system. Has an email, display name, role (admin/salesperson/field_worker), and active status. Linked to the external auth provider.
- **Role**: One of four fixed roles — admin, salesperson, data_manager, field_worker. Determines what a user can see and do. Stored as a string on the User entity (not a separate table — roles are fixed, not user-configurable).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can log in within 5 seconds of entering credentials.
- **SC-002**: Unauthorized API requests are rejected with the correct status code (401/403) 100% of the time.
- **SC-003**: Role-based navigation correctly hides unauthorized sections for all four roles.
- **SC-004**: An admin can invite a new user and assign a role in under 1 minute.
- **SC-005**: Password reset emails are delivered within 2 minutes of request.
- **SC-006**: All auth and authorization endpoints have backend test coverage with tests passing on every build.

## Assumptions

- Single-tenant for now (Oregon Flowers only). Multi-tenant/accounts will be a separate future feature.
- Supabase Auth handles email/password authentication, session management, password reset emails, and JWT token issuance. The backend validates Supabase JWTs.
- The first user (Oregon Flowers admin) will be created manually via Supabase dashboard or a seed script. All subsequent users are invited by admins through the app.
- The four roles are fixed — admins cannot create custom roles. If a new role is needed, it's a spec change.
- Existing data (orders, counts, etc.) with `entered_by = "anonymous"` or `NULL` will remain as-is. Only new actions will capture the authenticated user's identity.
- The `salesperson_email` field on orders defaults to the logged-in user but can be changed to any active salesperson by both salespeople and admins.
- No two-factor authentication in v1.
- Google SSO is supported via Supabase Auth's built-in Google provider. Configured at the Supabase project level.
- Email domain restriction is managed in the Supabase dashboard (Authentication > Providers > Email > Restrict email domains), not in FullBloom application code.
- Profile pictures are sourced from Google SSO avatars only — no upload functionality in v1. Users without Google avatars see initials.
