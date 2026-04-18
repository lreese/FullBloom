# Spec: Profile Page Redesign

**Status:** Draft
**Last Updated:** 2026-04-18
**Reference Issue:** N/A

## Overview
Redesign the user profile page to improve visual hierarchy, alignment with the "Slate + Rose" design system, and user focus. The previous design used a cluttered "card" layout that over-emphasized read-only information.

## Goals
- Integrate identity information (Avatar, Name, Role) directly into the page header.
- Prioritize editable "Personal Details" (Display Name, Phone) at the top of the form.
- De-prioritize read-only "Account Info" (Email, Role) by moving them to the bottom.
- Ensure all inputs and buttons follow the established design system without hardcoded hex values.

## Design Details

### Header Section
- **Avatar:** 80px circle with `bg-rose-action` and white initials.
- **Name:** Large H1 (`text-3xl font-bold text-slate-heading`).
- **Role Label:** Subtitle text (`text-text-muted`) below the name.

### Form Structure (2-Column Grid)
- **Section 1: Personal Details (Actionable)**
  - **Display Name:** Editable `Input`.
  - **Phone Number:** Editable `Input`.
  - **Save Button:** `Button` component, `size="lg"`, `bg-sidebar` (dark green).
- **Section 2: Account Info (Read-Only)**
  - Separated by a horizontal divider.
  - Includes a brief explanatory note: "These details are managed by your administrator and cannot be changed here."
  - **Email Address:** Disabled `Input` with `bg-cream-warm` and `text-text-muted`.
  - **Account Role:** Disabled `Input` with `bg-cream-warm` and `text-text-muted`.

## Technical Implementation
- Use Tailwind CSS theme classes exclusively (no hardcoded hex colors).
- Ensure `Sidebar.tsx` and `UserBadge.tsx` buttons use `border-transparent` to avoid unwanted white borders.
- Improve initials logic in `ProfilePage.tsx` to handle various name/email formats gracefully.

## Acceptance Criteria
- [ ] Header identity info is integrated (no more separate card box).
- [ ] Display Name and Phone are the first two fields in the form.
- [ ] Save Changes button is located immediately after the editable fields.
- [ ] Email and Role are at the bottom and clearly marked as read-only.
- [ ] All components use Tailwind theme colors (`slate-heading`, `rose-action`, `cream-warm`, etc.).
- [ ] No unwanted white borders on sidebar buttons.
