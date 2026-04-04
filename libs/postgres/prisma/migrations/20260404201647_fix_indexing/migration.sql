-- DropIndex
DROP INDEX "api_keys_organizationId_idx";

-- DropIndex
DROP INDEX "api_keys_projectId_idx";

-- DropIndex
DROP INDEX "idx_projects_organization_id";

-- CreateIndex
CREATE INDEX "api_keys_projectId_deletedAt_idx" ON "api_keys"("projectId", "deletedAt");

-- CreateIndex
CREATE INDEX "api_keys_organizationId_deletedAt_idx" ON "api_keys"("organizationId", "deletedAt");

-- CreateIndex
CREATE INDEX "idx_projects_organization_id" ON "projects"("organizationId", "deletedAt");
