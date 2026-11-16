# Sprint 3 – Individual Contribution Log

**Total Estimated Time Spent: 27 h**

During Sprint 3, my contributions focused on unit testing, continuous integration (CI), test organization, code verification, and project documentation. I helped establish a consistent testing approach for the team's Sprint 3 features, added and organized automated tests, and verified that the existing application functionality continued to work correctly. I also developed tests for the AI resume feedback and notification helper functionality, investigated a GitHub Actions testing failure, and updated the project's contribution and AI usage logs. These activities helped maintain code quality and ensure that new features could be tested reliably.

| # | Contribution | Date | Time Spent | Description | Related Links |
|---|---|---|---|---|---|
| 1 | **Unit Testing – Sprint 3 Features** | November 11, 15 & 16, 2026 | 10 hours | With the assistance of AI, developed and organized unit tests for Sprint 3 functionality, particularly application analytics, application management, recruiter dashboard features, AI resume feedback, and notifications. Added test cases to verify application data, dashboard functionality, application status handling, authentication, user-role restrictions, resume feedback generation, error handling, and notification creation. | [GitHub Repository](https://github.com/zayum20/Soen-341) |
| 2 | **Testing Structure and Team Coordination** | November 12, 2026 | 30 min | Established a consistent testing structure for Sprint 3. Identified the test command (`npm test`) and clarified where team members should place their tests. Jest tests are organized in the `tests/` directory, while Node.js built-in tests are organized in the `test/` directory. This helps ensure that tests for different Sprint 3 features follow a consistent structure and can be executed together. | [GitHub Repository](https://github.com/zayum20/Soen-341) |
| 3 | **Continuous Integration (CI) and Automated Test Execution** | November 11 & 15, 2026 | 7 hours | Worked on verifying the CI and automated testing workflow to ensure that the project's tests could be executed consistently. Used the project's `npm test` command to run both Jest and Node.js test suites, helping ensure that automated tests were included in the development verification process. Also reviewed the GitHub Actions workflow and investigated a CI failure related to a missing notification helper file. | [GitHub Actions](https://github.com/zayum20/Soen-341/actions) |
| 4 | **Code Verification and Debugging** | November 11, 12, 15 & 16, 2026 | 9 hours | Executed the complete test suite to verify the application's existing functionality and identify potential issues. Reviewed test results, investigated errors, and checked that the new testing work did not interfere with existing functionality. Successfully executed 87 automated tests locally, consisting of 57 Jest tests and 30 Node.js tests, with all tests passing. Also investigated why the notification test passed locally but failed in GitHub Actions because the required backend helper file had not been committed. | [GitHub Repository](https://github.com/zayum20/Soen-341) · [GitHub Actions](https://github.com/zayum20/Soen-341/actions) |
| 5 | **Contribution Log and AI Usage Log Documentation** | November 15 & 16, 2026 | 30 min | Updated the Sprint 3 individual contribution log and AI usage log to document completed activities, testing work, AI assistance, validation steps, and debugging activities. Organized the documentation to maintain a consistent structure and accurately reflect my contributions during the sprint. | [GitHub Repository](https://github.com/zayum20/Soen-341) |

### Testing Command

The standardized command used to execute the project's automated tests was:

```bash
npm test
```

This command executes:

- Jest tests: `jest --runInBand --forceExit tests`
- Node.js tests: `node --test ./test/*.test.js`

### Test Results

- Jest: 57 tests passed.
- Node.js: 30 tests passed.
- **Total: 87 tests passed, 0 failures locally.**

### Additional Testing Contributions

In addition to the application analytics and recruiter dashboard tests, I developed:

- **Five AI resume feedback tests:** Verified authentication, employer access restrictions, missing resume files, successful feedback generation, and Gemini API error handling.
- **Two notification helper tests:** Verified successful notification creation and rejection when required fields are missing.

### Summary

My contributions during Sprint 3 focused on improving the project's testing and verification process. I helped organize the unit testing structure, establish a consistent test execution command, verify the CI workflow, and execute automated tests to ensure application functionality.

With the assistance of AI, I developed and organized additional test cases for application analytics, recruiter functionality, AI resume feedback, and notifications. I also investigated a GitHub Actions failure and identified that a required notification helper file was missing from the commit.

Furthermore, I updated the contribution log and AI usage log to document my work throughout Sprint 3. The successful execution of 87 automated tests locally helped provide confidence in the application's stability and supported the team's ongoing Sprint 3 development.
