/**
 * Data Proxy Service
 * Data upload/download proxy operations
 */

import * as grpc from '@grpc/grpc-js';

import { flyteidl } from '@app/dsl/gen/pb-js/flyteidl';

import { CallOptions } from '../grpc/types';
import { EngineGrpcClient } from '../grpc/client';

export class DataProxyService extends EngineGrpcClient {
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
      CreateUploadLocation: {
        path: '/flyteidl.service.DataProxyService/CreateUploadLocation',
        requestStream: false,
        responseStream: false,
        requestSerialize: serialize,
        responseDeserialize: deserialize,
      },
      CreateDownloadLocation: {
        path: '/flyteidl.service.DataProxyService/CreateDownloadLocation',
        requestStream: false,
        responseStream: false,
        requestSerialize: serialize,
        responseDeserialize: deserialize,
      },
      CreateDownloadLink: {
        path: '/flyteidl.service.DataProxyService/CreateDownloadLink',
        requestStream: false,
        responseStream: false,
        requestSerialize: serialize,
        responseDeserialize: deserialize,
      },
    };
    const GenericClient = grpc.makeGenericClientConstructor(
      serviceMethods as any,
      'DataProxyService',
      {}
    );
    return new GenericClient(
      `${this.config.host}:${this.config.port}`,
      this.credentials,
      this.config.channelOptions
    );
  }

  /**
   * Create upload location for data artifacts
   */
  async createUploadLocation(
    request: flyteidl.service.CreateUploadLocationRequest,
    options?: CallOptions
  ): Promise<flyteidl.service.CreateUploadLocationResponse> {
    return this.call('CreateUploadLocation', request, options);
  }

  /**
   * Create download location for data artifacts
   */
  async createDownloadLocation(
    request: flyteidl.service.CreateDownloadLocationRequest,
    options?: CallOptions
  ): Promise<flyteidl.service.CreateDownloadLocationResponse> {
    return this.call('CreateDownloadLocation', request, options);
  }

  /**
   * Create download link for data artifacts
   */
  async createDownloadLink(
    request: flyteidl.service.CreateDownloadLinkRequest,
    options?: CallOptions
  ): Promise<flyteidl.service.CreateDownloadLinkResponse> {
    return this.call('CreateDownloadLink', request, options);
  }
}
