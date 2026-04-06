# Contributing to Prompt Commerce

First off, thank you for considering contributing to Prompt Commerce! It's people like you that make this tool better for everyone.

## Code of Conduct

By participating in this project, you are expected to uphold our [Code of Conduct](CODE_OF_CONDUCT.md) (coming soon).

## How Can I Contribute?

### Reporting Bugs

- **Check for existing issues:** Before opening a new issue, please search the [Issue Tracker](https://github.com/smicapplab/prompt-commerce/issues) to see if the bug has already been reported.
- **Be descriptive:** Use a clear and descriptive title.
- **Provide reproduction steps:** Explain the exact steps to reproduce the problem.
- **Include environment details:** Mention your Node.js version, OS, and any relevant configuration.

### Suggesting Enhancements

- **Check existing suggestions:** See if someone else has already suggested it.
- **Explain the "Why":** Why would this enhancement be useful?
- **Describe the behavior:** How should it work?

### Pull Requests

1. **Fork the repo** and create your branch from `main`.
2. **Install dependencies:** `npm install` in the `prompt-commerce` directory.
3. **Make your changes:**
   - Follow the existing code style (see [Coding Standards](#coding-standards)).
   - Ensure your code is well-documented.
   - Add tests for new features or bug fixes.
4. **Test your changes:** Run the development server and verify the functionality.
5. **Submit a Pull Request:**
   - Link to any relevant issues.
   - Provide a clear description of what your PR does.
   - Keep PRs focused on a single change.

## Development Setup

Please refer to the [Getting Started](README.md#getting-started) section in the main README for detailed setup instructions.

### Tech Stack Refresher
- **Admin UI:** SvelteKit 5 (Svelte 5 Runes) + Tailwind CSS
- **Server:** Express + MCP SDK
- **Database:** Better-SQLite3

## Coding Standards

### Svelte 5 & Runes
We use **Svelte 5** and its **Runes** system (`$state`, `$derived`, `$effect`, etc.). Please avoid using legacy Svelte 4 syntax (like `export let` or `$:`) in new components.

### TypeScript
- Use TypeScript for all new code.
- Avoid using `any`; define proper interfaces or types.
- Ensure type safety across the MCP tool definitions.

### Database
- This project uses a **multi-file SQLite** architecture.
- Schema changes are managed in `src/mcp/db/migrate.ts` using `ALTER TABLE` statements with try/catch blocks for safe, idempotent re-runs.

### Git Commit Messages
- Use clear and concise commit messages.
- Prefer the [Conventional Commits](https://www.conventionalcommits.org/) format (e.g., `feat: add new MCP tool for reviews`, `fix: handle null values in product sync`).

## Questions?

If you have any questions, feel free to open a discussion or reach out to the maintainers.

Happy coding! 🚀
