# CareLog Backend Installation Guide (Windows PowerShell)

## Prerequisites
- **Node.js** (v20 or later) and **npm** installed and available in `PATH`.
- **PostgreSQL** server (local or remote) reachable from your machine.
- **PowerShell** (included with Windows).

## Installation Steps
1. **Clone the repository** (skip if you already have the code locally):
   ```powershell
   git clone <repository-url> CareLog
   cd CareLog
   ```

2. **Enter the backend directory** (all subsequent commands are run from here):
   ```powershell
   cd backend
   ```

3. **Install backend dependencies**:
   ```powershell
   npm ci
   ```
   *`npm ci` performs a clean install based on `package-lock.json`.*

4. **Create a PostgreSQL database** named `carelog`.
   You can do this via one of two methods:
   - **pgAdmin 4**:
     1. Open pgAdmin and connect to your server.
     2. Right‑click **Databases → Create → Database…**
     3. Set **Name** to `carelog` and click **Save**.
   - **Command line** (if `createdb` is in your `PATH`):
     ```powershell
     createdb -U <your_pg_user> -h <your_pg_host> -p <your_pg_port> carelog
     ```
     Replace `<your_pg_user>`, `<your_pg_host>` and `<your_pg_port>` with your PostgreSQL credentials.

5. **Create an environment file** from the example and fill in your credentials:
   ```powershell
   copy .env.example .env
   ```
   Edit `.env` and set the five required variables:
   ```text
   DB_USER=your_db_user
   DB_HOST=your_db_host
   DB_NAME=carelog   # must match the database you created
   DB_PASSWORD=your_db_password
   DB_PORT=5432       # default PostgreSQL port
   PORT=3000          # optional, Express server port
   ```

6. **Apply the database schema** (creates tables if they do not exist):
   ```powershell
   node db\apply_schema.js
   ```
   The script validates the required `DB_*` variables and exits with a non‑zero status on any error.

7. **Seed demo data** (idempotent – safe to run repeatedly):
   ```powershell
   node db\seed.js
   ```

8. **Start the backend server**:
   ```powershell
   node server.js
   ```
   The API will be reachable at `http://localhost:$PORT/api/...` (default `http://localhost:3000/api`).

9. **Verify the server is healthy** (optional, requires `curl` or PowerShell `Invoke-WebRequest`):
   ```powershell
   curl http://localhost:$PORT/api/health
   # or
   Invoke-WebRequest http://localhost:$PORT/api/health
   ```

## Notes
- `apply_schema.js` now **strictly uses the five `DB_*` environment variables**; `DATABASE_URL` is not supported.
- `seed.js` uses an up‑sert approach for families to avoid duplicate demo families.
- All commands assume you are inside the `backend` folder; paths like `node db\apply_schema.js` are relative to that directory.
- No legacy `database/carelog_db.sql` file is referenced; the source of truth is `backend/db/schema.sql`.
