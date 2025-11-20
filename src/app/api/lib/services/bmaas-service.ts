/**
 * BMaaS Service
 * High-level service for managing bare-metal resources
 */

import { prisma } from '@app/database';

import { OpenStackClient, getOpenStackClient } from './bmaas/openstack-client';

export interface CreateInstanceOptions {
  name: string;
  flavorId: string;
  imageId?: string;
  networkIds?: string[];
  networks?: Array<{ uuid: string }>;
  availabilityZone?: string;
  metadata?: Record<string, string>;
  userData?: string;
}

export interface CreateVolumeOptions {
  name: string;
  size: number;
  volumeType?: string;
  availabilityZone?: string;
  metadata?: Record<string, string>;
}

export interface CreateNetworkOptions {
  name: string;
  cidr?: string;
  adminStateUp?: boolean;
  shared?: boolean;
  external?: boolean;
}

/**
 * BMaaS Service
 * Provides high-level methods for managing BMaaS resources
 */
export class BmaasService {
  private client: OpenStackClient;

  constructor() {
    this.client = getOpenStackClient();
  }

  // ============================================================================
  // INSTANCE MANAGEMENT
  // ============================================================================

  /**
   * Create a new instance
   */
  async createInstance(options: CreateInstanceOptions): Promise<any> {
    // Prepare networks - support both formats
    const networks = options.networks || options.networkIds?.map((uuid) => ({ uuid }));

    // Create instance in OpenStack
    const instance = await this.client.createInstance({
      name: options.name,
      flavorId: options.flavorId,
      imageId: options.imageId,
      networks,
      availabilityZone: options.availabilityZone,
      metadata: options.metadata,
      userData: options.userData,
    });

    return {
      id: instance.id,
      name: instance.name,
      status: instance.status,
      power_state: instance['OS-EXT-STS:power_state'],
      task_state: instance['OS-EXT-STS:task_state'],
      hypervisor_hostname: instance['OS-EXT-SRV-ATTR:hypervisor_hostname'],
      availability_zone: instance['OS-EXT-AZ:availability_zone'],
      created: instance.created,
      project_id: instance.tenant_id,
    };
  }

  /**
   * Get instance details
   */
  async getInstance(instanceId: string): Promise<any> {
    const response = await this.client.getInstance(instanceId);
    return response.server;
  }

  /**
   * Get instance details (alias for getInstance)
   */
  async getInstanceDetails(instanceId: string): Promise<any> {
    return this.getInstance(instanceId);
  }

  /**
   * Delete an instance
   */
  async deleteInstance(instanceId: string): Promise<void> {
    await this.client.deleteInstance(instanceId);
  }

  /**
   * Start an instance
   */
  async startInstance(instanceId: string): Promise<void> {
    await this.client.startInstance(instanceId);
  }

  /**
   * Stop an instance
   */
  async stopInstance(instanceId: string): Promise<void> {
    await this.client.stopInstance(instanceId);
  }

  /**
   * Reboot an instance
   */
  async rebootInstance(instanceId: string, hard: boolean = false): Promise<void> {
    await this.client.rebootInstance(instanceId, hard);
  }

  /**
   * Sync instance status from OpenStack
   */
  async syncInstanceStatus(dbInstanceId: string): Promise<void> {
    const dbInstance = await prisma.bmaasInstance.findUnique({
      where: { id: dbInstanceId },
    });

    if (!dbInstance) {
      throw new Error(`Instance ${dbInstanceId} not found in database`);
    }

    try {
      const osInstance = await this.getInstance(dbInstance.openstackId);

      // Map OpenStack status to BMaaS status
      let status: any = 'ACTIVE';
      const osStatus = osInstance.status.toUpperCase();

      if (osStatus === 'BUILD') status = 'BUILDING';
      else if (osStatus === 'ACTIVE') status = 'ACTIVE';
      else if (osStatus === 'SHUTOFF') status = 'SHUTOFF';
      else if (osStatus === 'PAUSED') status = 'PAUSED';
      else if (osStatus === 'SUSPENDED') status = 'SUSPENDED';
      else if (osStatus === 'ERROR') status = 'ERROR';
      else if (osStatus === 'DELETED') status = 'DELETED';

      // Update database
      await prisma.bmaasInstance.update({
        where: { id: dbInstanceId },
        data: {
          status,
          powerState: osInstance['OS-EXT-STS:power_state'],
          taskState: osInstance['OS-EXT-STS:task_state'],
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      console.error(`Failed to sync instance ${dbInstanceId}:`, error);
      // Mark as ERROR if instance not found in OpenStack
      await prisma.bmaasInstance.update({
        where: { id: dbInstanceId },
        data: {
          status: 'ERROR',
          updatedAt: new Date(),
        },
      });
    }
  }

  // ============================================================================
  // VOLUME MANAGEMENT
  // ============================================================================

  /**
   * Create a volume
   */
  async createVolume(options: CreateVolumeOptions): Promise<any> {
    const volume = await this.client.createVolume(options);
    return volume;
  }

  /**
   * Get volume details
   */
  async getVolume(volumeId: string): Promise<any> {
    return await this.client.getVolume(volumeId);
  }

  /**
   * Delete a volume
   */
  async deleteVolume(volumeId: string): Promise<void> {
    await this.client.deleteVolume(volumeId);
  }

  /**
   * Attach volume to instance
   */
  async attachVolume(instanceId: string, volumeId: string, device?: string): Promise<any> {
    return await this.client.attachVolume(instanceId, volumeId, device);
  }

  /**
   * Detach volume from instance
   */
  async detachVolume(instanceId: string, attachmentId: string): Promise<void> {
    await this.client.detachVolume(instanceId, attachmentId);
  }

  // ============================================================================
  // NETWORK MANAGEMENT
  // ============================================================================

  /**
   * Create a network
   */
  async createNetwork(options: CreateNetworkOptions): Promise<any> {
    const network = await this.client.createNetwork(options);

    // Create default subnet if CIDR provided
    if (options.cidr) {
      const subnet = await this.client.createSubnet({
        networkId: network.id,
        name: `${options.name}-subnet`,
        cidr: options.cidr,
        ipVersion: 4,
        enableDhcp: true,
      });

      return {
        network,
        subnet,
      };
    }

    return { network };
  }

  /**
   * Delete a network
   */
  async deleteNetwork(networkId: string): Promise<void> {
    // Delete all subnets first
    const subnets = await this.client.listSubnets(networkId);
    // eslint-disable-next-line no-restricted-syntax
    for (const subnet of subnets.subnets || []) {
      // eslint-disable-next-line no-await-in-loop
      await this.client.deleteSubnet(subnet.id);
    }

    // Delete network
    await this.client.deleteNetwork(networkId);
  }

  /**
   * Create a subnet
   */
  async createSubnet(options: {
    networkId: string;
    name: string;
    cidr: string;
    ipVersion?: number;
    gateway?: string;
    enableDhcp?: boolean;
  }): Promise<any> {
    return await this.client.createSubnet(options);
  }

  /**
   * Delete a subnet
   */
  async deleteSubnet(subnetId: string): Promise<void> {
    await this.client.deleteSubnet(subnetId);
  }

  /**
   * Get network details
   */
  async getNetwork(networkId: string): Promise<any> {
    return await this.client.getNetwork(networkId);
  }

  // ============================================================================
  // STORAGE (SWIFT) MANAGEMENT
  // ============================================================================

  /**
   * Create a bucket (Swift container)
   */
  async createBucket(name: string, isPublic: boolean = false): Promise<void> {
    await this.client.createContainer(name, isPublic);
  }

  /**
   * Delete a bucket
   */
  async deleteBucket(name: string): Promise<void> {
    await this.client.deleteContainer(name);
  }

  /**
   * Get bucket metadata
   */
  async getBucketMetadata(name: string): Promise<any> {
    return await this.client.getContainerMetadata(name);
  }

  /**
   * Sync bucket usage from OpenStack
   */
  async syncBucketUsage(dbBucketId: string): Promise<void> {
    const dbBucket = await prisma.bmaasBucket.findUnique({
      where: { id: dbBucketId },
    });

    if (!dbBucket) {
      throw new Error(`Bucket ${dbBucketId} not found in database`);
    }

    try {
      const metadata = await this.getBucketMetadata(dbBucket.openstackId);

      await prisma.bmaasBucket.update({
        where: { id: dbBucketId },
        data: {
          objectCount: metadata.objectCount,
          bytesUsed: metadata.bytesUsed,
          lastSyncedAt: new Date(),
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      console.error(`Failed to sync bucket ${dbBucketId}:`, error);
    }
  }

  /**
   * Update bucket access (public/private)
   */
  async updateBucketAccess(containerName: string, isPublic: boolean): Promise<void> {
    await this.client.updateContainerAccess(containerName, isPublic);
  }

  /**
   * List objects in a bucket
   */
  async listBucketObjects(
    containerName: string,
    options?: { prefix?: string; marker?: string; limit?: number }
  ): Promise<any[]> {
    return await this.client.listObjects(containerName, options);
  }

  /**
   * Upload an object to a bucket
   */
  async uploadBucketObject(
    containerName: string,
    objectName: string,
    data: Buffer | string,
    contentType?: string
  ): Promise<{ etag: string }> {
    return await this.client.uploadObject(containerName, objectName, data, contentType);
  }

  /**
   * Get object metadata
   */
  async getBucketObjectMetadata(containerName: string, objectName: string): Promise<any> {
    return await this.client.getObjectMetadata(containerName, objectName);
  }

  /**
   * Delete an object from a bucket
   */
  async deleteBucketObject(containerName: string, objectName: string): Promise<void> {
    await this.client.deleteObject(containerName, objectName);
  }

  /**
   * Get a temporary URL for accessing an object
   */
  async getBucketObjectUrl(
    containerName: string,
    objectName: string,
    expiresIn: number = 3600
  ): Promise<string> {
    return await this.client.getTempUrl(containerName, objectName, expiresIn);
  }

  // ============================================================================
  // IMAGE MANAGEMENT
  // ============================================================================

  /**
   * List available images from OpenStack
   */
  async listImages(): Promise<any> {
    const response = await this.client.listImages();
    return response;
  }

  /**
   * Upload an image from URL to OpenStack
   */
  async uploadImage(options: {
    name: string;
    url: string;
    format?: string;
    minDisk?: number;
    minRam?: number;
    visibility?: string;
  }): Promise<any> {
    const image = await this.client.uploadImageFromUrl(options);
    return image;
  }

  /**
   * Delete an image from OpenStack
   */
  async deleteImage(imageId: string): Promise<void> {
    await this.client.deleteImage(imageId);
  }

  // ============================================================================
  // NETWORK MANAGEMENT
  // ============================================================================

  /**
   * List available networks from OpenStack
   */
  async listNetworks(): Promise<any> {
    const response = await this.client.listNetworks();
    return response;
  }

  // ============================================================================
  // FLAVOR MANAGEMENT
  // ============================================================================

  /**
   * Sync flavors from OpenStack to database
   */
  async syncFlavors(): Promise<void> {
    try {
      const response = await this.client.listFlavors();
      const flavors = response.flavors || [];

      // eslint-disable-next-line no-restricted-syntax
      for (const osFlavor of flavors) {
        // Check if flavor exists in database
        // eslint-disable-next-line no-await-in-loop
        const existing = await prisma.bmaasFlavor.findUnique({
          where: { openstackId: osFlavor.id },
        });

        // Calculate pricing (simple example - customize based on your pricing model)
        const hourlyRate = (osFlavor.vcpus * 0.05 + (osFlavor.ram / 1024) * 0.01).toFixed(4);
        const monthlyRate = (parseFloat(hourlyRate) * 730).toFixed(2);

        if (existing) {
          // Update existing flavor
          // eslint-disable-next-line no-await-in-loop
          await prisma.bmaasFlavor.update({
            where: { id: existing.id },
            data: {
              vcpus: osFlavor.vcpus,
              ram: osFlavor.ram,
              disk: osFlavor.disk,
              swap: osFlavor.swap || 0,
              ephemeral: osFlavor['OS-FLV-EXT-DATA:ephemeral'] || 0,
              updatedAt: new Date(),
            },
          });
        } else {
          // Create new flavor
          // eslint-disable-next-line no-await-in-loop
          await prisma.bmaasFlavor.create({
            data: {
              name: osFlavor.name,
              description: `${osFlavor.vcpus} vCPU, ${osFlavor.ram / 1024} GB RAM, ${
                osFlavor.disk
              } GB Disk`,
              vcpus: osFlavor.vcpus,
              ram: osFlavor.ram,
              disk: osFlavor.disk,
              swap: osFlavor.swap || 0,
              ephemeral: osFlavor['OS-FLV-EXT-DATA:ephemeral'] || 0,
              openstackId: osFlavor.id,
              hourlyRate,
              monthlyRate,
              currency: 'USD',
              isPublic: osFlavor['os-flavor-access:is_public'] !== false,
              isActive: true,
            },
          });
        }
      }

      console.log(`Synced ${flavors.length} flavors from OpenStack`);
    } catch (error) {
      console.error('Failed to sync flavors:', error);
      throw error;
    }
  }

  // ============================================================================
  // USAGE TRACKING
  // ============================================================================

  /**
   * Record usage for an instance
   */
  static async recordInstanceUsage(
    instanceId: string,
    startTime: Date,
    endTime: Date
  ): Promise<void> {
    const instance = await prisma.bmaasInstance.findUnique({
      where: { id: instanceId },
      include: { flavor: true },
    });

    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    // Calculate hours
    const hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

    // Calculate cost
    const unitPrice = parseFloat(instance.hourlyRate.toString());
    const totalCost = unitPrice * hours;

    // Create usage record
    await prisma.bmaasUsageRecord.create({
      data: {
        organizationId: instance.organizationId,
        projectId: instance.projectId,
        resourceType: 'INSTANCE',
        resourceId: instance.id,
        instanceId: instance.id,
        metric: 'compute_hours',
        quantity: hours,
        unit: 'hours',
        unitPrice,
        totalCost,
        currency: instance.currency,
        startTime,
        endTime,
        metadata: {
          flavorName: instance.flavor.name,
          vcpus: instance.flavor.vcpus,
          ram: instance.flavor.ram,
        },
      },
    });
  }

  /**
   * Record usage for a volume
   */
  static async recordVolumeUsage(volumeId: string, startTime: Date, endTime: Date): Promise<void> {
    const volume = await prisma.bmaasVolume.findUnique({
      where: { id: volumeId },
    });

    if (!volume) {
      throw new Error(`Volume ${volumeId} not found`);
    }

    // Calculate GB-hours
    const hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
    const gbHours = volume.sizeGb * hours;

    // Calculate cost (monthly rate / 730 hours per month * hours)
    const monthlyRate = parseFloat(volume.monthlyRatePerGb.toString());
    const hourlyRate = monthlyRate / 730;
    const totalCost = hourlyRate * gbHours;

    // Create usage record
    await prisma.bmaasUsageRecord.create({
      data: {
        organizationId: volume.organizationId,
        projectId: volume.projectId,
        resourceType: 'VOLUME',
        resourceId: volume.id,
        volumeId: volume.id,
        metric: 'storage_gb_hours',
        quantity: gbHours,
        unit: 'GB-hours',
        unitPrice: hourlyRate,
        totalCost,
        currency: volume.currency,
        startTime,
        endTime,
        metadata: {
          size: volume.sizeGb,
          volumeType: volume.volumeType,
        },
      },
    });
  }
}

// Singleton instance
let bmaasService: BmaasService | null = null;

/**
 * Get the BMaaS service instance
 */
export function getBmaasService(): BmaasService {
  if (!bmaasService) {
    bmaasService = new BmaasService();
  }
  return bmaasService;
}
