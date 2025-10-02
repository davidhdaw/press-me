# Vercel Postgres Setup Guide

This guide will help you set up your spy game application to use Vercel Postgres instead of a local PostgreSQL database.

## Prerequisites

1. A Vercel account (free tier available)
2. Your application code (already set up)

## Step 1: Create a Vercel Postgres Database

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click on your project or create a new one
3. Go to the "Storage" tab
4. Click "Create Database" → "Postgres"
5. Choose a name for your database (e.g., "spy-database")
6. Select a region close to you
7. Click "Create"

## Step 2: Get Your Database Connection String

1. In your Vercel dashboard, go to your database
2. Click on the "Connect" tab
3. Copy the "Connection String" (it looks like: `postgres://username:password@host:port/database?sslmode=require`)

## Step 3: Set Up Environment Variables

Create a `.env` file in the `/server` directory with your Vercel Postgres connection string:

```bash
# Vercel Postgres Configuration
POSTGRES_URL=postgres://username:password@host:port/database?sslmode=require
```

## Step 4: Set Up the Database Schema

Run the Vercel-specific setup script:

```bash
cd server
npm run setup-db-vercel
```

This will:
- Create all necessary tables
- Insert sample users and missions
- Set up indexes for performance

## Step 5: Start the Server

Use the Vercel-specific server:

```bash
npm run start:vercel
```

## Step 6: Test the Application

1. Your frontend should still work at `http://localhost:5173`
2. The backend will now use Vercel Postgres instead of local PostgreSQL
3. You can access the application from other devices using your IP address

## Benefits of Using Vercel Postgres

- ✅ No local database setup required
- ✅ Automatic backups and scaling
- ✅ Accessible from anywhere
- ✅ Built-in connection pooling
- ✅ Easy deployment to Vercel
- ✅ Free tier available

## Switching Between Local and Vercel Postgres

- **Local PostgreSQL**: Use `npm start` (requires local PostgreSQL running)
- **Vercel Postgres**: Use `npm run start:vercel` (requires POSTGRES_URL environment variable)

## Deployment to Vercel

When you're ready to deploy:

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Vercel will automatically detect your Node.js application
4. Set the `POSTGRES_URL` environment variable in Vercel dashboard
5. Deploy!

## Troubleshooting

- Make sure your `POSTGRES_URL` is correct
- Check that your Vercel Postgres database is active
- Verify that all environment variables are set
- Check the server logs for connection errors
