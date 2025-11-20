/**
 * Identity Service
 * User and identity management
 */

import * as grpc from '@grpc/grpc-js';

import { flyteidl } from '@app/dsl/gen/pb-js/flyteidl';

import { CallOptions } from '../grpc/types';
import { EngineGrpcClient } from '../grpc/client';

export class IdentityService extends EngineGrpcClient {
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
      UserInfo: {
        path: '/flyteidl.service.IdentityService/UserInfo',
        requestStream: false,
        responseStream: false,
        requestSerialize: serialize,
        responseDeserialize: deserialize,
      },
    };
    const GenericClient = grpc.makeGenericClientConstructor(
      serviceMethods as any,
      'IdentityService',
      {}
    );
    return new GenericClient(
      `${this.config.host}:${this.config.port}`,
      this.credentials,
      this.config.channelOptions
    );
  }

  /**
   * Get user information
   */
  async userInfo(
    request: flyteidl.service.UserInfoRequest,
    options?: CallOptions
  ): Promise<flyteidl.service.UserInfoResponse> {
    return this.call('UserInfo', request, options);
  }
}
