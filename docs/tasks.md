# Family Finances – Project Roadmap

This document outlines the prioritized, atomic tasks for the Family Finances application.

## Phase 1: Foundational Infrastructure

- [x] **1.1 Project Scaffolding**: Initialize the project structure and development environment.
  - **Requirements**:
    - Create a project structure with separate `client` and `server` directories.
    - Configure TypeScript for both environments using ESM.
    - Set up ESLint and Prettier for consistent code style across the project.
    - Initialize the `client` using Vite, React, Material-UI, and Recharts.
    - Configure a Vite proxy to forward `/api` requests to the backend server.
    - Initialize the `server` using Node.js, Express, and `better-sqlite3`.
    - Add root-level scripts to install dependencies and run both environments concurrently.
    - Create a root `README.md` with setup and execution instructions.
- [x] **1.2 Database Schema & Initialization**: Create SQLite schema and an initialization script.
  - **Requirements**:
    - Implement a single script (`server/src/db/init.ts`) that initializes the SQLite database.
    - Create all tables defined in the architecture: `File`, `Person`, `Account`, `Transaction`, `FileStage`, `TransactionStage`, and `CategoryMapping`.
    - Ensure all foreign key constraints are correctly defined.
    - Implement the `Hash` primary key for transactions (Month-Day-Description-Amount-AccountId).
    - Seed the `Person` table with a single entry: `{ Name: "Family" }`.
    - Ensure the script is idempotent (safe to run multiple times).
    - Store the database file in a `server/data/` directory.
  - _Note_: Categories are hardcoded in the application logic, not stored in the DB.
- [ ] **1.3 Backend Core**: Express server setup and database integration.
  - **Requirements**:
    - Initialize the Express application in `server/src/index.ts`.
    - Create a database connection utility that supports both a persistent file-based database and an in-memory (`:memory:`) database for testing.
    - Implement a `GET /api/status` endpoint that returns the database connection status.
    - Enable JSON request parsing.
    - Set up a global error handler for all routes.
    - Use environment variables for configuration (e.g., `PORT`, `DB_PATH`).

## Phase 2: Ingestion Pipeline

- [ ] **2.1 CSV Parsing Logic**: Service using Papa Parse to normalize varied bank formats.
- [ ] **2.2 Upload & Stage API (`POST /upload`)**: Accept CSV, parse, and save to staging tables.
- [ ] **2.3 Basic Preview UI**: React page for file selection and upload.
- [ ] **2.4 Preview API & Duplicate Detection**: Implement `GET /preview/<ID>` with hash calculation and sign inversion.
- [ ] **2.5 Data Commitment (`POST /submit`)**: Logic to move unique transactions from staging to main tables.

## Phase 3: Core Visibility

- [ ] **3.1 Transactions API & Table**: `GET /transactions` with filtering and a display table.
- [ ] **3.2 Files Management**: `GET /files` and `POST /files/<id>/delete`.

## Phase 4: Spending Analytics

- [ ] **4.1 Summary Aggregation API**: `GET /summary` for monthly totals and category data.
- [ ] **4.2 Dashboard Charts**: Implement Summary page with Recharts (Pie and Stacked Area).
- [ ] **4.3 Legend & Interaction**: Global category filter via legend.

## Phase 5: Refinement & Automation

- [ ] **5.1 Heuristic Guessing**: Regex-based auto-assignment of Account, Category, and Person.
- [ ] **5.2 Bulk Updates UI**: Multi-select and bulk-edit on the Preview page.
- [ ] **5.3 Deep Linking**: Navigation from charts to filtered Transaction views.
