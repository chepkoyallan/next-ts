/**
 * Protocol Buffer Serialization Utilities
 * Helper functions for encoding/decoding protobuf messages
 */

/* eslint-disable max-classes-per-file */
import { flyteidl } from '@app/dsl/gen/pb-js/flyteidl';

/**
 * Generic protobuf message type
 */
export interface ProtoMessage {
  encode(writer?: any): any;
  toJSON(): any;
}

/**
 * Protocol Buffer Serializer
 */
export class ProtoSerializer {
  /**
   * Encode a message to binary format
   */
  static encode<T extends ProtoMessage>(message: T, MessageType: any): Uint8Array {
    try {
      return MessageType.encode(message).finish();
    } catch (error) {
      throw new Error(`Failed to encode message: ${(error as Error).message}`);
    }
  }

  /**
   * Decode a message from binary format
   */
  static decode<T>(bytes: Uint8Array, MessageType: any): T {
    try {
      return MessageType.decode(bytes) as T;
    } catch (error) {
      throw new Error(`Failed to decode message: ${(error as Error).message}`);
    }
  }

  /**
   * Convert message to JSON
   */
  static toJSON<T extends ProtoMessage>(message: T): any {
    try {
      return message.toJSON();
    } catch (error) {
      throw new Error(`Failed to convert message to JSON: ${(error as Error).message}`);
    }
  }

  /**
   * Create message from JSON
   */
  static fromJSON<T>(json: any, MessageType: any): T {
    try {
      return MessageType.fromObject(json) as T;
    } catch (error) {
      throw new Error(`Failed to create message from JSON: ${(error as Error).message}`);
    }
  }

  /**
   * Verify message integrity
   */
  static verify(message: any, MessageType: any): string | null {
    try {
      return MessageType.verify(message);
    } catch (error) {
      return (error as Error).message;
    }
  }

  /**
   * Create a message with defaults
   */
  static create<T>(properties: any, MessageType: any): T {
    try {
      return MessageType.create(properties) as T;
    } catch (error) {
      throw new Error(`Failed to create message: ${(error as Error).message}`);
    }
  }
}

/**
 * Task-specific serialization helpers
 */
export class TaskSerializer {
  static encodeTask(task: flyteidl.admin.ITask): Uint8Array {
    return ProtoSerializer.encode(task as any, flyteidl.admin.Task);
  }

  static decodeTask(bytes: Uint8Array): flyteidl.admin.Task {
    return ProtoSerializer.decode(bytes, flyteidl.admin.Task);
  }

  static taskToJSON(task: flyteidl.admin.ITask): any {
    return task;
  }

  static taskFromJSON(json: any): flyteidl.admin.Task {
    return ProtoSerializer.fromJSON(json, flyteidl.admin.Task);
  }
}

/**
 * Workflow-specific serialization helpers
 */
export class WorkflowSerializer {
  static encodeWorkflow(workflow: flyteidl.admin.IWorkflow): Uint8Array {
    return ProtoSerializer.encode(workflow as any, flyteidl.admin.Workflow);
  }

  static decodeWorkflow(bytes: Uint8Array): flyteidl.admin.Workflow {
    return ProtoSerializer.decode(bytes, flyteidl.admin.Workflow);
  }

  static workflowToJSON(workflow: flyteidl.admin.IWorkflow): any {
    return workflow;
  }

  static workflowFromJSON(json: any): flyteidl.admin.Workflow {
    return ProtoSerializer.fromJSON(json, flyteidl.admin.Workflow);
  }
}

/**
 * Execution-specific serialization helpers
 */
export class ExecutionSerializer {
  static encodeExecution(execution: flyteidl.admin.IExecution): Uint8Array {
    return ProtoSerializer.encode(execution as any, flyteidl.admin.Execution);
  }

  static decodeExecution(bytes: Uint8Array): flyteidl.admin.Execution {
    return ProtoSerializer.decode(bytes, flyteidl.admin.Execution);
  }

  static executionToJSON(execution: flyteidl.admin.IExecution): any {
    return execution;
  }

  static executionFromJSON(json: any): flyteidl.admin.Execution {
    return ProtoSerializer.fromJSON(json, flyteidl.admin.Execution);
  }
}

/**
 * Literal (input/output) serialization helpers
 */
export class LiteralSerializer {
  static encodeLiteral(literal: flyteidl.core.ILiteral): Uint8Array {
    return ProtoSerializer.encode(literal as any, flyteidl.core.Literal);
  }

  static decodeLiteral(bytes: Uint8Array): flyteidl.core.Literal {
    return ProtoSerializer.decode(bytes, flyteidl.core.Literal);
  }

  static encodeLiteralMap(literalMap: flyteidl.core.ILiteralMap): Uint8Array {
    return ProtoSerializer.encode(literalMap as any, flyteidl.core.LiteralMap);
  }

  static decodeLiteralMap(bytes: Uint8Array): flyteidl.core.LiteralMap {
    return ProtoSerializer.decode(bytes, flyteidl.core.LiteralMap);
  }

  static literalToJSON(literal: flyteidl.core.ILiteral): any {
    return literal;
  }

  static literalFromJSON(json: any): flyteidl.core.Literal {
    return ProtoSerializer.fromJSON(json, flyteidl.core.Literal);
  }
}

/**
 * Validate and sanitize protobuf message
 */
export function validateMessage<T>(
  message: T,
  MessageType: any
): { valid: boolean; error?: string } {
  const error = ProtoSerializer.verify(message, MessageType);
  return {
    valid: error === null,
    error: error || undefined,
  };
}

/**
 * Deep clone a protobuf message
 */
export function cloneMessage<T>(message: T, MessageType: any): T {
  return MessageType.fromObject(message);
}

/**
 * Compare two protobuf messages for equality
 */
export function messagesEqual<T>(message1: T, message2: T, MessageType: any): boolean {
  const json1 = JSON.stringify(message1);
  const json2 = JSON.stringify(message2);
  return json1 === json2;
}
