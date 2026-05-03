# Family Finances

A personal finance tracker built with Node.js, Express, React, and SQLite.

## Project Structure

- `client/`: React frontend built with Vite, Material-UI, and Recharts.
- `server/`: Express backend using better-sqlite3.
- `docs/`: Project documentation and tasks.

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm

### Installation

Install dependencies for all projects:

```bash
npm run install:all
```

### Development

Run both client and server in development mode:

```bash
npm run dev
```

The client will be available at `http://localhost:5173` and the server at `http://localhost:3001`.
Requests to `/api` from the client are automatically proxied to the server.

### Linting and Formatting

```bash
npm run lint
npm run format
```
