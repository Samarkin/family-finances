# Family Finances - Agent Navigation Guide

Welcome to the Family Finances project. This document provides a high-level overview of the codebase and instructions for contributing.

## Architecture & Goals

Read `docs/architecture.md` first. The project is a local-only financial tracker using React (client) and Node.js/Express/SQLite (server).
Refer to `docs/tasks.md` for the current roadmap and pending tasks.

## Project Structure

### Client (`/client`)

- **Pages**: `client/src/pages/` (Summary, Transactions, Preview, Files).
- **Components**: `client/src/components/` (Layout, reusable UI).
- **Tests**: `client/src/pages/__tests__/`.

### Server (`/server`)

- **Routes**: `server/src/routes/` (API endpoints).
- **Services**: `server/src/services/` (Business logic, CSV parsing).
- **Database**: `server/src/db/` (SQLite schema and connection).
- **Tests**: `server/src/__tests__/`, `server/src/services/__tests__/`.

## Standard Workflow

### Running the App

- `npm run dev`: Starts both client and server in development mode.

### Validation & Testing

- `npm test`: Runs all unit and integration tests for both client and server.
- `npm run lint`: Runs ESLint across the entire project.
- `npm run format`: Formats all files using Prettier.

## Engineering Mandates

1. **No Explicit `any`**: The use of `any` is strictly prohibited. Use proper TypeScript types or `unknown` with type guards. This is enforced by ESLint.
2. **Read Docs First**: Always review `docs/architecture.md` and `docs/tasks.md` before starting a new task.
3. **Local Only**: Avoid any cloud dependencies or CDNs. Everything must run locally.
4. **Validation**: Always run `npm run lint` and `npm test` before considering a task complete.
5. **Commiting**: Explore several recent commits to infer an established pattern for commit messages.
