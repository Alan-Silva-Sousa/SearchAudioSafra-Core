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

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS perfil VARCHAR NOT NULL DEFAULT 'usuario';

CREATE INDEX IF NOT EXISTS idx_users_external_identity
  ON public.users ("externalId", "authProvider");
