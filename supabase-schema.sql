-- ============================================================
-- PESA TRACKER — Supabase Schema
-- Run this entire file in your Supabase SQL Editor
-- ============================================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  password    TEXT NOT NULL,         -- bcrypt hashed
  role        TEXT DEFAULT 'user',   -- 'admin' | 'user'
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions
CREATE TABLE IF NOT EXISTS transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,         -- 'received' | 'sent' | 'disbursed'
  fund        TEXT,                  -- 'personal' | 'student'
  amount      NUMERIC NOT NULL,
  party       TEXT,
  phone       TEXT,
  date        TEXT,
  time        TEXT,
  category    TEXT,
  student_id  TEXT,
  student_name TEXT,
  note        TEXT,
  balance     NUMERIC,
  raw_sms     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Students
CREATE TABLE IF NOT EXISTS students (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  parent      TEXT,
  phone       TEXT,
  student_id  TEXT,
  internal_id TEXT,                  -- app-level _id
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Investments
CREATE TABLE IF NOT EXISTS investments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  type        TEXT,
  amount      NUMERIC NOT NULL,
  return_pct  NUMERIC DEFAULT 0,
  note        TEXT,
  date        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Budgets (one active budget per user)
CREATE TABLE IF NOT EXISTS budgets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  salary      NUMERIC NOT NULL,
  items       JSONB DEFAULT '[]',
  saved_at    TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_txs_user    ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_txs_created ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_students_user ON students(user_id);
CREATE INDEX IF NOT EXISTS idx_inv_user    ON investments(user_id);

-- Row Level Security (RLS) — users only see their own data
ALTER TABLE transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE students      ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets       ENABLE ROW LEVEL SECURITY;

-- We use service role key on server, so RLS is a safety net
-- These policies allow service role to bypass, and block direct anon access
CREATE POLICY "No direct anon access" ON transactions  FOR ALL TO anon USING (false);
CREATE POLICY "No direct anon access" ON students      FOR ALL TO anon USING (false);
CREATE POLICY "No direct anon access" ON investments   FOR ALL TO anon USING (false);
CREATE POLICY "No direct anon access" ON budgets       FOR ALL TO anon USING (false);
