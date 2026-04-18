# Profile Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the user profile page for better hierarchy and design system alignment, while fixing sidebar UI glitches.

**Architecture:** Refactor `ProfilePage.tsx` from a single-card layout to an integrated header + sectioned form grid. Fix global sidebar border issues by adding `border-transparent` to navigation buttons.

**Tech Stack:** React, TypeScript, Tailwind CSS, Lucide icons.

---

### Task 1: Fix Sidebar and UserBadge Button Borders

**Files:**
- Modify: `apps/web/src/components/layout/Sidebar.tsx`
- Modify: `apps/web/src/components/layout/UserBadge.tsx`

- [ ] **Step 1: Add border-transparent to Sidebar buttons**
In `apps/web/src/components/layout/Sidebar.tsx`, add `border-transparent` to all `button` and `Link` elements that represent nav items to prevent the high-contrast white border.

- [ ] **Step 2: Refine Sidebar active highlights**
Update the logic so that parent items ("Settings") only highlight when collapsed or when no children are expanded, and children items use a more distinct active style.

- [ ] **Step 3: Add border-transparent to UserBadge button**
In `apps/web/src/components/layout/UserBadge.tsx`, add `border-transparent` to the main trigger button.

- [ ] **Step 4: Commit**
```bash
git add apps/web/src/components/layout/Sidebar.tsx apps/web/src/components/layout/UserBadge.tsx
git commit -m "style: fix sidebar button borders and refine active states"
```

### Task 2: Redesign Profile Page Header and Personal Details Section

**Files:**
- Modify: `apps/web/src/components/settings/ProfilePage.tsx`

- [ ] **Step 1: Implement Integrated Header**
Remove the `div` wrapper for the avatar and info. Move it to the top as a direct child of the main container. Use `text-3xl font-bold text-slate-heading` for the name and `text-text-muted` for the role.

- [ ] **Step 2: Create Personal Details Section (Actionable)**
Rearrange the form so "Display Name" and "Phone Number" are at the top. Wrap them in a 2-column grid (`grid sm:grid-cols-2 gap-6`).

- [ ] **Step 3: Move Save Button**
Place the "Save Changes" button immediately after the personal details fields.

- [ ] **Step 4: Commit**
```bash
git add apps/web/src/components/settings/ProfilePage.tsx
git commit -m "feat: redesign profile header and prioritize personal details"
```

### Task 3: Implement Read-Only Account Info Section

**Files:**
- Modify: `apps/web/src/components/settings/ProfilePage.tsx`

- [ ] **Step 1: Add Account Info Section**
Add a horizontal divider and a heading "Account Info" at the bottom of the page.

- [ ] **Step 2: Add Explanatory Note**
Include the text: "These details are managed by your administrator and cannot be changed here." below the heading.

- [ ] **Step 3: Move Read-Only Fields**
Move "Email Address" and "Account Role" to this section. Ensure they use `bg-cream-warm`, `border-border-warm`, and `text-text-muted`.

- [ ] **Step 4: Final Polish and Initials Logic**
Ensure the initials logic handles empty display names correctly by falling back to email prefix.

- [ ] **Step 5: Commit**
```bash
git add apps/web/src/components/settings/ProfilePage.tsx
git commit -m "feat: move account info to read-only footer section"
```

### Task 4: Verification

- [ ] **Step 1: Verify UI and Layout**
Manually verify that the layout matches the approved mockup.
- Header info is integrated.
- Personal details are on top.
- Account info is on bottom and read-only.
- Sidebar borders are fixed.

- [ ] **Step 2: Verify Functionality**
Ensure saving Display Name and Phone still works correctly via the API.
