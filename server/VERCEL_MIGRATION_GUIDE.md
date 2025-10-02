# Migration to Vercel Postgres - Complete Guide

This guide will help you migrate your spy game application from local PostgreSQL to Vercel Postgres.

## ✅ What's Already Done

Your repository is already configured with:
- ✅ Vercel Postgres support in `vercel-server.js`
- ✅ Database setup script `setup-vercel.js`
- ✅ Updated `package.json` with `@vercel/postgres` dependency
- ✅ Updated scripts for Vercel Postgres
- ✅ Updated `env.example` with Vercel configuration

## 🔧 Steps to Complete Migration

### Step 1: Get Your Vercel Postgres Connection String

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Navigate to your project
3. Go to the "Storage" tab
4. Click on your Postgres database
5. Go to the "Connect" tab
6. Copy the "Connection String" (looks like: `postgres://username:password@host:port/database?sslmode=require`)

### Step 2: Create Your Environment File

Create a `.env` file in the `/server` directory:

```bash
cd server
cp env.example .env
```

Then edit the `.env` file and replace the placeholder with your actual Vercel Postgres connection string:

```bash
# Replace this line with your actual connection string
POSTGRES_URL=postgres://your_actual_connection_string_here
```

### Step 3: Set Up the Database Schema

Run the Vercel database setup script:

```bash
cd server
npm run setup-db-vercel
```

This will:
- Create all necessary tables
- Insert sample users and missions
- Set up indexes for performance

### Step 4: Start the Server with Vercel Postgres

Use the Vercel-specific server:

```bash
# For production
npm run start:vercel

# For development with auto-reload
npm run dev:vercel
```

### Step 5: Test the Application

1. Your frontend should work at `http://localhost:5173`
2. The backend will now use Vercel Postgres instead of local PostgreSQL
3. Test the login functionality and mission system

## 🔄 Switching Between Databases

- **Local PostgreSQL**: Use `npm start` or `npm run dev`
- **Vercel Postgres**: Use `npm run start:vercel` or `npm run dev:vercel`

## 🚀 Deployment to Vercel

When ready to deploy:

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Set the `POSTGRES_URL` environment variable in Vercel dashboard
4. Deploy!

## 🛠️ Troubleshooting

### Connection Issues
- Verify your `POSTGRES_URL` is correct
- Check that your Vercel Postgres database is active
- Ensure all environment variables are set

### Database Setup Issues
- Make sure you have the correct permissions
- Check the server logs for specific error messages
- Verify the database exists in Vercel

### Performance
- Vercel Postgres has connection limits on the free tier
- Consider upgrading if you need more connections

## 📊 Benefits of Vercel Postgres

- ✅ No local database setup required
- ✅ Automatic backups and scaling
- ✅ Accessible from anywhere
- ✅ Built-in connection pooling
- ✅ Easy deployment to Vercel
- ✅ Free tier available

## 🔍 Verification

To verify everything is working:

1. Check server logs for "Connected to Vercel Postgres database"
2. Test API endpoints: `http://localhost:3001/api/health`
3. Test user login functionality
4. Test mission assignment and completion

## 📝 Notes

- The `vercel-server.js` automatically detects if `POSTGRES_URL` is available
- If `POSTGRES_URL` is not set, it falls back to local PostgreSQL
- All existing functionality remains the same
- No changes needed to the frontend code
