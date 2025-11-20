import Core from './core';
import { ProtobufStruct } from './protobufTypes';

/* --- BEGIN flyteidl type aliases --- */
/** These are types shared across multiple sections of the data model. Most of
 * map to types found in `flyteidl.core`.
 */

/* Export enum types and values separately to avoid redeclare errors */
export type CoreSimpleType = Core.SimpleType;
export const CoreSimpleTypeEnum = Core.SimpleType;
export type CoreEnumType = Core.EnumType;
export const CoreEnumTypeEnum = Core.EnumType;
export type CoreBlobDimensionality = Core.BlobType.BlobDimensionality;
export const CoreBlobDimensionalityEnum = Core.BlobType.BlobDimensionality;
export type CoreSchemaColumnType = Core.SchemaType.SchemaColumn.SchemaColumnType;
export const CoreSchemaColumnTypeEnum = Core.SchemaType.SchemaColumn.SchemaColumnType;

/** Literals */
interface BlobType extends Core.IBlobType {
  dimensionality: CoreBlobDimensionality;
}

/** A Core.ILiteral guaranteed to have all subproperties necessary to specify
 * a Blob.
 */
interface SchemaColumn extends Core.SchemaType.ISchemaColumn {
  name: string;
  type: CoreSchemaColumnType;
}

interface SchemaType extends Core.ISchemaType {
  columns: SchemaColumn[];
}

export interface LiteralType extends Core.ILiteralType {
  blob?: BlobType;
  collectionType?: LiteralType;
  mapValueType?: LiteralType;
  metadata?: ProtobufStruct;
  schema?: SchemaType;
  simple?: CoreSimpleType;
  enumType?: CoreEnumType;
}

/* --- END flyteidl type aliases --- */

export enum InputType {
  Binary = 'BINARY',
  Blob = 'BLOB',
  Boolean = 'BOOLEAN',
  Collection = 'COLLECTION',
  Datetime = 'DATETIME',
  Duration = 'DURATION',
  Error = 'ERROR',
  Enum = 'ENUM',
  Float = 'FLOAT',
  Integer = 'INTEGER',
  Map = 'MAP',
  None = 'NONE',
  Schema = 'SCHEMA',
  String = 'STRING',
  Struct = 'STRUCT',
  Union = 'Union',
  Unknown = 'UNKNOWN',
}

/** Maps nested `CoreSimpleType`s to our flattened `InputType` enum. */
export const simpleTypeToInputType: { [k in CoreSimpleType]: InputType } = {
  [CoreSimpleTypeEnum.BINARY]: InputType.Binary,
  [CoreSimpleTypeEnum.BOOLEAN]: InputType.Boolean,
  [CoreSimpleTypeEnum.DATETIME]: InputType.Datetime,
  [CoreSimpleTypeEnum.DURATION]: InputType.Duration,
  [CoreSimpleTypeEnum.ERROR]: InputType.Error,
  [CoreSimpleTypeEnum.FLOAT]: InputType.Float,
  [CoreSimpleTypeEnum.INTEGER]: InputType.Integer,
  [CoreSimpleTypeEnum.NONE]: InputType.None,
  [CoreSimpleTypeEnum.STRING]: InputType.String,
  [CoreSimpleTypeEnum.STRUCT]: InputType.Struct,
};

export interface InputTypeDefinition {
  type: InputType;
  subtype?: InputTypeDefinition;
  listOfSubTypes?: InputTypeDefinition[];
}
