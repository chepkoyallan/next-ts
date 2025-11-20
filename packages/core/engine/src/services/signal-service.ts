/**
 * Signal Service
 * Signal management for workflow communication
 */

import * as grpc from '@grpc/grpc-js';

import { flyteidl } from '@app/dsl/gen/pb-js/flyteidl';

import { CallOptions } from '../grpc/types';
import { EngineGrpcClient } from '../grpc/client';

export class SignalService extends EngineGrpcClient {
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
      GetOrCreateSignal: {
        path: '/flyteidl.service.SignalService/GetOrCreateSignal',
        requestStream: false,
        responseStream: false,
        requestSerialize: serialize,
        responseDeserialize: deserialize,
      },
      ListSignals: {
        path: '/flyteidl.service.SignalService/ListSignals',
        requestStream: false,
        responseStream: false,
        requestSerialize: serialize,
        responseDeserialize: deserialize,
      },
      SetSignal: {
        path: '/flyteidl.service.SignalService/SetSignal',
        requestStream: false,
        responseStream: false,
        requestSerialize: serialize,
        responseDeserialize: deserialize,
      },
    };
    const GenericClient = grpc.makeGenericClientConstructor(
      serviceMethods as any,
      'SignalService',
      {}
    );
    return new GenericClient(
      `${this.config.host}:${this.config.port}`,
      this.credentials,
      this.config.channelOptions
    );
  }

  /**
   * Get or create a signal
   */
  async getOrCreateSignal(
    request: flyteidl.admin.SignalGetOrCreateRequest,
    options?: CallOptions
  ): Promise<flyteidl.admin.Signal> {
    return this.call('GetOrCreateSignal', request, options);
  }

  /**
   * List signals
   */
  async listSignals(
    request: flyteidl.admin.SignalListRequest,
    options?: CallOptions
  ): Promise<flyteidl.admin.SignalList> {
    return this.call('ListSignals', request, options);
  }

  /**
   * Set signal value
   */
  async setSignal(
    request: flyteidl.admin.SignalSetRequest,
    options?: CallOptions
  ): Promise<flyteidl.admin.SignalSetResponse> {
    return this.call('SetSignal', request, options);
  }
}
