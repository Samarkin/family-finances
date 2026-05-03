# Family Finances – Architecture document

A browser-based local application to analyze family spending trends.

## High-level design tenets

- Single-user web application – single-tenant database, no authentication
- The server is intended to run on the same machine and not exposed to the internet – no need for complex security, no authorization, no protection against malicious input
- Local processing – avoid cloud-based services or CDN
- Data is stored in a database on the server-side
- No persistence of non-recoverable data on the client-side (cache and settings are okay)
- Source of the data is user-uploaded CSV files – files originate from different accounts and will have different formats
- No internationalization or localization
- Expected to add around 1K transactions per year, so considering that server is local pagination becomes low priority

## Tech Stack

- Full-stack TypeScript
- Front-end: React, Vite, Material-UI, Recharts
- Back-end: Node.js, Express, Papa Parse
- Database: SQLite
- Validation: ESLint, Prettier
- Testing: Jest, React Testing Library

## UI

Web-interface.

### Summary page

This is the first page user will see (i.e. `/` endpoint).

Displays 3 graphs:
1. Pie-chart of total spendings in the database (by category).
2. Pie-chart of spendings last month (by category).
3. Stacked area chart of spendings in the past 12 months. Horizontal axis – months, vertical axis – money, separated by category.

Every chart is accompanied by the total number of transactions shown, total amount of money spent and total amount of money earned. Categories with negative spending will be considered income.
Graphs use different color for each category, the colors are persisted in the configuration file on the server.
Click on a pie-chart takes to the transactions page – with either all transactions, or only for one month (depending on which pie-chart was clicked).
There is a single legend for all three graphs. Clicking on the categories in the legend hides that particular category from all three graphs.
There is an edge case where any number could be negative. Display does not have to be pretty, 
Gracefully handles the case of no transactions yet.

### Transactions page

Lists all transactions.
Includes a dropdown to select either one month, or "All Time".
Supports deep linking to a specific month, to be used from the summary page.
Includes upload drag-n-drop section – clicking there opens a File Open dialog. Dropping a file there starts upload. After upload is finished, navigates to the Preview page (see below).
Includes total number of transactions, total money spent and total money earned for the selected period.

### Preview page

Lists transactions from a selected staged file.
File selection is only via deep linking, no dropdown for file.
Includes drop-down to assign or update associated account.
Includes a way to invert sign of all transactions. It is needed because of inconsistencies of how diffent banks report amount.
Displays total number of transactions in the file, and the total number of duplicates.
Every transaction shows all fields from the database, plus a dynamically calculated on the server side "Duplicate" flag.
Table of transactions supports multi-select.
There must be a way to update category and person for the selected rows.
At the bottom of the page, two buttons – submit and discard.

### Files page
Lists all files that are present in the transactions table.
For every file displays the original filename, account name and transaction range.
Allows deleting individual files.

## Server

### Database
| File         |
|--------------|
| FileId PK    |
| Filename     |
| AccountId FK |

| Person      |
|-------------|
| PersonID PK |
| Name UNIQUE |
| MemberRegex |

| Account                 |
|-------------------------|
| AccountID PK            |
| Name UNIQUE             |
| FilenameRegex NULL      |
| Sign BOOL               |
| AccountRegex NULL       |
| DefaultPersonId FK NULL |

| Transaction  | Comment        |
|--------------|----------------|
| Hash PK      | Calculated from Month + "-" + Day + Description + Amount + AccountId |
| Month        | e.g. "2025-04" |
| DayOfMonth   |                |
| Description  |                |
| CategoryId   |                |
| Amount       |                |
| AccountId FK |                |
| FileId FK    |                |
| PersonId FK  |                |

| FileStage         |
|-------------------|
| FileStageId PK    |
| Filename          |
| Sign BOOL         |
| AccountId FK NULL |

| TransactionStage      | Comment           |
|-----------------------|-------------------|
| TransactionStageId PK |                   |
| Hash                  | Should use exactly the same algorithm as for the Transaction table |
| Date                  | e.g. "2025-04-23" |
| Description           | Exactly as present in the input CSV         |
| Amount                | Exactly as present in the input CSV         |
| RawCategory NULL      | Exactly as present in the input CSV, if any |
| CategoryId NULL       |                   |
| FileStageId FK        |                   |
| PersonId FK NULL      |                   |

| CategoryMapping |
|-----------------|
| CategoryId      |
| CategoryRegex NULL |
| DescriptionRegex NULL |
| AccountId FK NULL |

### Categories

Categories will be hard-coded on the server.
Each category will have an associated color.
```
export const categories = {
    "salary": { "name": "Salary", "color": "#7f7f7f" },
    "stock": { "name": "Stock", "color": "#7faf7f" },
    "food": { "name": "Food & Drinks", "color": "#ff3c00" },
    ...
]
```

### CSV Parsing

The input CSV files are downloaded directly from the financial institution websites, so they do not follow any specific format.
Some banks use all-upper column names, so we should use case-insensitive comparison.
For the date, we prefer to use transaction date, which is provided by most banks in the "Transaction Date" or "Date" column. "Posted Date" should be used as a backup.
All banks provide "Description" column.
Amount is stored very differently. Some banks have a single "Amount", "Amount (USD)" or "Amount ($)" column that contains a single number – either positive for spendings and negative for payments, or the exact opposite (which is why we have a sign inversion mechanism). Other banks use two separate columns – "Debit" for spendings and "Credit" for payments.
Account id could be found in "Card No.", "Account No." or "Account #" columns, and if present should be used to try to guess an account.
Person name could be found in "Purchased By" or "Card Member" columns, and if present should be used instead of a default person for account.

### API

#### `GET /summary`
```
{
    "data": [ // ordered by month
        { "month": "2025-04", "spendings": [3100, 2000, -30, ...] },
        { "month": "2025-05", "spendings": [3200, 583, 300, ...] },
        ...
    ],
    "categories": [ // same count and order as the "spendings" field in data
        { "id": "food", "name": "Food & Drinks", "color": "#ff3c00" },
        ...
    ]
}
```

#### `GET /transactions`
| Parameter | Comment  |
|-----------|----------|
| month     | Optional, e.g. "2024-05" |
| personId  | Optional |
| offset    | Optional, defaults to 0 |
| count     | Mandatory |
```
{
    "data": [
        ...
    ],
    "totalCount": 12345
}
```


#### `POST /upload`
Accepts both file name and content (CSV).
Applies filename regexes to try to guess account id. Leaves blank (and sets Sign=FALSE) if cannot.
Applies mappings from CategoryMapping to try to guess category id. Leaves blank if cannot.
Adds raw content to the stage tables.
Returns FileStageId.

#### `GET /preview/<ID>`
Queries FileStage and TransactionStage.
Calculates number of duplicates (based on hash), and range (based on Year-Month).
Inverts sign of all transactions if Sign is TRUE.
Only returns non-duplicated transactions.

#### `POST /preview/<ID>/submit`
Verifies all fields, returns error with explanation if something is missing.
Moves data that is not duplicated from the stage tables to the main ones.

#### `POST /preview/<ID>/discard`
Deletes row from FileStage, causing cascade delete for TransactionStage.

#### `POST /preview/<ID>/bulk-update`
Input:
```
{
    "ids": [ ... ], // transaction id's, treat as "All transaction in this file" if missing or empty
    "category": "...", // optional
    "person": "..." // optional
}
```
Output – same as `GET /preview/<ID>`.

#### `PUT /preview/<ID>/sign`
#### `PUT /preview/<ID>/account`

#### `GET /files`
```
{
    "data": [
        { "id": 1, "filename": "transactions.csv", "accountId": 4, "range": "2024-05:2025-12" }
    ],
    "accounts": [
        { "id": 4, "name": "Acme Credit Card" }
    ]
}
```

#### `POST /files/<ID>/delete`

## Testing

1. Unit-tests only for complex logic
2. Integration tests for every API including testing SQL layer, but not necessarily serialization/deserialization. Server must have an option for using an in-memory SQLite database.
3. End-to-end testing (using Playwright) is lowest priority.
4. No need to automate performance or security tests, although we should ensure the service does not crash on bad CSV input.
