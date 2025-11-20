/**
 * OpenStack API Client
 * Low-level client for interacting with OpenStack services
 */

import https from 'https';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

interface OpenStackConfig {
  authUrl: string;
  username: string;
  password: string;
  projectName: string;
  userDomainName?: string;
  projectDomainName?: string;
  region?: string;
}

interface AuthToken {
  token: string;
  expiresAt: Date;
  catalog: ServiceCatalog[];
}

interface ServiceCatalog {
  type: string;
  name: string;
  endpoints: ServiceEndpoint[];
}

interface ServiceEndpoint {
  region: string;
  url: string;
  interface: 'public' | 'internal' | 'admin';
}

/**
 * OpenStack API Client
 * Handles authentication and provides methods for interacting with OpenStack services
 */
export class OpenStackClient {
  private config: OpenStackConfig;
  private authToken: AuthToken | null = null;
  private httpClient: AxiosInstance;

  constructor(config?: OpenStackConfig) {
    this.config = config || {
      authUrl: process.env.OPENSTACK_AUTH_URL || 'http://localhost:5000/v3',
      username: process.env.OPENSTACK_USERNAME || 'admin',
      password: process.env.OPENSTACK_PASSWORD || '',
      projectName: process.env.OPENSTACK_PROJECT_NAME || 'admin',
      userDomainName: process.env.OPENSTACK_USER_DOMAIN_NAME || 'Default',
      projectDomainName: process.env.OPENSTACK_PROJECT_DOMAIN_NAME || 'Default',
      region: process.env.OPENSTACK_REGION || 'RegionOne',
    };

    // Configure HTTPS agent to accept self-signed certificates in development
    // WARNING: Only use this in development/testing environments
    const httpsAgent =
      process.env.OPENSTACK_VERIFY_SSL === 'false' || process.env.NODE_ENV === 'development'
        ? new https.Agent({
            rejectUnauthorized: false,
          })
        : undefined;

    this.httpClient = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
      httpsAgent,
    });
  }

  /**
   * Authenticate with Keystone and get a token
   */
  async authenticate(): Promise<string> {
    try {
      const response = await this.httpClient.post(`${this.config.authUrl}/auth/tokens`, {
        auth: {
          identity: {
            methods: ['password'],
            password: {
              user: {
                name: this.config.username,
                domain: { name: this.config.userDomainName },
                password: this.config.password,
              },
            },
          },
          scope: {
            project: {
              name: this.config.projectName,
              domain: { name: this.config.projectDomainName },
            },
          },
        },
      });

      const token = response.headers['x-subject-token'];
      const expiresAt = new Date(response.data.token.expires_at);
      const { catalog } = response.data.token;

      this.authToken = {
        token,
        expiresAt,
        catalog,
      };

      // Log available services for debugging
      console.log('OpenStack authentication successful');
      console.log(
        'Available services:',
        catalog.map((s: any) => ({
          type: s.type,
          name: s.name,
          endpoints: s.endpoints.map((e: any) => ({
            region: e.region,
            interface: e.interface,
          })),
        }))
      );

      return token;
    } catch (error: any) {
      console.error('OpenStack authentication failed:', error.response?.data || error.message);
      throw new Error(`Failed to authenticate with OpenStack: ${error.message}`);
    }
  }

  /**
   * Get a valid authentication token (refreshes if expired)
   */
  async getToken(): Promise<string> {
    if (!this.authToken || new Date() >= this.authToken.expiresAt) {
      await this.authenticate();
    }
    return this.authToken!.token;
  }

  /**
   * Get service endpoint URL from catalog
   */
  async getEndpoint(
    serviceType: string,
    interfaceType: 'public' | 'internal' | 'admin' = 'public'
  ): Promise<string> {
    // Ensure we have a valid token (this will authenticate if needed)
    await this.getToken();

    if (!this.authToken) {
      throw new Error('Not authenticated. Call authenticate() first.');
    }

    const service = this.authToken.catalog.find((s) => s.type === serviceType);
    if (!service) {
      const availableServices = this.authToken.catalog.map((s) => s.type).join(', ');
      throw new Error(
        `Service type '${serviceType}' not found in catalog. Available services: ${availableServices}`
      );
    }

    // Try to find endpoint with exact region match
    let endpoint = service.endpoints.find(
      (e) => e.region === this.config.region && e.interface === interfaceType
    );

    // If not found, try case-insensitive region match
    if (!endpoint) {
      endpoint = service.endpoints.find(
        (e) =>
          e.region.toLowerCase() === this.config.region?.toLowerCase() &&
          e.interface === interfaceType
      );
    }

    // If still not found, try any region with the correct interface
    if (!endpoint) {
      endpoint = service.endpoints.find((e) => e.interface === interfaceType);
      if (endpoint) {
        console.warn(
          `Using endpoint from region '${endpoint.region}' instead of configured region '${this.config.region}'`
        );
      }
    }

    if (!endpoint) {
      const availableEndpoints = service.endpoints
        .map((e) => `${e.region}/${e.interface}`)
        .join(', ');
      throw new Error(
        `Endpoint not found for service '${serviceType}' with interface '${interfaceType}' in region '${this.config.region}'. Available endpoints: ${availableEndpoints}`
      );
    }

    return endpoint.url;
  }

  /**
   * Make an authenticated request to an OpenStack service
   */
  async request<T = any>(config: AxiosRequestConfig): Promise<T> {
    const token = await this.getToken();

    const requestConfig: AxiosRequestConfig = {
      ...config,
      headers: {
        ...config.headers,
        'X-Auth-Token': token,
      },
    };

    try {
      const response = await this.httpClient.request<T>(requestConfig);
      return response.data;
    } catch (error: any) {
      console.error('OpenStack API request failed:', {
        url: config.url,
        method: config.method,
        error: error.response?.data || error.message,
      });
      throw error;
    }
  }

  // ============================================================================
  // NOVA (Compute) API Methods
  // ============================================================================

  /**
   * List compute instances
   */
  async listInstances(params?: { limit?: number; marker?: string }): Promise<any> {
    const endpoint = await this.getEndpoint('compute');
    return this.request({
      method: 'GET',
      url: `${endpoint}/servers/detail`,
      params,
    });
  }

  /**
   * Get instance details
   */
  async getInstance(instanceId: string): Promise<any> {
    const endpoint = await this.getEndpoint('compute');
    return this.request({
      method: 'GET',
      url: `${endpoint}/servers/${instanceId}`,
    });
  }

  /**
   * Create a new instance
   */
  async createInstance(data: {
    name: string;
    flavorId: string;
    imageId?: string;
    networks?: Array<{ uuid: string }>;
    availabilityZone?: string;
    metadata?: Record<string, string>;
    userData?: string;
  }): Promise<any> {
    const endpoint = await this.getEndpoint('compute');

    const server: any = {
      name: data.name,
      flavorRef: data.flavorId,
      metadata: data.metadata || {},
    };

    if (data.imageId) {
      server.imageRef = data.imageId;
    }

    if (data.networks) {
      server.networks = data.networks;
    }

    if (data.availabilityZone) {
      server.availability_zone = data.availabilityZone;
    }

    // Add user_data for cloud-init (must be base64 encoded)
    if (data.userData) {
      server.user_data = Buffer.from(data.userData).toString('base64');
    }

    const response = await this.request({
      method: 'POST',
      url: `${endpoint}/servers`,
      data: { server },
    });

    return response.server;
  }

  /**
   * Delete an instance
   */
  async deleteInstance(instanceId: string): Promise<void> {
    const endpoint = await this.getEndpoint('compute');
    await this.request({
      method: 'DELETE',
      url: `${endpoint}/servers/${instanceId}`,
    });
  }

  /**
   * Start an instance
   */
  async startInstance(instanceId: string): Promise<void> {
    const endpoint = await this.getEndpoint('compute');
    await this.request({
      method: 'POST',
      url: `${endpoint}/servers/${instanceId}/action`,
      data: { 'os-start': null },
    });
  }

  /**
   * Stop an instance
   */
  async stopInstance(instanceId: string): Promise<void> {
    const endpoint = await this.getEndpoint('compute');
    await this.request({
      method: 'POST',
      url: `${endpoint}/servers/${instanceId}/action`,
      data: { 'os-stop': null },
    });
  }

  /**
   * Reboot an instance
   */
  async rebootInstance(instanceId: string, hard: boolean = false): Promise<void> {
    const endpoint = await this.getEndpoint('compute');
    await this.request({
      method: 'POST',
      url: `${endpoint}/servers/${instanceId}/action`,
      data: {
        reboot: {
          type: hard ? 'HARD' : 'SOFT',
        },
      },
    });
  }

  /**
   * List flavors
   */
  async listFlavors(): Promise<any> {
    const endpoint = await this.getEndpoint('compute');
    return this.request({
      method: 'GET',
      url: `${endpoint}/flavors/detail`,
    });
  }

  /**
   * List availability zones
   */
  async listAvailabilityZones(): Promise<any> {
    const endpoint = await this.getEndpoint('compute');
    return this.request({
      method: 'GET',
      url: `${endpoint}/os-availability-zone`,
    });
  }

  /**
   * List images
   */
  async listImages(): Promise<any> {
    const endpoint = await this.getEndpoint('image');
    return this.request({
      method: 'GET',
      url: `${endpoint}/v2/images`,
    });
  }

  /**
   * Upload image from URL
   * This uses the Glance API to create an image and import it from a web URL
   */
  async uploadImageFromUrl(options: {
    name: string;
    url: string;
    format?: string;
    minDisk?: number;
    minRam?: number;
    visibility?: string;
  }): Promise<any> {
    const endpoint = await this.getEndpoint('image');

    // Step 1: Create the image record
    const imageData: any = {
      name: options.name,
      disk_format: options.format || 'qcow2',
      container_format: 'bare',
      visibility: options.visibility || 'public',
    };

    if (options.minDisk) {
      imageData.min_disk = options.minDisk;
    }

    if (options.minRam) {
      imageData.min_ram = options.minRam;
    }

    const createResponse = await this.request({
      method: 'POST',
      url: `${endpoint}/v2/images`,
      data: imageData,
    });

    const imageId = createResponse.id;

    // Step 2: Import image data from URL
    try {
      await this.request({
        method: 'POST',
        url: `${endpoint}/v2/images/${imageId}/import`,
        data: {
          method: {
            name: 'web-download',
            uri: options.url,
          },
        },
      });
    } catch (importError) {
      // If import fails, try to delete the created image
      try {
        await this.deleteImage(imageId);
      } catch (deleteError) {
        console.error('Failed to cleanup image after import error:', deleteError);
      }
      throw importError;
    }

    return createResponse;
  }

  /**
   * Delete an image
   */
  async deleteImage(imageId: string): Promise<void> {
    const endpoint = await this.getEndpoint('image');
    await this.request({
      method: 'DELETE',
      url: `${endpoint}/v2/images/${imageId}`,
    });
  }

  // ============================================================================
  // CINDER (Block Storage) API Methods
  // ============================================================================

  /**
   * List volumes
   */
  async listVolumes(): Promise<any> {
    const endpoint = await this.getEndpoint('volumev3');
    return this.request({
      method: 'GET',
      url: `${endpoint}/volumes/detail`,
    });
  }

  /**
   * Create a volume
   */
  async createVolume(data: {
    name: string;
    size: number;
    volumeType?: string;
    availabilityZone?: string;
    metadata?: Record<string, string>;
  }): Promise<any> {
    const endpoint = await this.getEndpoint('volumev3');

    // Build volume data - omit volume_type if it's __DEFAULT__ to let OpenStack choose
    const volumeData: any = {
      name: data.name,
      size: data.size,
      metadata: data.metadata || {},
    };

    // Only include volume_type if it's specified and not __DEFAULT__
    if (data.volumeType && data.volumeType !== '__DEFAULT__') {
      volumeData.volume_type = data.volumeType;
    }

    // Only include availability_zone if specified
    if (data.availabilityZone) {
      volumeData.availability_zone = data.availabilityZone;
    }

    const response = await this.request({
      method: 'POST',
      url: `${endpoint}/volumes`,
      data: {
        volume: volumeData,
      },
    });

    return response.volume;
  }

  /**
   * Get volume details
   */
  async getVolume(volumeId: string): Promise<any> {
    const endpoint = await this.getEndpoint('volumev3');

    const response = await this.request({
      method: 'GET',
      url: `${endpoint}/volumes/${volumeId}`,
    });

    return response.volume;
  }

  /**
   * Delete a volume
   */
  async deleteVolume(volumeId: string): Promise<void> {
    const endpoint = await this.getEndpoint('volumev3');
    await this.request({
      method: 'DELETE',
      url: `${endpoint}/volumes/${volumeId}`,
    });
  }

  /**
   * Attach volume to instance
   */
  async attachVolume(instanceId: string, volumeId: string, device?: string): Promise<any> {
    const endpoint = await this.getEndpoint('compute');

    const response = await this.request({
      method: 'POST',
      url: `${endpoint}/servers/${instanceId}/os-volume_attachments`,
      data: {
        volumeAttachment: {
          volumeId,
          device,
        },
      },
    });

    return response.volumeAttachment;
  }

  /**
   * Detach volume from instance
   */
  async detachVolume(instanceId: string, attachmentId: string): Promise<void> {
    const endpoint = await this.getEndpoint('compute');
    await this.request({
      method: 'DELETE',
      url: `${endpoint}/servers/${instanceId}/os-volume_attachments/${attachmentId}`,
    });
  }

  // ============================================================================
  // NEUTRON (Networking) API Methods
  // ============================================================================

  /**
   * List networks
   */
  async listNetworks(): Promise<any> {
    const endpoint = await this.getEndpoint('network');
    return this.request({
      method: 'GET',
      url: `${endpoint}/v2.0/networks`,
    });
  }

  /**
   * Create a network
   */
  async createNetwork(data: {
    name: string;
    adminStateUp?: boolean;
    shared?: boolean;
    external?: boolean;
  }): Promise<any> {
    const endpoint = await this.getEndpoint('network');

    const response = await this.request({
      method: 'POST',
      url: `${endpoint}/v2.0/networks`,
      data: {
        network: {
          name: data.name,
          admin_state_up: data.adminStateUp !== false,
          shared: data.shared || false,
          'router:external': data.external || false,
        },
      },
    });

    return response.network;
  }

  /**
   * Delete a network
   */
  async deleteNetwork(networkId: string): Promise<void> {
    const endpoint = await this.getEndpoint('network');
    await this.request({
      method: 'DELETE',
      url: `${endpoint}/v2.0/networks/${networkId}`,
    });
  }

  /**
   * List subnets
   */
  async listSubnets(networkId?: string): Promise<any> {
    const endpoint = await this.getEndpoint('network');
    const params = networkId ? { network_id: networkId } : {};

    return this.request({
      method: 'GET',
      url: `${endpoint}/v2.0/subnets`,
      params,
    });
  }

  /**
   * Create a subnet
   */
  async createSubnet(data: {
    networkId: string;
    name: string;
    cidr: string;
    ipVersion?: number;
    gateway?: string;
    enableDhcp?: boolean;
  }): Promise<any> {
    const endpoint = await this.getEndpoint('network');

    const response = await this.request({
      method: 'POST',
      url: `${endpoint}/v2.0/subnets`,
      data: {
        subnet: {
          network_id: data.networkId,
          name: data.name,
          cidr: data.cidr,
          ip_version: data.ipVersion || 4,
          gateway_ip: data.gateway,
          enable_dhcp: data.enableDhcp !== false,
        },
      },
    });

    return response.subnet;
  }

  /**
   * Delete a subnet
   */
  async deleteSubnet(subnetId: string): Promise<void> {
    const endpoint = await this.getEndpoint('network');
    await this.request({
      method: 'DELETE',
      url: `${endpoint}/v2.0/subnets/${subnetId}`,
    });
  }

  /**
   * Get network details
   */
  async getNetwork(networkId: string): Promise<any> {
    const endpoint = await this.getEndpoint('network');
    const response = await this.request({
      method: 'GET',
      url: `${endpoint}/v2.0/networks/${networkId}`,
    });
    return response.network;
  }

  // ============================================================================
  // SWIFT (Object Storage) API Methods
  // ============================================================================

  /**
   * List containers (buckets)
   */
  async listContainers(): Promise<any> {
    const endpoint = await this.getEndpoint('object-store');
    return this.request({
      method: 'GET',
      url: `${endpoint}?format=json`,
    });
  }

  /**
   * Create a container
   */
  async createContainer(name: string, isPublic: boolean = false): Promise<void> {
    const endpoint = await this.getEndpoint('object-store');

    const headers: any = {};
    if (isPublic) {
      headers['X-Container-Read'] = '.r:*,.rlistings';
    }

    await this.request({
      method: 'PUT',
      url: `${endpoint}/${name}`,
      headers,
    });
  }

  /**
   * Delete a container
   */
  async deleteContainer(name: string): Promise<void> {
    const endpoint = await this.getEndpoint('object-store');
    await this.request({
      method: 'DELETE',
      url: `${endpoint}/${name}`,
    });
  }

  /**
   * Get container metadata
   */
  async getContainerMetadata(name: string): Promise<any> {
    const endpoint = await this.getEndpoint('object-store');

    try {
      const response = await this.httpClient.head(`${endpoint}/${name}`, {
        headers: {
          'X-Auth-Token': await this.getToken(),
        },
      });

      return {
        objectCount: parseInt(response.headers['x-container-object-count'] || '0', 10),
        bytesUsed: parseInt(response.headers['x-container-bytes-used'] || '0', 10),
      };
    } catch (error) {
      console.error('Failed to get container metadata:', error);
      return {
        objectCount: 0,
        bytesUsed: 0,
      };
    }
  }

  /**
   * Update container access (public/private)
   */
  async updateContainerAccess(name: string, isPublic: boolean): Promise<void> {
    const endpoint = await this.getEndpoint('object-store');

    const headers: any = {};
    if (isPublic) {
      headers['X-Container-Read'] = '.r:*,.rlistings';
    } else {
      headers['X-Container-Read'] = '';
    }

    await this.request({
      method: 'POST',
      url: `${endpoint}/${name}`,
      headers,
    });
  }

  /**
   * List objects in a container
   */
  async listObjects(
    containerName: string,
    options?: { prefix?: string; marker?: string; limit?: number }
  ): Promise<any[]> {
    const endpoint = await this.getEndpoint('object-store');

    const params: any = { format: 'json' };
    if (options?.prefix) params.prefix = options.prefix;
    if (options?.marker) params.marker = options.marker;
    if (options?.limit) params.limit = options.limit;

    const queryString = new URLSearchParams(params).toString();

    const response = await this.request({
      method: 'GET',
      url: `${endpoint}/${containerName}?${queryString}`,
    });

    return response.data || [];
  }

  /**
   * Upload an object to a container
   */
  async uploadObject(
    containerName: string,
    objectName: string,
    data: Buffer | string,
    contentType?: string
  ): Promise<{ etag: string }> {
    const endpoint = await this.getEndpoint('object-store');

    const headers: any = {};
    if (contentType) {
      headers['Content-Type'] = contentType;
    }

    const response = await this.request({
      method: 'PUT',
      url: `${endpoint}/${containerName}/${objectName}`,
      headers,
      data,
    });

    return {
      etag: response.headers.etag || '',
    };
  }

  /**
   * Get object metadata
   */
  async getObjectMetadata(containerName: string, objectName: string): Promise<any> {
    const endpoint = await this.getEndpoint('object-store');

    const response = await this.httpClient.head(`${endpoint}/${containerName}/${objectName}`, {
      headers: {
        'X-Auth-Token': await this.getToken(),
      },
    });

    return {
      contentType: response.headers['content-type'],
      contentLength: parseInt(response.headers['content-length'] || '0', 10),
      lastModified: response.headers['last-modified'],
      etag: response.headers.etag,
    };
  }

  /**
   * Delete an object from a container
   */
  async deleteObject(containerName: string, objectName: string): Promise<void> {
    const endpoint = await this.getEndpoint('object-store');

    await this.request({
      method: 'DELETE',
      url: `${endpoint}/${containerName}/${objectName}`,
    });
  }

  /**
   * Get a temporary URL for accessing an object
   * Note: This requires Swift temp URL key to be configured
   */
  async getTempUrl(
    containerName: string,
    objectName: string,
    expiresIn: number = 3600
  ): Promise<string> {
    const endpoint = await this.getEndpoint('object-store');
    const expires = Math.floor(Date.now() / 1000) + expiresIn;

    // For now, return a direct URL
    // In production, you would generate a proper temp URL with HMAC signature
    // using the account's temp URL key
    return `${endpoint}/${containerName}/${objectName}?temp_url_expires=${expires}`;
  }

  // ============================================================================
  // FLOATING IP MANAGEMENT
  // ============================================================================

  /**
   * List floating IPs
   */
  async listFloatingIPs(): Promise<any> {
    const endpoint = await this.getEndpoint('network');
    return this.request({
      method: 'GET',
      url: `${endpoint}/v2.0/floatingips`,
    });
  }

  /**
   * Get floating IP by ID
   */
  async getFloatingIP(floatingIpId: string): Promise<any> {
    const endpoint = await this.getEndpoint('network');
    const response = await this.request({
      method: 'GET',
      url: `${endpoint}/v2.0/floatingips/${floatingIpId}`,
    });
    return response.floatingip;
  }

  /**
   * Create/Allocate a floating IP from an external network
   */
  async createFloatingIP(data: {
    floatingNetworkId: string;
    portId?: string;
    fixedIpAddress?: string;
    description?: string;
  }): Promise<any> {
    const endpoint = await this.getEndpoint('network');

    const response = await this.request({
      method: 'POST',
      url: `${endpoint}/v2.0/floatingips`,
      data: {
        floatingip: {
          floating_network_id: data.floatingNetworkId,
          port_id: data.portId,
          fixed_ip_address: data.fixedIpAddress,
          description: data.description,
        },
      },
    });

    return response.floatingip;
  }

  /**
   * Associate floating IP with an instance port
   */
  async associateFloatingIP(floatingIpId: string, portId: string): Promise<any> {
    const endpoint = await this.getEndpoint('network');

    const response = await this.request({
      method: 'PUT',
      url: `${endpoint}/v2.0/floatingips/${floatingIpId}`,
      data: {
        floatingip: {
          port_id: portId,
        },
      },
    });

    return response.floatingip;
  }

  /**
   * Disassociate floating IP from instance
   */
  async disassociateFloatingIP(floatingIpId: string): Promise<any> {
    const endpoint = await this.getEndpoint('network');

    const response = await this.request({
      method: 'PUT',
      url: `${endpoint}/v2.0/floatingips/${floatingIpId}`,
      data: {
        floatingip: {
          port_id: null,
        },
      },
    });

    return response.floatingip;
  }

  /**
   * Delete/Release a floating IP
   */
  async deleteFloatingIP(floatingIpId: string): Promise<void> {
    const endpoint = await this.getEndpoint('network');
    await this.request({
      method: 'DELETE',
      url: `${endpoint}/v2.0/floatingips/${floatingIpId}`,
    });
  }

  /**
   * List ports (network interfaces)
   */
  async listPorts(filters?: { device_id?: string; network_id?: string }): Promise<any> {
    const endpoint = await this.getEndpoint('network');
    return this.request({
      method: 'GET',
      url: `${endpoint}/v2.0/ports`,
      params: filters,
    });
  }

  /**
   * Get port by ID
   */
  async getPort(portId: string): Promise<any> {
    const endpoint = await this.getEndpoint('network');
    const response = await this.request({
      method: 'GET',
      url: `${endpoint}/v2.0/ports/${portId}`,
    });
    return response.port;
  }
}

// Singleton instance
let openstackClient: OpenStackClient | null = null;

/**
 * Get the OpenStack client instance
 */
export function getOpenStackClient(): OpenStackClient {
  if (!openstackClient) {
    openstackClient = new OpenStackClient();
  }
  return openstackClient;
}
