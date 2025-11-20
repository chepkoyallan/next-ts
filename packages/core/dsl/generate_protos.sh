#!/bin/bash
set -e

DIR=`pwd`
rm -rf $DIR/gen
LYFT_IMAGE="lyft/protocgenerator:8167e11d3b3439373c2f033080a4b550078884a2"
SWAGGER_CLI_IMAGE="ghcr.io/flyteorg/swagger-codegen-cli:latest"
PROTOC_GEN_DOC_IMAGE="pseudomuto/protoc-gen-doc:1.4.1"

# Override system locale during protos/docs generation to ensure consistent sorting (differences in system locale could e.g. lead to differently ordered docs)
export LC_ALL=C.UTF-8

docker run --rm -u $(id -u):$(id -g) -v $DIR:/defs $LYFT_IMAGE -i ./protos -d protos/flyteidl/service --with_gateway -l go --go_source_relative
docker run --rm -u $(id -u):$(id -g) -v $DIR:/defs $LYFT_IMAGE -i ./protos -d protos/flyteidl/admin --with_gateway -l go --go_source_relative --validate_out
docker run --rm -u $(id -u):$(id -g) -v $DIR:/defs $LYFT_IMAGE -i ./protos -d protos/flyteidl/core --with_gateway -l go --go_source_relative --validate_out
docker run --rm -u $(id -u):$(id -g) -v $DIR:/defs $LYFT_IMAGE -i ./protos -d protos/flyteidl/event --with_gateway -l go --go_source_relative --validate_out
docker run --rm -u $(id -u):$(id -g) -v $DIR:/defs $LYFT_IMAGE -i ./protos -d protos/flyteidl/plugins -l go --go_source_relative --validate_out
docker run --rm -u $(id -u):$(id -g) -v $DIR:/defs $LYFT_IMAGE -i ./protos -d protos/flyteidl/datacatalog -l go --go_source_relative --validate_out

languages=("cpp" "java" "python")
idlfolders=("service" "admin" "core" "event" "plugins" "datacatalog")

for lang in "${languages[@]}"
do
    for folder in "${idlfolders[@]}"
    do
        docker run --rm -u $(id -u):$(id -g) -v $DIR:/defs $LYFT_IMAGE -i ./protos -d protos/flyteidl/$folder -l $lang
    done
done

# Buf migration (commented out since we're using Docker containers for protobuf generation)
# docker run -u $(id -u):$(id -g) -e "BUF_CACHE_DIR=/tmp/cache" --volume "$(pwd):/workspace" --workdir /workspace bufbuild/buf generate

# Unfortunately the python protoc plugin does not add __init__.py files to the generated code
# (as described in https://github.com/protocolbuffers/protobuf/issues/881). One of the
# suggestions is to manually create such files, which is what we do here:
if [ -d "gen/pb_python" ]; then
    find gen/pb_python -type d -exec touch {}/__init__.py \;
fi

# Docs generated

# # Remove any currently generated core docs file
# ls -d protos/docs/core/* | grep -v index.rst | xargs rm
# # Use list of proto files in core directory to generate the RST files required for sphinx conversion. Additionally generate for google.protobuf.[timestamp | struct | duration].
# docker run --rm -u $(id -u):$(id -g) -v $DIR/protos:/protos:ro -v $DIR/protos/docs/core:/out:rw -v $DIR/tmp/doc_gen_deps:/tmp/doc_gen_deps:ro $PROTOC_GEN_DOC_IMAGE --doc_opt=protos/docs/restructuredtext.tmpl,core.rst -I=tmp/doc_gen_deps -I=protos `ls protos/flyteidl/core/*.proto | xargs` tmp/doc_gen_deps/google/protobuf/timestamp.proto tmp/doc_gen_deps/google/protobuf/duration.proto tmp/doc_gen_deps/google/protobuf/struct.proto

# # Remove any currently generated admin docs file
# ls -d protos/docs/admin/* | grep -v index.rst | xargs rm
# # Use list of proto files in admin directory to generate the RST files required for sphinx conversion. Additionally generate for google.protobuf.[duration | wrappers].
# docker run --rm -u $(id -u):$(id -g) -v $DIR/protos:/protos:ro -v $DIR/protos/docs/admin:/out:rw -v $DIR/tmp/doc_gen_deps:/tmp/doc_gen_deps:ro $PROTOC_GEN_DOC_IMAGE --doc_opt=protos/docs/withoutscalar_restructuredtext.tmpl,admin.rst -I=tmp/doc_gen_deps -I=protos `ls protos/flyteidl/admin/*.proto | xargs` tmp/doc_gen_deps/google/protobuf/duration.proto tmp/doc_gen_deps/google/protobuf/wrappers.proto

# # Remove any currently generated datacatalog docs file
# ls -d protos/docs/datacatalog/* | grep -v index.rst | xargs rm
# # Use list of proto files in datacatalog directory to generate the RST files required for sphinx conversion. Additionally generate for google.protobuf.[timestamp | struct | duration].
# docker run --rm -u $(id -u):$(id -g) -v $DIR/protos:/protos:ro -v $DIR/protos/docs/datacatalog:/out:rw -v $DIR/tmp/doc_gen_deps:/tmp/doc_gen_deps:ro $PROTOC_GEN_DOC_IMAGE --doc_opt=protos/docs/withoutscalar_restructuredtext.tmpl,datacatalog.rst -I=tmp/doc_gen_deps -I=protos `ls protos/flyteidl/datacatalog/*.proto | xargs` tmp/doc_gen_deps/google/protobuf/timestamp.proto tmp/doc_gen_deps/google/protobuf/duration.proto tmp/doc_gen_deps/google/protobuf/struct.proto

# # Remove any currently generated event docs file
# ls -d protos/docs/event/* | grep -v index.rst | xargs rm
# # Use list of proto files in event directory to generate the RST files required for sphinx conversion. Additionally generate for google.protobuf.[timestamp | struct | duration].
# docker run --rm -u $(id -u):$(id -g) -v $DIR/protos:/protos:ro -v $DIR/protos/docs/event:/out:rw -v $DIR/tmp/doc_gen_deps:/tmp/doc_gen_deps:ro $PROTOC_GEN_DOC_IMAGE --doc_opt=protos/docs/withoutscalar_restructuredtext.tmpl,event.rst -I=tmp/doc_gen_deps -I=protos `ls protos/flyteidl/event/*.proto | xargs` tmp/doc_gen_deps/google/protobuf/timestamp.proto tmp/doc_gen_deps/google/protobuf/duration.proto tmp/doc_gen_deps/google/protobuf/struct.proto

# # Remove any currently generated plugins docs file
# ls -d protos/docs/plugins/* | grep -v index.rst | xargs rm
# # Use list of proto files in plugins directory to generate the RST files required for sphinx conversion
# docker run --rm -u $(id -u):$(id -g) -v $DIR/protos:/protos:ro -v $DIR/protos/docs/plugins:/out:rw -v $DIR/tmp/doc_gen_deps:/tmp/doc_gen_deps:ro $PROTOC_GEN_DOC_IMAGE --doc_opt=protos/docs/withoutscalar_restructuredtext.tmpl,plugins.rst -I=protos -I=tmp/doc_gen_deps `ls protos/flyteidl/plugins/*.proto | xargs`

# # Remove any currently generated service docs file
# ls -d protos/docs/service/* | grep -v index.rst | xargs rm
# # Use list of proto files in service directory to generate the RST files required for sphinx conversion
# docker run --rm -u $(id -u):$(id -g) -v $DIR/protos:/protos:ro -v $DIR/protos/docs/service:/out:rw -v $DIR/tmp/doc_gen_deps:/tmp/doc_gen_deps:ro $PROTOC_GEN_DOC_IMAGE --doc_opt=protos/docs/withoutscalar_restructuredtext.tmpl,service.rst -I=protos -I=tmp/doc_gen_deps `ls protos/flyteidl/service/*.proto | xargs`

# Generate binary data from OpenAPI 2 file
docker run --rm -u $(id -u):$(id -g) -v $DIR/gen/pb-go/flyteidl/service:/service --entrypoint go-bindata $LYFT_IMAGE -pkg service -o /service/openapi.go -prefix /service/ -modtime 1562572800 /service/admin.swagger.json

# Generate JS code
docker run --rm -u $(id -u):$(id -g) -v $DIR:/defs schottra/docker-protobufjs:v0.0.2 --module-name flyteidl -d protos/flyteidl/core  -d protos/flyteidl/event -d protos/flyteidl/admin -d protos/flyteidl/service  -- --root flyteidl -t static-module -w default --no-delimited --force-long --no-convert -p /defs/protos

# Generate TypeScript definitions and setup
mkdir -p gen/pb-ts

# Generate TypeScript using a simpler approach
# Generate JavaScript files to TypeScript directory (they work with TypeScript too)
docker run --rm -u $(id -u):$(id -g) -v $DIR:/defs schottra/docker-protobufjs:v0.0.2 --module-name flyteidl -d protos/flyteidl/core -d protos/flyteidl/event -d protos/flyteidl/admin -d protos/flyteidl/service -d protos/flyteidl/plugins -d protos/flyteidl/datacatalog -o gen/pb-ts/flyteidl.js -- --root flyteidl -t static-module -w default --no-delimited --force-long --no-convert -p /defs/protos

# Generate TypeScript definitions separately
docker run --rm -u $(id -u):$(id -g) -v $DIR:/defs schottra/docker-protobufjs:v0.0.2 --module-name flyteidl -d protos/flyteidl/core -d protos/flyteidl/event -d protos/flyteidl/admin -d protos/flyteidl/service -d protos/flyteidl/plugins -d protos/flyteidl/datacatalog -o gen/pb-ts/flyteidl.d.ts -- --root flyteidl -t static-module -w default --no-delimited --force-long --no-convert -p /defs/protos --ts

# Generate GO API client code
docker run --rm -u $(id -u):$(id -g) --rm -v $DIR:/defs $SWAGGER_CLI_IMAGE generate -i /defs/gen/pb-go/flyteidl/service/admin.swagger.json -l go -o /defs/gen/pb-go/flyteidl/service/flyteadmin --additional-properties=packageName=flyteadmin

# # Generate Python API client code
docker run --rm -u $(id -u):$(id -g) --rm -v $DIR:/defs $SWAGGER_CLI_IMAGE generate -i /defs/gen/pb-go/flyteidl/service/admin.swagger.json -l python -o /defs/gen/pb_python/flyteidl/service/flyteadmin --additional-properties=packageName=flyteadmin

# Remove documentation generated from the swagger-codegen-cli
rm -rf gen/pb-go/flyteidl/service/flyteadmin/docs
rm -rf gen/pb_python/flyteidl/service/flyteadmin/docs

# Setup TypeScript package structure
if [ -d "gen/pb-ts" ]; then
    # Create package.json for TypeScript module
    cat > gen/pb-ts/package.json << EOF
{
  "name": "@flyteidl/pb-ts",
  "version": "1.0.0",
  "description": "Generated TypeScript protobuf definitions for FlyteIDL",
  "main": "flyteidl.js",
  "types": "flyteidl.d.ts",
  "type": "commonjs",
  "scripts": {
    "build": "tsc",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": ["protobuf", "grpc", "flyte", "orchestrator", "typescript"],
  "author": "Flyte Team",
  "license": "Apache-2.0",
  "dependencies": {
    "protobufjs": "^7.2.0",
    "@types/node": "^20.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
EOF

    # Create TypeScript configuration
    cat > gen/pb-ts/tsconfig.json << EOF
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "moduleResolution": "node",
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "allowSyntheticDefaultImports": true
  },
  "include": [
    "*.ts",
    "*.js"
  ],
  "exclude": [
    "node_modules",
    "dist"
  ]
}
EOF

    # Create main index.ts file
    cat > gen/pb-ts/index.ts << EOF
// Auto-generated TypeScript index file for FlyteIDL protobuf definitions
import * as flyteidl from './flyteidl';

// Re-export the main module
export = flyteidl;

// Also provide named exports for convenience
export namespace FlyteIDL {
  export import admin = flyteidl.flyteidl.admin;
  export import core = flyteidl.flyteidl.core;
  export import event = flyteidl.flyteidl.event;
  export import plugins = flyteidl.flyteidl.plugins;
  export import service = flyteidl.flyteidl.service;
  export import datacatalog = flyteidl.flyteidl.datacatalog;
}
EOF

    # Create README for TypeScript module
    cat > gen/pb-ts/README.md << EOF
# FlyteIDL TypeScript Protobuf Definitions

This package contains auto-generated TypeScript protobuf definitions for FlyteIDL.

## Installation

\`\`\`bash
npm install @flyteidl/pb-ts
\`\`\`

## Usage

### TypeScript
\`\`\`typescript
import * as flyteidl from '@flyteidl/pb-ts';
import { FlyteIDL } from '@flyteidl/pb-ts';

// Use the main module
const workflow = new flyteidl.flyteidl.core.WorkflowTemplate();

// Or use the convenience namespace
const execution = new FlyteIDL.admin.Execution();
\`\`\`

### JavaScript
\`\`\`javascript
const flyteidl = require('@flyteidl/pb-ts');

const workflow = new flyteidl.flyteidl.core.WorkflowTemplate();
const execution = new flyteidl.flyteidl.admin.Execution();
\`\`\`

## Modules

- **admin**: Administrative operations and entities
- **core**: Core workflow and task definitions  
- **event**: Event handling and notifications
- **plugins**: Plugin definitions and configurations
- **service**: gRPC service definitions
- **datacatalog**: Data catalog operations

## Features

- 🎯 **Full TypeScript Support**: Complete type safety with generated TypeScript definitions
- 📦 **CommonJS Compatible**: Works with Node.js and bundlers
- 🚀 **Protobufjs**: Generated using protobufjs for optimal performance
- 🛡️ **Type Safe**: Compile-time validation of protobuf usage

## Development

\`\`\`bash
# Build TypeScript
npm run build

# The built files will be in ./dist/
\`\`\`

## License

Apache-2.0
EOF

    # Create .gitignore
    cat > gen/pb-ts/.gitignore << EOF
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Build output
dist/
*.tsbuildinfo

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/

# IDE files
.vscode/
.idea/
*.swp
*.swo

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db
EOF

    echo "TypeScript protobuf definitions generated in gen/pb-ts/"
fi


# Unfortunately, the `--grpc-gateway-out` plugin doesn’t yet support the `source_relative` option. Until it does, we need to move the files from the autogenerated location to the source_relative location.
cp -r gen/pb-go/github.com/flyteorg/flyteidl/gen/* gen/
rm -rf gen/pb-go/github.com

# Copy the validate.py protos.
mkdir -p gen/pb_python/validate
cp -r validate/* gen/pb_python/validate/

# Update the service code manually because the code generated by protoc is incorrect
# More detail, check https://github.com/flyteorg/flyteidl/pull/303#discussion_r1002151053
sed -i -e 's/protoReq.Id.ResourceType = ResourceType(e)/protoReq.Id.ResourceType = core.ResourceType(e)/g' gen/pb-go/flyteidl/service/admin.pb.gw.go
rm -f gen/pb-go/flyteidl/service/admin.pb.gw.go-e

# This section is used by Travis CI to ensure that the generation step was run
if [ -n "$DELTA_CHECK" ]; then
  DIRTY=$(git status --porcelain)
  if [ -n "$DIRTY" ]; then
    echo "FAILED: Protos updated without commiting generated code."
    echo "Ensure make generate has run and all changes are committed."
    DIFF=$(git diff)
    echo "diff detected: $DIFF"
    DIFF=$(git diff --name-only)
    echo "files different: $DIFF"
    exit 1
  else
    echo "SUCCESS: Generated code is up to date."
  fi
fi
