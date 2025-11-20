-- CreateEnum
CREATE TYPE "public"."bmaas_instance_status" AS ENUM ('PENDING', 'BUILDING', 'ACTIVE', 'PAUSED', 'SUSPENDED', 'SHUTOFF', 'ERROR', 'DELETED');

-- CreateEnum
CREATE TYPE "public"."bmaas_network_status" AS ENUM ('PENDING', 'ACTIVE', 'DOWN', 'ERROR', 'DELETED');

-- CreateEnum
CREATE TYPE "public"."bmaas_volume_status" AS ENUM ('CREATING', 'AVAILABLE', 'ATTACHING', 'IN_USE', 'DETACHING', 'DELETING', 'ERROR', 'ERROR_DELETING', 'DELETED');

-- CreateEnum
CREATE TYPE "public"."bmaas_bucket_status" AS ENUM ('CREATING', 'ACTIVE', 'SUSPENDED', 'DELETING', 'DELETED', 'ERROR');

-- CreateEnum
CREATE TYPE "public"."bmaas_resource_type" AS ENUM ('INSTANCE', 'VOLUME', 'NETWORK', 'BUCKET', 'FLOATING_IP', 'SNAPSHOT');

-- CreateTable
CREATE TABLE "public"."bmaas_instances" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "flavor_id" TEXT NOT NULL,
    "openstack_id" TEXT NOT NULL,
    "openstack_project_id" TEXT,
    "image_id" TEXT,
    "image_name" TEXT,
    "hypervisor" TEXT,
    "availability_zone" TEXT,
    "status" "public"."bmaas_instance_status" NOT NULL DEFAULT 'PENDING',
    "power_state" TEXT,
    "task_state" TEXT,
    "public_ip" TEXT,
    "private_ip" TEXT,
    "floating_ip_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hourly_rate" DECIMAL(10,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "launched_at" TIMESTAMP(3),
    "terminated_at" TIMESTAMP(3),

    CONSTRAINT "bmaas_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."bmaas_flavors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "vcpus" INTEGER NOT NULL,
    "ram" INTEGER NOT NULL,
    "disk" INTEGER NOT NULL,
    "swap" INTEGER NOT NULL DEFAULT 0,
    "ephemeral" INTEGER NOT NULL DEFAULT 0,
    "openstack_id" TEXT,
    "hourly_rate" DECIMAL(10,4) NOT NULL,
    "monthly_rate" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "bandwidth" INTEGER,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bmaas_flavors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."bmaas_networks" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "openstack_id" TEXT NOT NULL,
    "cidr" TEXT,
    "gateway" TEXT,
    "dns_nameservers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allocation_pools" JSONB,
    "network_type" TEXT,
    "segmentation_id" INTEGER,
    "status" "public"."bmaas_network_status" NOT NULL DEFAULT 'PENDING',
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "is_external" BOOLEAN NOT NULL DEFAULT false,
    "monthly_rate" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "bmaas_networks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."bmaas_subnets" (
    "id" TEXT NOT NULL,
    "network_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "openstack_id" TEXT NOT NULL,
    "cidr" TEXT NOT NULL,
    "gateway" TEXT,
    "ip_version" INTEGER NOT NULL DEFAULT 4,
    "enable_dhcp" BOOLEAN NOT NULL DEFAULT true,
    "dns_nameservers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allocation_pools" JSONB NOT NULL DEFAULT '[]',
    "host_routes" JSONB NOT NULL DEFAULT '[]',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bmaas_subnets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."bmaas_network_ports" (
    "id" TEXT NOT NULL,
    "instance_id" TEXT NOT NULL,
    "network_id" TEXT NOT NULL,
    "name" TEXT,
    "openstack_id" TEXT NOT NULL,
    "mac_address" TEXT NOT NULL,
    "fixed_ips" JSONB NOT NULL DEFAULT '[]',
    "security_groups" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'DOWN',
    "admin_state_up" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bmaas_network_ports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."bmaas_volumes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "instance_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "openstack_id" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "volume_type" TEXT NOT NULL DEFAULT 'standard',
    "bootable" BOOLEAN NOT NULL DEFAULT false,
    "encrypted" BOOLEAN NOT NULL DEFAULT false,
    "device" TEXT,
    "attachment_id" TEXT,
    "status" "public"."bmaas_volume_status" NOT NULL DEFAULT 'CREATING',
    "monthly_rate_per_gb" DECIMAL(10,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "snapshot_id" TEXT,
    "source_vol_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "attached_at" TIMESTAMP(3),
    "detached_at" TIMESTAMP(3),

    CONSTRAINT "bmaas_volumes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."bmaas_buckets" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "openstack_container" TEXT NOT NULL,
    "region" TEXT,
    "storage_class" TEXT NOT NULL DEFAULT 'standard',
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "versioning" BOOLEAN NOT NULL DEFAULT false,
    "object_count" INTEGER NOT NULL DEFAULT 0,
    "bytes_used" BIGINT NOT NULL DEFAULT 0,
    "storage_rate_per_gb" DECIMAL(10,4) NOT NULL,
    "transfer_rate_per_gb" DECIMAL(10,4) NOT NULL,
    "request_rate" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "public"."bmaas_bucket_status" NOT NULL DEFAULT 'ACTIVE',
    "read_acl" JSONB,
    "write_acl" JSONB,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "last_synced_at" TIMESTAMP(3),

    CONSTRAINT "bmaas_buckets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."bmaas_usage_records" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "resource_type" "public"."bmaas_resource_type" NOT NULL,
    "resource_id" TEXT NOT NULL,
    "instance_id" TEXT,
    "volume_id" TEXT,
    "network_id" TEXT,
    "bucket_id" TEXT,
    "metric" TEXT NOT NULL,
    "quantity" DECIMAL(20,6) NOT NULL,
    "unit" TEXT NOT NULL,
    "unit_price" DECIMAL(10,6) NOT NULL,
    "total_cost" DECIMAL(10,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bmaas_usage_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."bmaas_quotas" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "max_instances" INTEGER NOT NULL DEFAULT 10,
    "max_vcpus" INTEGER NOT NULL DEFAULT 50,
    "max_ram_mb" INTEGER NOT NULL DEFAULT 131072,
    "max_volumes" INTEGER NOT NULL DEFAULT 20,
    "max_volume_gb" INTEGER NOT NULL DEFAULT 1000,
    "max_snapshots" INTEGER NOT NULL DEFAULT 50,
    "max_buckets" INTEGER NOT NULL DEFAULT 10,
    "max_bucket_gb" INTEGER NOT NULL DEFAULT 5000,
    "max_networks" INTEGER NOT NULL DEFAULT 5,
    "max_subnets" INTEGER NOT NULL DEFAULT 10,
    "max_ports" INTEGER NOT NULL DEFAULT 50,
    "max_floating_ips" INTEGER NOT NULL DEFAULT 5,
    "max_security_groups" INTEGER NOT NULL DEFAULT 10,
    "used_instances" INTEGER NOT NULL DEFAULT 0,
    "used_vcpus" INTEGER NOT NULL DEFAULT 0,
    "used_ram_mb" INTEGER NOT NULL DEFAULT 0,
    "used_volumes" INTEGER NOT NULL DEFAULT 0,
    "used_volume_gb" INTEGER NOT NULL DEFAULT 0,
    "used_networks" INTEGER NOT NULL DEFAULT 0,
    "used_buckets" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bmaas_quotas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bmaas_instances_openstack_id_key" ON "public"."bmaas_instances"("openstack_id");

-- CreateIndex
CREATE INDEX "bmaas_instances_organization_id_idx" ON "public"."bmaas_instances"("organization_id");

-- CreateIndex
CREATE INDEX "bmaas_instances_project_id_idx" ON "public"."bmaas_instances"("project_id");

-- CreateIndex
CREATE INDEX "bmaas_instances_status_idx" ON "public"."bmaas_instances"("status");

-- CreateIndex
CREATE INDEX "bmaas_instances_created_by_idx" ON "public"."bmaas_instances"("created_by");

-- CreateIndex
CREATE INDEX "bmaas_instances_openstack_id_idx" ON "public"."bmaas_instances"("openstack_id");

-- CreateIndex
CREATE INDEX "bmaas_instances_created_at_idx" ON "public"."bmaas_instances"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "bmaas_flavors_name_key" ON "public"."bmaas_flavors"("name");

-- CreateIndex
CREATE UNIQUE INDEX "bmaas_flavors_openstack_id_key" ON "public"."bmaas_flavors"("openstack_id");

-- CreateIndex
CREATE INDEX "bmaas_flavors_is_active_idx" ON "public"."bmaas_flavors"("is_active");

-- CreateIndex
CREATE INDEX "bmaas_flavors_is_public_idx" ON "public"."bmaas_flavors"("is_public");

-- CreateIndex
CREATE UNIQUE INDEX "bmaas_networks_openstack_id_key" ON "public"."bmaas_networks"("openstack_id");

-- CreateIndex
CREATE INDEX "bmaas_networks_organization_id_idx" ON "public"."bmaas_networks"("organization_id");

-- CreateIndex
CREATE INDEX "bmaas_networks_project_id_idx" ON "public"."bmaas_networks"("project_id");

-- CreateIndex
CREATE INDEX "bmaas_networks_status_idx" ON "public"."bmaas_networks"("status");

-- CreateIndex
CREATE INDEX "bmaas_networks_openstack_id_idx" ON "public"."bmaas_networks"("openstack_id");

-- CreateIndex
CREATE UNIQUE INDEX "bmaas_subnets_openstack_id_key" ON "public"."bmaas_subnets"("openstack_id");

-- CreateIndex
CREATE INDEX "bmaas_subnets_network_id_idx" ON "public"."bmaas_subnets"("network_id");

-- CreateIndex
CREATE INDEX "bmaas_subnets_openstack_id_idx" ON "public"."bmaas_subnets"("openstack_id");

-- CreateIndex
CREATE UNIQUE INDEX "bmaas_network_ports_openstack_id_key" ON "public"."bmaas_network_ports"("openstack_id");

-- CreateIndex
CREATE INDEX "bmaas_network_ports_instance_id_idx" ON "public"."bmaas_network_ports"("instance_id");

-- CreateIndex
CREATE INDEX "bmaas_network_ports_network_id_idx" ON "public"."bmaas_network_ports"("network_id");

-- CreateIndex
CREATE INDEX "bmaas_network_ports_openstack_id_idx" ON "public"."bmaas_network_ports"("openstack_id");

-- CreateIndex
CREATE UNIQUE INDEX "bmaas_volumes_openstack_id_key" ON "public"."bmaas_volumes"("openstack_id");

-- CreateIndex
CREATE UNIQUE INDEX "bmaas_volumes_attachment_id_key" ON "public"."bmaas_volumes"("attachment_id");

-- CreateIndex
CREATE INDEX "bmaas_volumes_organization_id_idx" ON "public"."bmaas_volumes"("organization_id");

-- CreateIndex
CREATE INDEX "bmaas_volumes_project_id_idx" ON "public"."bmaas_volumes"("project_id");

-- CreateIndex
CREATE INDEX "bmaas_volumes_instance_id_idx" ON "public"."bmaas_volumes"("instance_id");

-- CreateIndex
CREATE INDEX "bmaas_volumes_status_idx" ON "public"."bmaas_volumes"("status");

-- CreateIndex
CREATE INDEX "bmaas_volumes_openstack_id_idx" ON "public"."bmaas_volumes"("openstack_id");

-- CreateIndex
CREATE UNIQUE INDEX "bmaas_buckets_openstack_container_key" ON "public"."bmaas_buckets"("openstack_container");

-- CreateIndex
CREATE INDEX "bmaas_buckets_organization_id_idx" ON "public"."bmaas_buckets"("organization_id");

-- CreateIndex
CREATE INDEX "bmaas_buckets_project_id_idx" ON "public"."bmaas_buckets"("project_id");

-- CreateIndex
CREATE INDEX "bmaas_buckets_status_idx" ON "public"."bmaas_buckets"("status");

-- CreateIndex
CREATE INDEX "bmaas_buckets_openstack_container_idx" ON "public"."bmaas_buckets"("openstack_container");

-- CreateIndex
CREATE INDEX "bmaas_usage_records_organization_id_idx" ON "public"."bmaas_usage_records"("organization_id");

-- CreateIndex
CREATE INDEX "bmaas_usage_records_project_id_idx" ON "public"."bmaas_usage_records"("project_id");

-- CreateIndex
CREATE INDEX "bmaas_usage_records_resource_type_idx" ON "public"."bmaas_usage_records"("resource_type");

-- CreateIndex
CREATE INDEX "bmaas_usage_records_resource_id_idx" ON "public"."bmaas_usage_records"("resource_id");

-- CreateIndex
CREATE INDEX "bmaas_usage_records_start_time_idx" ON "public"."bmaas_usage_records"("start_time");

-- CreateIndex
CREATE INDEX "bmaas_usage_records_end_time_idx" ON "public"."bmaas_usage_records"("end_time");

-- CreateIndex
CREATE INDEX "bmaas_usage_records_created_at_idx" ON "public"."bmaas_usage_records"("created_at");

-- CreateIndex
CREATE INDEX "bmaas_usage_records_organization_id_start_time_end_time_idx" ON "public"."bmaas_usage_records"("organization_id", "start_time", "end_time");

-- CreateIndex
CREATE UNIQUE INDEX "bmaas_quotas_organization_id_key" ON "public"."bmaas_quotas"("organization_id");

-- CreateIndex
CREATE INDEX "bmaas_quotas_organization_id_idx" ON "public"."bmaas_quotas"("organization_id");

-- AddForeignKey
ALTER TABLE "public"."bmaas_instances" ADD CONSTRAINT "bmaas_instances_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bmaas_instances" ADD CONSTRAINT "bmaas_instances_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bmaas_instances" ADD CONSTRAINT "bmaas_instances_flavor_id_fkey" FOREIGN KEY ("flavor_id") REFERENCES "public"."bmaas_flavors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bmaas_networks" ADD CONSTRAINT "bmaas_networks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bmaas_networks" ADD CONSTRAINT "bmaas_networks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bmaas_subnets" ADD CONSTRAINT "bmaas_subnets_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "public"."bmaas_networks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bmaas_network_ports" ADD CONSTRAINT "bmaas_network_ports_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "public"."bmaas_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bmaas_network_ports" ADD CONSTRAINT "bmaas_network_ports_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "public"."bmaas_networks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bmaas_volumes" ADD CONSTRAINT "bmaas_volumes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bmaas_volumes" ADD CONSTRAINT "bmaas_volumes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bmaas_volumes" ADD CONSTRAINT "bmaas_volumes_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "public"."bmaas_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bmaas_buckets" ADD CONSTRAINT "bmaas_buckets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bmaas_buckets" ADD CONSTRAINT "bmaas_buckets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bmaas_usage_records" ADD CONSTRAINT "bmaas_usage_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bmaas_usage_records" ADD CONSTRAINT "bmaas_usage_records_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bmaas_usage_records" ADD CONSTRAINT "bmaas_usage_records_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "public"."bmaas_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bmaas_usage_records" ADD CONSTRAINT "bmaas_usage_records_volume_id_fkey" FOREIGN KEY ("volume_id") REFERENCES "public"."bmaas_volumes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bmaas_usage_records" ADD CONSTRAINT "bmaas_usage_records_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "public"."bmaas_networks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bmaas_usage_records" ADD CONSTRAINT "bmaas_usage_records_bucket_id_fkey" FOREIGN KEY ("bucket_id") REFERENCES "public"."bmaas_buckets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bmaas_quotas" ADD CONSTRAINT "bmaas_quotas_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
