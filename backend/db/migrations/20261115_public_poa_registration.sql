-- Approved schema change for the unauthenticated POA registration flow.
-- Apply once through the approved PostgreSQL migration process; CAP must not
-- auto-deploy or recreate these existing physical tables.
ALTER TABLE public."BTP_TBL_USERS"
  ADD COLUMN IF NOT EXISTS "DOCUMENT_TYPE" varchar(32),
  ADD COLUMN IF NOT EXISTS "DOCUMENT_NUMBER" varchar(32);

CREATE UNIQUE INDEX IF NOT EXISTS "ux_BTP_TBL_USERS_DOCUMENT_NUMBER"
  ON public."BTP_TBL_USERS" ("DOCUMENT_NUMBER")
  WHERE "DOCUMENT_NUMBER" IS NOT NULL;

CREATE TABLE IF NOT EXISTS public."GENERAL_TBL_TEMP_NAFATH" (
  "DOCUMENT_NUMBER" varchar(32) PRIMARY KEY,
  "DOCUMENT_TYPE" varchar(32),
  "VALIDATION_NAFATH_STATUS" varchar(32) NOT NULL,
  "CREATED_ON" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CREATED_BY" varchar(32),
  "API_RESP_JSON" varchar(5000),
  "API_TOKEN" varchar(3000),
  "CHANGED_ON" timestamptz,
  "CHANGED_BY" varchar(32),
  "LANGUAGE" varchar(10)
);

CREATE INDEX IF NOT EXISTS "ix_GENERAL_TBL_TEMP_NAFATH_CREATED_ON"
  ON public."GENERAL_TBL_TEMP_NAFATH" ("CREATED_ON");
