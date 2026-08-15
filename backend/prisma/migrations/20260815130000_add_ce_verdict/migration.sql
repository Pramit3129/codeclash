-- Repairs schema drift: `CE` was added to schema.prisma (and applied by hand
-- to the production database) but never captured as a migration.
--
-- Consequence in any environment rebuilt purely from migrations: the enum
-- lacks 'CE', so persisting a compile-error verdict fails with
--   invalid input value for enum "SubmissionVerdict": "CE"
-- and the submission never reaches a verdict.
--
-- IF NOT EXISTS keeps this a no-op on databases that already have the value.
ALTER TYPE "SubmissionVerdict" ADD VALUE IF NOT EXISTS 'CE';
