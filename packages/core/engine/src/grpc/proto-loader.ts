/**
 * Proto Loader Utility
 * Loads protobuf service definitions using @grpc/proto-loader
 */

import path from 'path';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

// Proto file paths
const PROTO_DIR = path.resolve(process.cwd(), 'src/dsl/protos');

export interface ProtoServiceDefinition {
  [serviceName: string]: grpc.ServiceClientConstructor;
}

/**
 * Load a proto file and return the service definitions
 */
export async function loadProtoService(
  protoPath: string,
  packageName: string
): Promise<ProtoServiceDefinition> {
  const packageDefinition = await protoLoader.load(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
    includeDirs: [PROTO_DIR],
  });

  const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);

  // Navigate to the package
  let pkg: any = protoDescriptor;
  packageName.split('.').forEach((part) => {
    pkg = pkg[part];
    if (!pkg) {
      throw new Error(`Package ${packageName} not found in proto file ${protoPath}`);
    }
  });

  return pkg as ProtoServiceDefinition;
}

/**
 * Load Flyte Admin service
 */
export async function loadAdminService(): Promise<grpc.ServiceClientConstructor> {
  const protoPath = path.join(PROTO_DIR, 'flyteidl/service/admin.proto');
  const services = await loadProtoService(protoPath, 'flyteidl.service');
  return services.AdminService;
}

/**
 * Load Auth Metadata service
 */
export async function loadAuthMetadataService(): Promise<grpc.ServiceClientConstructor> {
  const protoPath = path.join(PROTO_DIR, 'flyteidl/service/auth.proto');
  const services = await loadProtoService(protoPath, 'flyteidl.service');
  return services.AuthMetadataService;
}

/**
 * Load Data Proxy service
 */
export async function loadDataProxyService(): Promise<grpc.ServiceClientConstructor> {
  const protoPath = path.join(PROTO_DIR, 'flyteidl/service/dataproxy.proto');
  const services = await loadProtoService(protoPath, 'flyteidl.service');
  return services.DataProxyService;
}

/**
 * Load External Plugin service
 */
export async function loadExternalPluginService(): Promise<grpc.ServiceClientConstructor> {
  const protoPath = path.join(PROTO_DIR, 'flyteidl/service/external_plugin_service.proto');
  const services = await loadProtoService(protoPath, 'flyteidl.service');
  return services.ExternalPluginService;
}

/**
 * Load Identity service
 */
export async function loadIdentityService(): Promise<grpc.ServiceClientConstructor> {
  const protoPath = path.join(PROTO_DIR, 'flyteidl/service/identity.proto');
  const services = await loadProtoService(protoPath, 'flyteidl.service');
  return services.IdentityService;
}

/**
 * Load Signal service
 */
export async function loadSignalService(): Promise<grpc.ServiceClientConstructor> {
  const protoPath = path.join(PROTO_DIR, 'flyteidl/service/signal.proto');
  const services = await loadProtoService(protoPath, 'flyteidl.service');
  return services.SignalService;
}

/**
 * Load Agent Metadata service
 */
export async function loadAgentMetadataService(): Promise<grpc.ServiceClientConstructor> {
  const protoPath = path.join(PROTO_DIR, 'flyteidl/service/agent.proto');
  const services = await loadProtoService(protoPath, 'flyteidl.service');
  return services.AgentMetadataService;
}
