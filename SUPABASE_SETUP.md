# Supabase Setup Guide

## Getting Your Supabase Connection String

1. **Go to your Supabase Dashboard**: https://app.supabase.com

2. **Select your project** (or create a new one)

3. **Navigate to Project Settings**:
   - Click on the gear icon (⚙️) in the left sidebar
   - Or go to: Project Settings > Database

4. **Get the Connection String**:
   - Scroll down to "Connection string"
   - Select the "URI" tab
   - Copy the connection string
   - It will look like:
     ```
     postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
     ```

5. **Replace `[YOUR-PASSWORD]`**:
   - The password is your database password (not your Supabase account password)
   - If you don't know it, you can reset it in: Project Settings > Database > Database password
   - Or find it in: Project Settings > Database > Connection string (it shows the password)

6. **Update `.env` file**:
   ```env
   DATABASE_URL="postgresql://postgres:YOUR_ACTUAL_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres"
   ```

## Alternative: Using Connection Pooling (Recommended for Production)

Supabase also provides a connection pooling URL which is better for serverless/server environments:

1. In the Connection string section, select the "Session" or "Transaction" mode
2. Use the pooled connection string:
   ```
   postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
   ```

## Running Migrations

Once your `.env` file is updated with the correct `DATABASE_URL`:

1. **Generate Prisma Client** (if not already done):
   ```bash
   npm run prisma:generate
   ```

2. **Create and run migrations**:
   ```bash
   npm run prisma:migrate
   ```
   - This will create all the database tables in your Supabase database
   - You'll be prompted to name the migration (e.g., "init")

3. **Verify in Supabase Dashboard**:
   - Go to: Table Editor in your Supabase dashboard
   - You should see all the tables created (users, products, orders, etc.)

## Optional: Using Supabase Studio

You can also use Prisma Studio to view/edit your data:

```bash
npm run prisma:studio
```

This opens a local web interface at `http://localhost:5555` to browse your database.

## Security Notes

- **Never commit your `.env` file** (it's already in `.gitignore`)
- **Use environment variables** in production
- **Enable Row Level Security (RLS)** in Supabase if needed for direct client access
- **Use connection pooling** for production deployments

## Troubleshooting

### Connection Refused
- Verify your connection string is correct
- Check that your IP is allowed in Supabase (Settings > Database > Connection pooling)
- Supabase allows all IPs by default, but check if you have restrictions

### Authentication Failed
- Double-check your database password
- Make sure you're using the database password, not your Supabase account password
- Reset the password if needed: Project Settings > Database > Database password

### SSL Required
- Supabase requires SSL connections
- Prisma handles this automatically, but if you get SSL errors, add `?sslmode=require` to your connection string

### Migration Errors
- Make sure the database is empty or use `--force` flag (⚠️ deletes all data)
- Check Prisma schema for syntax errors
- Verify you have the correct permissions on the database

## Next Steps

After migrations are complete:

1. **Start the backend server**:
   ```bash
   npm run start:dev
   ```

2. **Test the API**:
   - API: http://localhost:3001
   - Swagger Docs: http://localhost:3001/api/docs

3. **Create an admin user** (via API or Prisma Studio):
   ```bash
   # Using Prisma Studio
   npm run prisma:studio
   # Then manually create a user in the users table
   ```

   Or create a seed script to automatically create an admin user.

