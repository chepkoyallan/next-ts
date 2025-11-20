-- Backfill NULL and invalid foreign keys before migration

-- Get first valid user ID
DO $$
DECLARE
    system_user_id TEXT;
BEGIN
    -- Get first admin user or first user
    SELECT u.id INTO system_user_id
    FROM users u
    INNER JOIN user_roles ur ON ur.user_id = u.id
    INNER JOIN roles r ON r.id = ur.role_id
    WHERE r.name IN ('admin', 'super-admin')
    ORDER BY u.created_at
    LIMIT 1;

    IF system_user_id IS NULL THEN
        SELECT users.id INTO system_user_id FROM users ORDER BY users.created_at LIMIT 1;
    END IF;

    -- Organizations
    UPDATE organizations
    SET owner_id = system_user_id
    WHERE owner_id IS NULL;

    -- Projects
    UPDATE projects
    SET created_by = system_user_id
    WHERE created_by IS NULL;

    -- Workflows
    UPDATE workflows
    SET created_by = system_user_id
    WHERE created_by IS NULL OR created_by NOT IN (SELECT id FROM users);

    -- Launch Plans
    UPDATE launch_plans
    SET created_by = system_user_id
    WHERE created_by IS NULL OR created_by NOT IN (SELECT id FROM users);

    -- Tasks
    UPDATE tasks
    SET created_by = system_user_id
    WHERE created_by IS NULL OR created_by NOT IN (SELECT id FROM users);

    -- Workflow Executions
    UPDATE workflow_executions
    SET created_by = system_user_id
    WHERE created_by IS NULL OR created_by NOT IN (SELECT id FROM users);

    -- Workflow Drafts
    UPDATE workflow_drafts
    SET created_by = system_user_id
    WHERE created_by IS NULL OR created_by NOT IN (SELECT id FROM users);

    UPDATE workflow_drafts
    SET deployed_by = system_user_id
    WHERE deployed_by IS NOT NULL AND deployed_by NOT IN (SELECT id FROM users);

    -- BMaaS Resources
    UPDATE bmaas_instances
    SET created_by = system_user_id
    WHERE created_by IS NULL OR created_by NOT IN (SELECT id FROM users);

    UPDATE bmaas_volumes
    SET created_by = system_user_id
    WHERE created_by IS NULL OR created_by NOT IN (SELECT id FROM users);

    UPDATE bmaas_networks
    SET created_by = system_user_id
    WHERE created_by IS NULL OR created_by NOT IN (SELECT id FROM users);

    UPDATE bmaas_buckets
    SET created_by = system_user_id
    WHERE created_by IS NULL OR created_by NOT IN (SELECT id FROM users);

    -- Connector Configs
    UPDATE connector_configs
    SET created_by = system_user_id
    WHERE created_by IS NULL OR created_by NOT IN (SELECT id FROM users);

    RAISE NOTICE 'Backfill complete with system user: %', system_user_id;
END $$;
