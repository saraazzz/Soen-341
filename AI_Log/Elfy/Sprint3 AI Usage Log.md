# AI Usage Log — Sprint 3

**Project:** CareerConnect — Job Search and Application Tracking Platform  
**Course:** SOEN 341 — Software Process  
**Responsible person:** Ariane Madjofo Sofouet  
**AI tool used:** OpenAI Codex  
**Conversation period:** November 10–16, 2026

## Purpose of AI Use

AI was used for implementation guidance, code review, debugging, test guidance, and documentation for Sprint 3 work. The work covered AI resume feedback, application details, and deadline notifications.

## AI Assistance and Human Review

| Date | Task | AI assistance | Human review / outcome |
|---|---|---|---|
| November 10–12, 2026 | AI resume feedback | Helped explore how resume content could be compared with a selected job posting and how feedback could be presented. | Reviewed the suggestions and directed development of the resume-feedback flow. |
| November 13–14, 2026 | Resume file support and job selection | Helped consider PDF, DOC, and DOCX handling and clarify that the job selector should show jobs the seeker has applied to. | Reviewed the requirements and directed the implementation of supported file formats and applied-job filtering. |
| November 15, 2026 | Job application details | Helped identify application information and documents that employers should be able to review. | Reviewed and directed updates to the application form and employer-facing application details. |
| November 16, 2026 | Testing and deadline notifications | Helped analyze a failing database-query-count test, inspect notification code, and identify that reminders used `deadline` while job postings stored `deadline_at`. | Reviewed the code changes, aligned deadline reminders with `deadline_at`, and removed the demo notification controls and endpoint while preserving real reminders. |

## Validation

Suggestions were checked against the project code and the test snippets shared during development. Changes were reviewed before being committed to the `Elfy's-branch` branch. The automated test suite was not run after the latest deadline-notification changes, so this log does not claim those changes passed tests.

## Decision

**Accepted with human review and modifications.** AI suggestions were reviewed and adapted to the existing code and requirements. Implementation choices and final decisions were made by the project contributor.

## Reflection

AI assistance helped explain the application flow, trace a test failure, and identify a mismatch between the deadline field used by reminders and the one used by job postings. Reviewing the suggestions against the repository was necessary to keep the changes consistent with the existing implementation.
