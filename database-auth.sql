CREATE TABLE IF NOT EXISTS public.users (
  id SERIAL PRIMARY KEY,
  email VARCHAR NOT NULL UNIQUE,
  "passwordHash" VARCHAR,
  "externalId" VARCHAR,
  "authProvider" VARCHAR NOT NULL DEFAULT 'local',
  "displayName" VARCHAR,
  "createdAt" TIMESTAMP NOT NULL,
  "lastLogin" TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_external_identity
  ON public.users ("externalId", "authProvider");
