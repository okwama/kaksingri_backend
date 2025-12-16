# Backend Setup Guide

## Prerequisites

1. **Node.js** (v18 or higher)
2. **PostgreSQL Database** (Supabase, local, or cloud)
3. **npm** or **yarn**

## Database Setup

### Option 1: Supabase (Recommended) ⭐

See **[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)** for detailed Supabase setup instructions.

Quick steps:
1. Get your connection string from Supabase Dashboard > Project Settings > Database
2. Update `.env` with your `DATABASE_URL`
3. Run migrations: `npm run prisma:migrate`

### Option 2: Local PostgreSQL

1. **Install PostgreSQL** (if not already installed):
   ```bash
   # macOS (using Homebrew)
   brew install postgresql@14
   brew services start postgresql@14

   # Ubuntu/Debian
   sudo apt-get install postgresql postgresql-contrib

   # Windows
   # Download from https://www.postgresql.org/download/windows/
   ```

2. **Create Database**:
   ```bash
   # Connect to PostgreSQL
   psql postgres

   # Create database and user
   CREATE DATABASE kaksingri_db;
   CREATE USER kaksingri_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE kaksingri_db TO kaksingri_user;
   \q
   ```

3. **Update `.env` file**:
   ```env
   DATABASE_URL="postgresql://kaksingri_user:your_password@localhost:5432/kaksingri_db?schema=public"
   ```

### Option 2: Docker PostgreSQL

1. **Run PostgreSQL in Docker**:
   ```bash
   docker run --name kaksingri-postgres \
     -e POSTGRES_USER=kaksingri_user \
     -e POSTGRES_PASSWORD=your_password \
     -e POSTGRES_DB=kaksingri_db \
     -p 5432:5432 \
     -d postgres:14
   ```

2. **Update `.env` file**:
   ```env
   DATABASE_URL="postgresql://kaksingri_user:your_password@localhost:5432/kaksingri_db?schema=public"
   ```

### Option 3: Cloud Database (Supabase, Railway, etc.)

1. Create a PostgreSQL database on your preferred cloud provider
2. Copy the connection string to your `.env` file:
   ```env
   DATABASE_URL="your_cloud_database_connection_string"
   ```

## Installation Steps

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Generate Prisma Client**:
   ```bash
   npm run prisma:generate
   ```

3. **Run Database Migrations**:
   ```bash
   npm run prisma:migrate
   ```
   This will create all the database tables based on the Prisma schema.

4. **(Optional) Seed Database**:
   ```bash
   # If you have a seed script
   npm run prisma:seed
   ```

5. **Start Development Server**:
   ```bash
   npm run start:dev
   ```

The API will be available at:
- **API**: http://localhost:3001
- **Swagger Docs**: http://localhost:3001/api/docs

## Creating Initial Admin User

After running migrations, you can create an admin user via Prisma Studio:

```bash
npm run prisma:studio
```

Or create a seed script to automatically create an admin user.

## Environment Variables

Copy `.env.example` to `.env` and update the values:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/kaksingri_db?schema=public"

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# Server
PORT=3001
NODE_ENV=development

# CORS
CORS_ORIGIN=http://localhost:8080
```

## Troubleshooting

### Prisma Client Generation Fails
- Make sure `DATABASE_URL` is set in `.env`
- Try: `rm -rf node_modules/.prisma node_modules/@prisma/client && npm install`

### Database Connection Errors
- Verify PostgreSQL is running: `pg_isready` or `docker ps`
- Check connection string format
- Ensure database exists: `psql -l` or check via database client

### Migration Errors
- Make sure database is empty or use `--force` flag (⚠️ deletes all data)
- Check Prisma schema for syntax errors

