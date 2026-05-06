ALTER TABLE "agent_policies" ADD COLUMN "effect" text NOT NULL DEFAULT 'allow';
DROP INDEX IF EXISTS "uq_agent_policies_resource";
CREATE UNIQUE INDEX "uq_agent_policies_resource" ON "agent_policies" ("agent_id", "resource_type", "resource_key", "effect");
