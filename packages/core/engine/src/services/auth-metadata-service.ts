/**
 * Auth Metadata Service
 * OAuth2 and authentication metadata management
 */

import * as grpc from '@grpc/grpc-js';

import { flyteidl } from '@app/dsl/gen/pb-js/flyteidl';

import { CallOptions } from '../grpc/types';
import { EngineGrpcClient } from '../grpc/client';

export class AuthMetadataService extends EngineGrpcClient {
  /**
   * Create the gRPC service client
   */
  protected async createServiceClient(): Promise<any> {
    const serialize = (obj: any) => {
      if (Buffer.isBuffer(obj)) return obj;
      return Buffer.from(JSON.stringify(obj));
    };

    const deserialize = (buffer: Buffer) => {
      try {
        return JSON.parse(buffer.toString());
      } catch {
        return buffer;
      }
    };

    const serviceMethods = {
      GetOAuth2Metadata: {
        path: '/flyteidl.service.AuthMetadataService/GetOAuth2Metadata',
        requestStream: false,
        responseStream: false,
        requestSerialize: serialize,
        responseDeserialize: deserialize,
      },
      GetPublicClientConfig: {
        path: '/flyteidl.service.AuthMetadataService/GetPublicClientConfig',
        requestStream: false,
        responseStream: false,
        requestSerialize: serialize,
        responseDeserialize: deserialize,
      },
    };
    const GenericClient = grpc.makeGenericClientConstructor(
      serviceMethods as any,
      'AuthMetadataService',
      {}
    );
    return new GenericClient(
      `${this.config.host}:${this.config.port}`,
      this.credentials,
      this.config.channelOptions
    );
  }

  /**
   * Get OAuth2 metadata
   */
  async getOAuth2Metadata(
    request: flyteidl.service.OAuth2MetadataRequest,
    options?: CallOptions
  ): Promise<flyteidl.service.OAuth2MetadataResponse> {
    return this.call('GetOAuth2Metadata', request, options);
  }

  /**
   * Get public client authentication configuration
   */
  async getPublicClientConfig(
    request: flyteidl.service.PublicClientAuthConfigRequest,
    options?: CallOptions
  ): Promise<flyteidl.service.PublicClientAuthConfigResponse> {
    return this.call('GetPublicClientConfig', request, options);
  }
}
