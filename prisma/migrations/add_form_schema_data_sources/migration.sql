-- Add dataSources and dependencies fields to form_schemas table
ALTER TABLE "form_schemas" ADD COLUMN "data_sources" JSONB;
ALTER TABLE "form_schemas" ADD COLUMN "dependencies" JSONB;

-- Add comment for documentation
COMMENT ON COLUMN "form_schemas"."data_sources" IS 'Data source configurations for form fields (EnhancedFormSchema.dataSources)';
COMMENT ON COLUMN "form_schemas"."dependencies" IS 'Field dependencies for dynamic form behavior';
