-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "public"."audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_project_id_idx" ON "public"."audit_logs"("project_id");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "public"."audit_logs"("timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "public"."audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_resource_idx" ON "public"."audit_logs"("resource");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_timestamp_idx" ON "public"."audit_logs"("user_id", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_project_id_timestamp_idx" ON "public"."audit_logs"("project_id", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_action_timestamp_idx" ON "public"."audit_logs"("action", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_resource_timestamp_idx" ON "public"."audit_logs"("resource", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "connector_configs_organization_id_created_at_idx" ON "public"."connector_configs"("organization_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "connector_configs_organization_id_type_status_idx" ON "public"."connector_configs"("organization_id", "type", "status");

-- CreateIndex
CREATE INDEX "projects_organization_id_created_at_idx" ON "public"."projects"("organization_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "projects_organization_id_is_archived_idx" ON "public"."projects"("organization_id", "is_archived");

-- CreateIndex
CREATE INDEX "projects_created_by_deleted_at_idx" ON "public"."projects"("created_by", "deleted_at");
