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
- [x] **1.3 Backend Core**: Express server setup and database integration.
  - **Requirements**:
    - Initialize the Express application in `server/src/index.ts`.
    - Create a database connection utility that supports both a persistent file-based database and an in-memory (`:memory:`) database for testing.
    - Implement a `GET /api/status` endpoint that returns the database connection status.
    - Enable JSON request parsing.
    - Set up a global error handler for all routes.
    - Use environment variables for configuration (e.g., `PORT`, `DB_PATH`).

## Phase 2: Ingestion Pipeline

- [x] **2.1 CSV Parsing Service**: Implement normalization logic for varied bank formats.
  - **Requirements**:
    - Use `papaparse` for robust CSV parsing on the server.
    - Implement a normalization service that maps different bank column headers (e.g., "Transaction Date", "Date", "Description", "Amount ($)", "Debit", "Credit") to a standard internal format.
    - Handle date parsing for various common formats.
    - Support multi-column amount formats (Debit/Credit) and normalize them into a single signed amount.
    - Implement basic heuristic detection for Account and Person based on CSV columns like "Account No." or "Card Member".
- [x] **2.2 Upload & Stage API (`POST /api/upload`)**: Accept CSV files and save to staging tables.
  - **Requirements**:
    - Implement the `POST /api/upload` endpoint using `multer` for file handling.
    - Store file metadata in the `FileStage` table.
    - Use the CSV Parsing Service to process the file and populate the `TransactionStage` table with raw data.
    - Return the `FileStageId` to the client for subsequent preview.
- [x] **2.3 Basic Preview UI**: React page for file upload and initial staging view.
  - **Requirements**:
    - Create a `PreviewPage` component in the client.
    - Implement a drag-and-drop upload zone on the `TransactionsPage`.
    - Handle navigation to the `PreviewPage` after a successful upload.
    - Display the filename and a basic table of staged transactions.
- [x] **2.4 Preview API & Refinement**: Implement preview logic with duplicate detection.
  - **Requirements**:
    - Implement `GET /api/preview/:id` to fetch staged data.
    - Implement hash calculation (Month-Day-Description-Amount-AccountId) for duplicate detection against the main `Transaction` table.
    - Implement `PUT /api/preview/:id/sign` to toggle sign inversion for the entire file.
    - Implement `PUT /api/preview/:id/account` to associate an account with the staged file.
    - Implement `POST /api/preview/:id/bulk-update` for batch assigning Category and Person to selected staged rows.
- [x] **2.5 Bulk Updates UI**: Multi-select and bulk-edit on the Preview page.
  - **Requirements**:
    - Implement row selection in the Material-UI table on the `PreviewPage`.
    - Add a toolbar or action section that appears when rows are selected.
    - Provide dropdowns to select Category and Person for the selected rows.
    - Call `POST /api/preview/:id/bulk-update` when the user applies the changes.
    - Update the local state or re-fetch data after a successful bulk update.
- [x] **2.6 Data Commitment**: Move unique transactions from staging to main tables.
  - **Requirements**:
    - Implement the `POST /api/preview/:id/submit` endpoint.
    - Validate that all mandatory fields (Account, Category, Person) are present for all staged rows.
    - Use a single SQL transaction to:
      - Create a new entry in the `File` table.
      - Move non-duplicate transactions from `TransactionStage` to the main `Transaction` table.
      - Delete the staged data from `FileStage` (cascade delete should handle `TransactionStage`).
    - Implement `POST /api/preview/:id/discard` to allow explicitly deleting staged data without committing.

## Phase 3: Core Visibility

- [x] **3.1 Transactions API & Table**: `GET /transactions` with filtering and a display table.
  - **Requirements**:
    - Implement `GET /api/transactions` with pagination, and optional month/person filtering.
    - Update `TransactionsPage.tsx` to display transactions using MUI `DataGrid`.
    - Add a dropdown to filter by month or "All Time" and support deep linking by month via URL parameters.
    - Display summary headers: total transactions, total spent, and total earned.
    - Add server integration tests and client component tests.
- [x] **3.2 Files Management**: `GET /files` and `POST /files/<id>/delete`.
  - **Requirements**:
    - Implement `GET /api/files` returning all non-staged files with account names and transaction date ranges.
    - Implement `GET /api/preview-files` following the same format, but returning files from `FileStage`.
    - Implement `POST /api/files/:id/delete` with cascade delete for transactions.
    - Update `FilesPage.tsx` to list files. Explicitly mark files from `FileStage` as "in review" and add a link to the preview page.
    - Add a delete action with a confirmation dialog. Use `POST /api/preview/:id/discard` for staged files and `POST /api/files/:id/delete` for committed files.
    - Add server integration tests and client component tests.

## Phase 4: Spending Analytics

- [x] **4.1 Summary Aggregation API**: `GET /summary` for monthly totals and category data.
  - **Requirements**:
    - Implement `GET /api/summary` to return aggregated transaction data grouped by month and category.
    - Data should cover the last 12 months with activity.
    - The response must include a list of categories (id, name, color) to define the order of the spending arrays.
    - For each month, provide:
      - An array of total amounts per category (ordered by the categories list).
      - Total spent (sum of positive amounts).
      - Total earned (sum of negative amounts).
      - Transaction count.
    - Calculate and return global totals (all-time spent, earned, transaction count).
    - Add integration tests verifying the aggregation logic across various transaction dates and amounts.
- [x] **4.2 Dashboard Charts**: Implement Summary page with Recharts (Pie and Stacked Area).
  - **Requirements**:
    - Create `SummaryPage.tsx` and integrate it into the main layout.
    - Use `recharts` to implement:
      - A Pie chart for total spendings (all time).
      - A Pie chart for last month's spendings.
      - A Stacked Area chart for the 12-month spending trend.
    - Ensure all charts share the same color scheme per category.
    - Display summary cards/headers showing total spent, total earned, and transaction count for the selected period (or all time).
    - Implement click handlers on charts to navigate to `TransactionsPage` with appropriate month filters.
    - Handle the "no data" state with a friendly placeholder or message.
- [ ] **4.3 Legend & Interaction**: Global category filter via legend.
  - **Requirements**:
    - Implement a custom legend component that controls the visibility of categories across all three charts.
    - Clicking a category in the legend should toggle its visibility.
    - Filtered-out categories should be hidden from the charts, but summary totals (spent/earned/count) should **not** be recalculated.
    - Ensure the legend state is consistent across the page's lifecycle.
    - Add unit and component tests for the filtering logic and interaction.

## Phase 5: Refinement & Automation

- [ ] **5.1 Heuristic Guessing**: Regex-based auto-assignment of Account, Category, and Person.
- [ ] **5.2 Exclude Payments**: Add an option to exclude payments and transfers from all views and graphs, since the money is neither earned nor spent.
- [ ] **5.3 Account Table**: Add a UI page with the table of account-month mapping to quickly see which files were not uploaded yet.
