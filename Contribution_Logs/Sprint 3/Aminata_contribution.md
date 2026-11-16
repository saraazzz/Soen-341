# Sprint 3 – Individual Contribution Log

**Total Estimated Time Spent: 19h 30min**

During Sprint 3, my contributions focused on unit testing, continuous integration (CI), test organization, and code verification. I helped establish a consistent testing approach for the team's Sprint 3 features, added and organized automated tests, and verified that the existing application functionality continued to work correctly. These activities helped maintain code quality and ensure that new features could be tested reliably.

| # | Contribution | Date | Time Spent | Description | Related Links |
|---|---|---|---|---|---|
| 1 | **Unit Testing – Sprint 3 Features** | November 11 & 15, 2026 | 10 hours | With the assistance of AI, developed and organized unit tests for Sprint 3 functionality, particularly application analytics, application management, and recruiter dashboard features. Added test cases to verify application data, dashboard functionality, application status handling, and related business logic. | [GitHub Repository](https://github.com/zayum20/Soen-341) |
| 2 | **Testing Structure and Team Coordination** | November 12, 2026 | 30 min | Established a consistent testing structure for Sprint 3. Identified the test command (`npm test`) and clarified where team members should place their tests. Jest tests are organized in the `tests/` directory, while Node.js built-in tests are organized in the `test/` directory. This helps ensure that tests for different Sprint 3 features follow a consistent structure and can be executed together. | [GitHub Repository](https://github.com/zayum20/Soen-341) |
| 3 | **Continuous Integration (CI) and Automated Test Execution** | November 11 & 15, 2026  | 5 hours | Worked on verifying the CI and automated testing workflow to ensure that the project's tests could be executed consistently. Used the project's `npm test` command to run both Jest and Node.js test suites, helping ensure that automated tests were included in the development verification process. | [GitHub Actions](https://github.com/zayum20/Soen-341/actions) |
| 4 | **Code Verification and Debugging** | November 11, 12, 15, 2026 | 3 hours | Executed the complete test suite to verify the application's existing functionality and identify potential issues. Reviewed test results, investigated errors, and checked that the new testing work did not interfere with existing functionality. Successfully executed 49 automated tests, consisting of 29 Jest tests and 20 Node.js tests, with all tests passing. | [GitHub Repository](https://github.com/zayum20/Soen-341) · [GitHub Actions](https://github.com/zayum20/Soen-341/actions) |

**### Testing Command**

The standardized command used to execute the project's automated tests was:

```bash
npm test
```

This command executes:

- Jest tests: `jest --runInBand --forceExit tests`
- Node.js tests: `node --test ./test/*.test.js`

**### Test Results**

- Jest: 29 tests passed.
- Node.js: 20 tests passed.
- **Total: 49 tests passed, 0 failures.**

**### Summary**

My contributions during Sprint 3 focused on improving the project's testing and verification process. I helped organize the unit testing structure, establish a consistent test execution command, verify the CI workflow, and execute automated tests to ensure application functionality.

With the assistance of AI, I developed and organized additional test cases and investigated potential issues during testing. The successful execution of 49 automated tests helped provide confidence in the application's stability and supported the team's ongoing Sprint 3 development.
