# Contributing to ElevenLabs Screenplay Formatter

We welcome contributions to the ElevenLabs Screenplay Formatter! By contributing, you help us make this tool even better for screenwriters, voice actors, and content creators.

Please take a moment to review this document to ensure a smooth and effective contribution process.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How to Contribute](#how-to-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Enhancements](#suggesting-enhancements)
  - [Pull Requests](#pull-requests)
- [Development Setup](#development-setup)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running the Application](#running-the-application)
  - [Running Tests](#running-tests)
- [Coding Guidelines](#coding-guidelines)
- [Commit Message Guidelines](#commit-message-guidelines)

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to [your-email@example.com].

## How to Contribute

### Reporting Bugs

If you find a bug, please open an issue on GitHub. Before opening a new issue, please:

1.  **Check existing issues**: Your bug might have already been reported.
2.  **Provide detailed information**: Include steps to reproduce the bug, expected behavior, actual behavior, screenshots (if applicable), and your operating system/browser.

### Suggesting Enhancements

We love new ideas! If you have a suggestion for an enhancement, please open an issue on GitHub. Describe your idea clearly and explain why you think it would be a valuable addition to the project.

### Pull Requests

1.  **Fork the repository** and clone it to your local machine.
2.  **Create a new branch** for your feature or bug fix: `git checkout -b feature/your-feature-name` or `git checkout -b bugfix/your-bug-fix-name`.
3.  **Make your changes** and ensure they adhere to the [Coding Guidelines](#coding-guidelines).
4.  **Write tests** for your changes. Ensure all existing tests pass.
5.  **Update documentation** if necessary.
6.  **Commit your changes** using clear and concise [Commit Message Guidelines](#commit-message-guidelines).
7.  **Push your branch** to your forked repository.
8.  **Open a Pull Request** to the `main` branch of the original repository. Provide a clear description of your changes.

## Development Setup

### Prerequisites

-   Node.js (v18 or later)
-   npm (v8 or later)
-   Git

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/your-username/elevenlabs-screenplay-formatter.git
    cd elevenlabs-screenplay-formatter
    ```
2.  Install frontend dependencies:
    ```bash
    npm install
    ```
3.  Install backend dependencies:
    ```bash
    cd server
    npm install
    cd ..
    ```

### Running the Application

1.  Start the frontend development server:
    ```bash
    npm run dev
    ```
2.  Start the backend concatenation server:
    ```bash
    cd server
    npm start
    cd ..
    ```
    The application should now be accessible at `http://localhost:5173/`.

### Running Tests

-   **Unit Tests (Vitest)**:
    ```bash
    npm test
    ```
-   **End-to-End Tests (Playwright)**:
    ```bash
    npx playwright test
    ```

## Coding Guidelines

-   Follow existing code style and conventions.
-   Use TypeScript for all new code.
-   Ensure all new features have corresponding tests.
-   Keep components small and focused.
-   Write clear and concise comments where necessary.

## Commit Message Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification. This helps us maintain a consistent commit history and automate changelog generation.

Examples:

-   `feat: add new feature X`
-   `fix: correct bug Y`
-   `docs: update README with new instructions`
-   `refactor: improve performance of Z`
-   `test: add unit tests for A`

Thank you for your contributions!
