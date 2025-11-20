/**
 * External Plugin Service
 * External plugin task management
 */

import * as grpc from '@grpc/grpc-js';

import { flyteidl } from '@app/dsl/gen/pb-js/flyteidl';

import { CallOptions } from '../grpc/types';
import { EngineGrpcClient } from '../grpc/client';

export class ExternalPluginService extends EngineGrpcClient {
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
      CreateTask: {
        path: '/flyteidl.service.ExternalPluginService/CreateTask',
        requestStream: false,
        responseStream: false,
        requestSerialize: serialize,
        responseDeserialize: deserialize,
      },
      GetTask: {
        path: '/flyteidl.service.ExternalPluginService/GetTask',
        requestStream: false,
        responseStream: false,
        requestSerialize: serialize,
        responseDeserialize: deserialize,
      },
      DeleteTask: {
        path: '/flyteidl.service.ExternalPluginService/DeleteTask',
        requestStream: false,
        responseStream: false,
        requestSerialize: serialize,
        responseDeserialize: deserialize,
      },
    };
    const GenericClient = grpc.makeGenericClientConstructor(
      serviceMethods as any,
      'ExternalPluginService',
      {}
    );
    return new GenericClient(
      `${this.config.host}:${this.config.port}`,
      this.credentials,
      this.config.channelOptions || {}
    );
  }

  /**
   * Create an external plugin task
   */
  async createTask(
    request: flyteidl.admin.TaskCreateRequest,
    options?: CallOptions
  ): Promise<flyteidl.admin.TaskCreateResponse> {
    return this.call('CreateTask', request, options);
  }

  /**
   * Get an external plugin task
   */
  async getTask(
    request: flyteidl.admin.ObjectGetRequest,
    options?: CallOptions
  ): Promise<flyteidl.admin.Task> {
    return this.call('GetTask', request, options);
  }

  /**
   * Delete an external plugin task
   */
  async deleteTask(
    request: flyteidl.admin.ObjectGetRequest,
    options?: CallOptions
  ): Promise<flyteidl.admin.TaskCreateResponse> {
    return this.call('DeleteTask', request, options);
  }
}
