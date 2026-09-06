# Feature Specification: Operator Console, Tenant & User Onboarding, First Login

**Feature Branch**: `feature/22-admin-console-onboarding`

**Created**: 2026-09-06

**Status**: Draft

**Issue**: #22

**Input**: User description: "運営画面とテナント・ユーザー登録、最初のログイン体験。SaaS 運営者向けユーザーは CLI 的な手段でのみ作成でき（メールアドレス、パスワードは自動生成の強力なランダム値）、日本語のみの運営画面にログインできる。運営画面では利用者テナント（表示名、デフォルト言語=日本語 or 英語、既定は日本語）を登録でき、テナントごとにテナント ID・ユーザー数・チャット数を閲覧できる。テナント配下の利用者ユーザー（メールアドレス（後から変更不可）、自動生成パスワード、表示名、デフォルト言語（既定はテナントのデフォルト言語））を登録でき、ユーザー ID と初回ログイン済みかどうかを閲覧できる。利用者ユーザーは運営が登録したメールアドレスとパスワードでログインし、初回ログインの後に最初に言語を選ぶ（運営が用意した言語がデフォルトで選択されている）。設定ボタンまたは ⌘ + カンマ等のショートカットで設定画面が開き、自分のユーザー ID とメールアドレスを確認でき（変更不可）、パスワード・表示名・言語を変更できる。運営画面・利用者画面いずれもログイン中のアカウント情報をどこかに表示する。README のヒーローバナーやそれを切り取ったものをアイコン的に画面に配置する。やらないこと: メール送信によるメールアドレス検証、多要素認証、テナントやユーザーの削除、インフラ構築、本番運用。"

## Purpose

M4 today has no way for a person to sign in and no way for a company to exist on
the platform. This feature creates the first accounts and the first screens: a
SaaS operator bootstrapped from the command line, an operator console in which
that operator registers customer tenants and the users inside them, and the
first-login experience those users get when they arrive with the credentials the
operator handed over.

Nothing in M4 that carries conversation or knowledge can be built until a request
can be attributed to a tenant and a user. This feature establishes that
attribution and is a hard prerequisite for the LLM chat work (issue #23).

## Scope

- Creating SaaS operator accounts through a command-line facility only.
- An operator console, presented **entirely in Japanese**, where an operator can:
  - sign in and see which account they are signed in as;
  - register a customer tenant and view its identifier and usage summary;
  - register a user inside a tenant and view that user's identifier and
    first-login status;
  - reissue a user's password when the issued one has been lost.
- Sign-in for tenant users with the email address and password the operator
  issued.
- A first-login step in which the user chooses a language and replaces the
  password the operator issued.
- A settings screen for a tenant user's own account: read-only identifier and
  email address, changeable password, display name and language.
- Signed-in account information visible in both the operator console and the
  tenant-facing application.
- The README hero banner (or a crop of it) used as the product mark in the UI.

## Out of Scope

- Sending email of any kind, including email-address verification.
- Multi-factor authentication.
- Deleting tenants or users (and, by extension, any archive or suspend flow).
- Self-service sign-up: nobody can create their own account.
- Tenant self-administration: a tenant user cannot invite, register, or edit
  another user.
- Per-user roles or permission tiers inside a tenant.
- Self-service password recovery: there is no reset link, no security question
  and no way back in without the operator. A user who is locked out is recovered
  by the operator reissuing a password (FR-024).
- Anything the LLM chat feature covers (issue #23): starting chats, chat history,
  model selection, semantic search.
- Document upload and RAG.
- Infrastructure provisioning and production operation. Local development only.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Bootstrap the first operator account (Priority: P1)

A SaaS operator has a freshly migrated database and no accounts at all. From the
command line they create an operator account by supplying an email address. The
facility generates a strong random password and prints it once. There is no
screen, link, or API through which an operator account can be created.

**Why this priority**: Without it there is no way into the operator console, and
every other story depends on an operator existing.

**Independent Test**: Run the command against an empty database, then sign in to
the operator console with the printed credentials.

**Acceptance Scenarios**:

1. **Given** an empty database, **When** an operator runs the account-creation
   command with an email address, **Then** an operator account is created and a
   strong random password is printed exactly once.
2. **Given** an operator account already exists for an email address, **When** the
   command is run again with the same address, **Then** it fails with a clear
   message and no second account is created.
3. **Given** the operator console is running, **When** anyone attempts to reach a
   sign-up or account-creation screen for operator accounts, **Then** no such
   screen exists.

---

### User Story 2 - Operator signs in and registers a tenant (Priority: P1)

An operator signs in to the Japanese-language console and registers a new
customer company by entering a display name and choosing a default language,
which is pre-set to Japanese. After registration the tenant appears in a list
showing its tenant identifier.

**Why this priority**: A tenant is the container every user and every future row
of conversation belongs to.

**Independent Test**: Sign in with bootstrapped credentials, register a tenant,
and confirm it appears in the list with a tenant identifier.

**Acceptance Scenarios**:

1. **Given** a signed-in operator, **When** they open the tenant registration
   form, **Then** every label, button and message on the screen is in Japanese
   and the default-language field is pre-selected as Japanese.
2. **Given** the registration form, **When** the operator submits a display name
   and a default language, **Then** the tenant is created and its tenant
   identifier is shown.
3. **Given** the registration form, **When** the operator submits an empty
   display name, **Then** the tenant is not created and a validation message
   explains why.
4. **Given** a visitor who is not signed in, **When** they request any operator
   console screen, **Then** they are sent to the operator sign-in screen and see
   no tenant data.

---

### User Story 3 - Operator registers a tenant user and hands over credentials (Priority: P1)

Inside a tenant, the operator registers a user by entering an email address and
a display name and choosing a default language, which is pre-set to the tenant's
default language. The system generates a strong random password and shows it
once so the operator can pass it to the person out of band.

**Why this priority**: This is the only way a tenant user comes into existence.

**Independent Test**: Register a user under a tenant, capture the shown password,
and use it to sign in as that user.

**Acceptance Scenarios**:

1. **Given** a tenant whose default language is Japanese, **When** the operator
   opens the user registration form for it, **Then** the default-language field
   is pre-selected as Japanese.
2. **Given** a tenant whose default language is English, **When** the operator
   opens the user registration form for it, **Then** the default-language field
   is pre-selected as English.
3. **Given** the user registration form, **When** the operator submits a valid
   email address, display name and language, **Then** the user is created and a
   strong random password is displayed once for the operator to copy.
4. **Given** an email address already used inside the same tenant, **When** the
   operator submits it again, **Then** the user is not created and a message
   explains that the address is already taken in that tenant.
5. **Given** an existing user, **When** the operator views them, **Then** the
   email address is displayed as a value that cannot be edited.
6. **Given** a user who has lost the password they were issued, **When** the
   operator reissues it, **Then** a new strong random password is displayed once,
   the previous password stops working, and the user's first-login status is
   unchanged.

---

### User Story 4 - Tenant user completes first login (Priority: P1)

A person receives an email address and password from their operator. They sign
in and, before reaching the application, are taken through a first-login step:
they choose their language — the one the operator set is already selected — and
then replace the issued password with one of their own. After both, they land in
the application, and their account is marked as having completed first login.

**Why this priority**: This is the moment the product becomes usable by a
customer, and the first-login flag it sets is what the operator monitors. It is
also the only point at which the out-of-band password stops being the credential.

**Independent Test**: Sign in with freshly issued credentials, complete the
first-login step, sign out, and confirm the new password works, the issued one
does not, and the step does not reappear.

**Acceptance Scenarios**:

1. **Given** a user who has never signed in, **When** they sign in with correct
   credentials, **Then** the language selection step is shown with the
   operator-set language pre-selected.
2. **Given** the language selection step, **When** the user confirms a language,
   **Then** the password replacement step is shown next, in the chosen language.
3. **Given** the password replacement step, **When** the user submits a new
   password that meets the strength rules, **Then** it becomes their password,
   the issued password stops working, and the account is marked as having
   completed first login.
4. **Given** the password replacement step, **When** the user submits the same
   password they were issued, **Then** the change is rejected with a message
   saying the new password must differ.
5. **Given** a user who has completed first login, **When** they sign in again,
   **Then** neither the language step nor the password replacement step is shown.
6. **Given** any user, **When** they sign in with a wrong password, **Then**
   access is refused with a message that does not reveal whether the email
   address exists.
7. **Given** a user in tenant A, **When** they are signed in, **Then** no screen
   exposes any data belonging to another tenant.

---

### User Story 5 - Tenant user manages their own account (Priority: P2)

A signed-in tenant user opens settings, either from a settings control in the UI
or with a keyboard shortcut. They can read their own user identifier and email
address, and change their password, display name and language.

**Why this priority**: Valuable and expected, but the product is demonstrable
without it once first login works.

**Independent Test**: Open settings from both the control and the shortcut,
change the display name, password and language, then verify each change persists
across a fresh sign-in.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they activate the settings control or
   press the settings keyboard shortcut, **Then** the settings screen opens.
2. **Given** the settings screen, **When** the user views it, **Then** their user
   identifier and email address are shown as values that cannot be edited.
3. **Given** the settings screen, **When** the user submits a new password that
   meets the strength rules, **Then** the password is changed and the next
   sign-in requires the new password.
4. **Given** the settings screen, **When** the user submits a new password that
   fails the strength rules, **Then** the change is rejected with a message
   explaining the rule that failed.
5. **Given** the settings screen, **When** the user changes their display name or
   language, **Then** the change takes effect immediately and persists across
   sign-ins.

---

### User Story 6 - Operator reviews tenants and their users (Priority: P2)

An operator opens a tenant to see its identifier, how many users it has and how
many chats have been started in it, and opens the user list to see each user's
identifier and whether they have completed first login.

**Why this priority**: This is how the operator answers "did onboarding land?",
but registration works without it.

**Independent Test**: Register a tenant with two users, sign in as one of them,
and confirm the console reports two users and exactly one completed first login.

**Acceptance Scenarios**:

1. **Given** a tenant with users, **When** the operator views the tenant,
   **Then** the tenant identifier, the number of users, and the number of chats
   are shown.
2. **Given** a tenant in which no chat has been started, **When** the operator
   views it, **Then** the chat count is shown as zero rather than as an error or
   a blank.
3. **Given** a user who has never signed in, **When** the operator views the user
   list, **Then** that user is shown as not having completed first login.
4. **Given** that same user after they sign in and confirm their language,
   **When** the operator views the list again, **Then** the user is shown as
   having completed first login.

---

### User Story 7 - The product identifies itself and its viewer (Priority: P3)

Both the operator console and the tenant application carry the M4 mark — the
README hero banner or a crop of it used as an icon — and both display which
account is currently signed in.

**Why this priority**: Presentation, not capability. It makes the screens
recognisable and prevents acting as the wrong account, but nothing depends on
it.

**Independent Test**: Sign in to each surface and confirm the mark and the
signed-in account are both visible without navigating anywhere.

**Acceptance Scenarios**:

1. **Given** a signed-in operator, **When** any console screen is shown, **Then**
   the M4 mark and the operator's own identifying information are visible.
2. **Given** a signed-in tenant user, **When** any application screen is shown,
   **Then** the M4 mark and the user's own identifying information are visible.
3. **Given** either surface, **When** the mark is displayed at icon size,
   **Then** it remains legible against the dark base tone.

---

### Edge Cases

- An operator registers a tenant user and closes the page before copying the
  generated password. The password cannot be read again; the operator reissues it
  (FR-024).
- Two operators register a user with the same email address in the same tenant at
  the same moment. Exactly one succeeds; the other is told the address is taken.
- The same email address is registered in two different tenants. Both succeed —
  addresses are unique within a tenant, not across the platform.
- A user reaches the application without completing first login (by navigating
  directly). They are returned to the step they have not finished.
- A user abandons first login between choosing a language and replacing the
  password, then signs in again with the issued password. They resume at the
  password replacement step, and the account is still not marked as having
  completed first login.
- An operator reissues a password for a user who has already completed first
  login. The user signs in with the reissued password and is not sent through
  first login again; they change it from settings if they wish.
- A user's session is signed out in another window and they then submit a
  settings change. The change is refused and they are returned to sign in.
- A user changes their own password while signed in elsewhere; see FR-021 for
  what happens to the other session.
- The keyboard shortcut for settings collides with a browser or OS shortcut on
  some platforms. The settings control in the UI always remains available as the
  alternative.
- A tenant has no users yet. The user list shows an empty state, not an error.

## Requirements *(mandatory)*

### Functional Requirements

#### Operator accounts

- **FR-001**: The system MUST provide a command-line facility that creates a SaaS
  operator account from an email address.
- **FR-002**: The system MUST generate the operator's password itself, as a
  strong random value, and MUST NOT accept an operator-chosen password at
  creation.
- **FR-003**: The system MUST display a newly generated password exactly once, at
  creation time, and MUST NOT provide any way to read it back afterwards.
- **FR-004**: The system MUST NOT expose any screen or network-facing endpoint
  through which an operator account can be created or registered.
- **FR-005**: The system MUST reject creating a second operator account for an
  email address that already has one.

#### Operator console

- **FR-006**: The operator console MUST be rendered entirely in Japanese,
  independent of any browser or account language preference.
- **FR-007**: The operator console MUST require a signed-in operator; an
  unauthenticated request to any console screen MUST be redirected to operator
  sign-in and MUST NOT disclose tenant data.
- **FR-008**: Operator accounts MUST NOT be able to sign in to the tenant-facing
  application, and tenant users MUST NOT be able to sign in to the operator
  console.
- **FR-009**: The operator console MUST display the signed-in operator's own
  identifying information on every screen.

#### Tenant registration and review

- **FR-010**: Operators MUST be able to register a tenant with a display name and
  a default language chosen from Japanese and English.
- **FR-011**: The tenant default-language field MUST default to Japanese.
- **FR-012**: The system MUST assign each tenant an identifier that operators can
  read and that is unique across the platform.
- **FR-013**: For each tenant, the console MUST show the tenant identifier, the
  number of users belonging to it, and the number of chats started within it.
- **FR-014**: The chat count MUST be reported as zero while the chat feature does
  not yet exist, and MUST count chats once it does.

#### Tenant user registration and review

- **FR-015**: Operators MUST be able to register a user inside a named tenant
  with an email address, a display name and a language.
- **FR-016**: The user's language field MUST default to the tenant's default
  language at the moment the form is opened.
- **FR-017**: The system MUST generate the user's password itself, as a strong
  random value, subject to FR-003.
- **FR-018**: A user's email address MUST be immutable after registration, by
  both the operator and the user.
- **FR-019**: Email addresses MUST be unique within a tenant and MAY repeat
  across tenants.
- **FR-020**: For each user, the console MUST show the user identifier and
  whether that user has completed first login.

#### Authentication

- **FR-021**: Tenant users MUST be able to sign in with the email address and
  password issued by the operator, and MUST be able to sign out.
- **FR-022**: Failed sign-in MUST NOT reveal whether the email address is
  registered.
- **FR-023**: Passwords MUST be stored such that they cannot be recovered from
  storage, and MUST NEVER be displayed after the single display at FR-003.
- **FR-024**: Operators MUST be able to reissue a tenant user's password from the
  console. Reissue MUST generate a new strong random value, display it once under
  FR-003, invalidate the previous password, and leave the user's first-login
  status unchanged.
- **FR-025**: The system MUST NOT send email, and MUST NOT require email-address
  verification before an account can be used.
- **FR-026**: The system MUST NOT offer multi-factor authentication.

#### First login

- **FR-027**: On a tenant user's first successful sign-in, the system MUST
  present a language selection step before any other application screen.
- **FR-028**: The language selection step MUST pre-select the language the
  operator assigned to that user.
- **FR-029**: Confirming the language step MUST record the chosen language as the
  user's language.
- **FR-030**: The first-login steps MUST NOT be shown again once first login has
  been completed.
- **FR-031**: After the language step and before any application screen, first
  login MUST require the user to replace the password they were issued.
- **FR-032**: The replacement password MUST satisfy the published strength rules
  and MUST differ from the password that was issued.
- **FR-033**: First login MUST be considered complete only once both the language
  and the replacement password have been recorded; a user who abandons it partway
  MUST resume at the unfinished step on the next sign-in.
- **FR-034**: A user who has not completed first login MUST NOT be able to reach
  application screens by navigating directly.
- **FR-035**: A password reissued by an operator under FR-024 MUST NOT re-trigger
  first login for a user who has already completed it.

#### Tenant user settings

- **FR-036**: A signed-in tenant user MUST be able to open a settings screen from
  a visible control in the UI and from a keyboard shortcut.
- **FR-037**: The settings screen MUST display the user's own user identifier and
  email address as values that cannot be edited.
- **FR-038**: A user MUST be able to change their own password, subject to
  published strength rules, and MUST NOT be able to change anyone else's.
- **FR-039**: A user MUST be able to change their own display name.
- **FR-040**: A user MUST be able to change their own language, taking effect
  immediately.
- **FR-041**: A user MUST NOT be able to view or modify another user's account
  through the settings screen.

#### Tenant isolation

- **FR-042**: Every read of tenant-owned data MUST be scoped to the requesting
  user's tenant, so that no screen or response can carry another tenant's data.
- **FR-043**: The tenant-facing application MUST be rendered in the signed-in
  user's language.

#### Product mark

- **FR-044**: Both the operator console and the tenant application MUST display
  the M4 mark, derived from the README hero banner, at icon scale.
- **FR-045**: The mark MUST remain legible against the product's dark base tone.

#### Deletion

- **FR-046**: The system MUST NOT provide any way to delete a tenant or a user.

### Key Entities

- **Operator**: A member of SaaS operations staff. Identified by an email address
  unique across the platform, holds a password, belongs to no tenant, and can
  reach the operator console only.
- **Tenant**: A customer company. Holds a display name, a default language
  (Japanese or English), and a platform-unique identifier operators can read.
  Owns its users and every row of conversation or knowledge beneath them.
- **Tenant User**: A person inside a tenant. Holds an immutable email address
  unique within the tenant, a display name, a language, a password, a readable
  identifier, and a flag recording whether first login has been completed.
- **Session**: The signed-in state binding a request to either an operator or a
  tenant user, and — for tenant users — to exactly one tenant.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Starting from an empty database, an operator can bootstrap their
  own account, register a tenant and register that tenant's first user in under
  5 minutes, without editing any file or writing any query by hand.
- **SC-002**: A tenant user given only an email address and a password can sign
  in and reach the application — language chosen and password replaced — in under
  90 seconds and without further help.
- **SC-003**: 100% of operator console text is Japanese, regardless of the
  browser's language settings.
- **SC-004**: 100% of tenant-facing text is presented in the signed-in user's
  chosen language.
- **SC-005**: A generated password is visible exactly once and is unreadable
  everywhere else in the product and in stored data.
- **SC-009**: After a user completes first login, the password the operator
  issued no longer grants access.
- **SC-006**: The operator's view of a tenant reflects a user's first login
  within one page refresh of that login completing.
- **SC-007**: No request made by a user of one tenant returns data belonging to
  another tenant, verified by an automated test that attempts it.
- **SC-008**: Both surfaces show the signed-in account and the product mark
  without the viewer having to navigate anywhere.

## Assumptions

- **Operator scope**: Every operator sees and can act on every tenant. There are
  no operator roles or per-tenant operator assignments.
- **Tenant identifier**: The tenant identifier and user identifier are
  system-generated opaque values, displayed for support and diagnosis. The
  operator does not choose them, and no human-friendly slug is collected at
  registration. The existing schema's tenant `slug` field may be derived or
  retired during planning.
- **Tenant user roles**: All users inside a tenant are equal in this feature. The
  `Role` values already present in the schema are not exercised here, and no
  screen depends on them.
- **Credential handover** happens out of band — the operator tells the person
  their password by whatever channel they already use. The product does not
  participate.
- **"Chat count"** means the number of conversations started within the tenant,
  as defined by issue #23. Until that feature exists, the count is structurally
  zero.
- **Password strength rules** are the product's own, applied to every
  user-chosen password — at first login and in settings alike; generated
  passwords always satisfy them.
- **Session handling** uses conventional web session semantics: signing out ends
  the session, and sessions expire after a period of inactivity. No "remember me"
  is offered.
- **Language set** is exactly Japanese and English. No third language, and no
  per-screen override.
- **Single deployment, local only.** There is no production environment, no
  custom domain per tenant, and no infrastructure work in this feature.
- **The existing data model is a starting point, not a constraint.** The current
  schema has `Tenant` and `User` models but no operator entity, no password
  storage, no language field and no first-login flag. Adding them is expected and
  is planning work, not a spec decision.

## Dependencies

- Issue #23 (LLM chat) depends on this feature: it needs an authenticated tenant
  user and a session scoped to one tenant. This feature does not depend on #23,
  except that FR-014's chat count reads a number that #23 makes non-zero.

## Open Questions

Recorded so they are not silently decided during planning. None of these block
writing the spec; each has a working default stated in Assumptions or is a
presentation detail for planning to settle.

- Should the operator console show a global list of all tenants and a search over
  them, or is a simple list sufficient at this scale?
- Should reissuing a password end that user's active sessions immediately, or
  only prevent future sign-ins with the old value?
- Is there any audit trail of operator actions (who registered which tenant and
  when), or is `createdAt` enough for now?
- When a user changes their password, should other active sessions for that user
  be ended?
- Should the keyboard shortcut that opens settings be configurable, and what is
  the non-macOS equivalent?
