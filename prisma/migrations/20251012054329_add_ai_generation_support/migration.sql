-- AlterTable
ALTER TABLE "public"."task_definitions" ADD COLUMN     "function_name" TEXT NOT NULL DEFAULT 'process_data',
ADD COLUMN     "input_type_name" TEXT NOT NULL DEFAULT 'InputType',
ADD COLUMN     "output_type_name" TEXT NOT NULL DEFAULT 'OutputType',
ADD COLUMN     "parameter_name" TEXT NOT NULL DEFAULT 'input_data';

-- CreateTable
CREATE TABLE "public"."ai_provider_keys" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "key_name" TEXT NOT NULL,
    "encrypted_key" TEXT NOT NULL,
    "model" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "last_used_at" TIMESTAMP(3),
    "total_cost_usd" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "last_tested_at" TIMESTAMP(3),
    "test_status" TEXT,
    "test_error" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_provider_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_generation_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "task_id" TEXT,
    "provider_key_id" TEXT NOT NULL,
    "generation_type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "user_description" TEXT,
    "generated_code" TEXT NOT NULL,
    "input_schema" JSONB,
    "output_schema" JSONB,
    "function_name" TEXT,
    "existing_code" TEXT,
    "tokens_used" INTEGER NOT NULL,
    "prompt_tokens" INTEGER,
    "completion_tokens" INTEGER,
    "cost_usd" DECIMAL(10,6) NOT NULL,
    "generation_time_ms" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "error_message" TEXT,
    "error_code" TEXT,
    "was_accepted" BOOLEAN,
    "user_rating" INTEGER,
    "user_feedback" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_generation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_provider_keys_user_id_idx" ON "public"."ai_provider_keys"("user_id");

-- CreateIndex
CREATE INDEX "ai_provider_keys_organization_id_idx" ON "public"."ai_provider_keys"("organization_id");

-- CreateIndex
CREATE INDEX "ai_provider_keys_provider_idx" ON "public"."ai_provider_keys"("provider");

-- CreateIndex
CREATE INDEX "ai_provider_keys_is_default_idx" ON "public"."ai_provider_keys"("is_default");

-- CreateIndex
CREATE INDEX "ai_provider_keys_is_active_idx" ON "public"."ai_provider_keys"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "ai_provider_keys_user_id_provider_key_name_key" ON "public"."ai_provider_keys"("user_id", "provider", "key_name");

-- CreateIndex
CREATE INDEX "ai_generation_logs_user_id_idx" ON "public"."ai_generation_logs"("user_id");

-- CreateIndex
CREATE INDEX "ai_generation_logs_organization_id_idx" ON "public"."ai_generation_logs"("organization_id");

-- CreateIndex
CREATE INDEX "ai_generation_logs_task_id_idx" ON "public"."ai_generation_logs"("task_id");

-- CreateIndex
CREATE INDEX "ai_generation_logs_provider_key_id_idx" ON "public"."ai_generation_logs"("provider_key_id");

-- CreateIndex
CREATE INDEX "ai_generation_logs_provider_idx" ON "public"."ai_generation_logs"("provider");

-- CreateIndex
CREATE INDEX "ai_generation_logs_generation_type_idx" ON "public"."ai_generation_logs"("generation_type");

-- CreateIndex
CREATE INDEX "ai_generation_logs_success_idx" ON "public"."ai_generation_logs"("success");

-- CreateIndex
CREATE INDEX "ai_generation_logs_created_at_idx" ON "public"."ai_generation_logs"("created_at");

-- CreateIndex
CREATE INDEX "ai_generation_logs_user_id_created_at_idx" ON "public"."ai_generation_logs"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ai_generation_logs_organization_id_created_at_idx" ON "public"."ai_generation_logs"("organization_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "public"."ai_generation_logs" ADD CONSTRAINT "ai_generation_logs_provider_key_id_fkey" FOREIGN KEY ("provider_key_id") REFERENCES "public"."ai_provider_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE;
