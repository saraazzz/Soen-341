## Sprint 3 Contribution Log - Tasneem Sultana Chowdhury
**Project:** CareerConnect
**GitHub Username:** TasneemChowdhury
**Work period:** November 14-16, 2026

# Summary of Contributions
- During Sprint 3, my contributions focused on implementing a notification and reminder system for job seekers and recruiters. This included notification generation for application events, a notification dropdown, persistent notification storage, interview and job offer notifications, and an upcoming application deadline reminder.

- I also worked on integrating the feature with the existing project, troubleshooting local database issues, restoring files on my feature branch, and preparing the deadline reminder for demonstration.

- I used Antigravity (Google DeepMind) to assist with implementation, debugging, database integration, and Git troubleshooting. I reviewed the suggested changes, made decisions about the notification behavior, and followed the instructions to manage and test the feature locally.

# Detailed Breakdown

| Date | Activity | Contribution and Outcome | Supporting Evidence |
|---|---|---|---|
| November 14, 2026 | Notification System Planning and Design | Defined the notification requirements for the website, including recruiter notifications for new applications and seeker notifications for application status changes, interview invitations, and upcoming deadlines. Established the need for persistent notifications, unread indicators, and links to relevant pages. | `new_code/public/notifications.js`, `new_code/public/notifications.css` |
| November 14, 2026 | Notification Interface Implementation | Implemented a notification bell in the purple navigation header, an unread notification badge, and a dropdown displaying notifications from newest to oldest. Included relative timestamps, clickable notifications, a mark-all-as-read feature, and an empty state. | `new_code/public/notifications.js`, `new_code/public/notifications.css` |
| November 14, 2026 | Backend Notification Functionality | Implemented backend functionality for creating and retrieving notifications. Notifications were associated with the logged-in user to prevent users from accessing other users' notifications. Added the notification routes and supporting backend logic. | `new_code/server/notifications.js` |
| November 14, 2026 | Notification Database Integration | Added a MySQL migration to create the notifications table and support persistent notification storage. This allowed notifications to remain available after refreshing the website. | `new_code/migrations/004_create_notifications.sql` |
| November 14, 2026 | Application Event Notifications | Implemented notification triggers for new applications, application status changes, interview invitations, and upcoming application deadlines. Recruiters receive notifications for new applications, while job seekers receive notifications about their application progress and important events. | `new_code/server/notifications.js` |
| November 14, 2026 | Job Offer Notification Customization | Requested a separate notification for the Offered application status instead of treating it as a regular status update. The notification was customized with the title "Job Offer Received!", a congratulatory message, a trophy icon, and a link to the relevant job description page, following the interview invitation behavior. | `new_code/server/notifications.js` |
| November 14, 2026 | Automated Testing and Notification Validation | Reviewed the AI's reported test results and received instructions for testing notification behavior locally. Antigravity reported that 27 tests passed, although the conversation did not include the complete test output. Additional manual validation was planned for notification triggers and navigation. | `new_code/test/notifications.test.js` |
| November 16, 2026 | Local MySQL and Server Troubleshooting | Troubleshot local MySQL startup and Node.js server errors. Received instructions for starting MySQL through Homebrew and running the server. Investigated missing database columns related to teammates' changes, including `jobs.archived_at` and `applications.submitted_resume_original_name`. | Migration `002_link_submitted_application_resumes.sql`, terminal output |
| November 16, 2026 | Database Migration Integration | Followed the instructions to run migration `002_link_submitted_application_resumes.sql` to add the missing submitted-resume columns. The terminal output confirmed that the columns were added. Other migration instructions were provided as well. | Migration `002_link_submitted_application_resumes.sql`, terminal output |

# Challenges

## Challenges and Resolutions

- **Git issues:** Restored deleted notification files using `git restore .` after reviewing my branch and commit history.
- **MySQL setup:** Learned to start MySQL locally and restart the Node.js server.
- **Database errors:** Resolved missing database columns by running the required migration.
- **Notification behavior:** Customized the Offered status notification with a dedicated message, icon, and destination.

