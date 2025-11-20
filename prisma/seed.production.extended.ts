// // EXTENDED SEED DATA - Part 2
// // This file contains additional seed data for workflows, executions, marketplace, payments, and compliance
// // Import this after running the main seed file

// import { PrismaClient } from '@prisma/client';

// const prisma = new PrismaClient();

// const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
// const daysFromNow = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);
// const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000);

// async function extendedSeed() {
//   console.log('🌱 Starting EXTENDED database seeding...\n');

//   // Get existing data
//   const acmeCorp = await prisma.organization.findUnique({ where: { slug: 'acme-corp' } });
//   const techStart = await prisma.organization.findUnique({ where: { slug: 'techstart-inc' } });

//   const acme_prod = await prisma.project.findUnique({ where: { id: 'acme-prod-001' } });
//   const acme_dev = await prisma.project.findUnique({ where: { id: 'acme-dev-001' } });
//   const acme_ml = await prisma.project.findUnique({ where: { id: 'acme-ml-001' } });
//   const tech_main = await prisma.project.findUnique({ where: { id: 'tech-main-001' } });

//   const acme_superAdmin = await prisma.user.findUnique({ where: { email: 'super-admin@acme-corp.com' } });
//   const acme_dev1 = await prisma.user.findUnique({ where: { email: 'dev1@acme-corp.com' } });
//   const acme_dev2 = await prisma.user.findUnique({ where: { email: 'dev2@acme-corp.com' } });
//   const acme_op1 = await prisma.user.findUnique({ where: { email: 'operator1@acme-corp.com' } });
//   const tech_dev = await prisma.user.findUnique({ where: { email: 'dev@techstart.io' } });

//   if (!acmeCorp || !acme_prod || !acme_superAdmin) {
//     throw new Error('Base seed data not found. Run main seed first.');
//   }

//   // ============================================================================
//   // TASKS (for Workflow Builder)
//   // ============================================================================
//   console.log('🔧 Creating tasks...');

//   const tasks = [
//     {
//       id: 'task-data-validation',
//       projectId: acme_dev.id,
//       organizationId: acmeCorp.id,
//       domain: 'development',
//       name: 'data_validation',
//       version: 'v1',
//       description: 'Validates input data against schema',
//       flyteTaskId: `${acmeCorp.id}-${acme_dev.id}:development:data_validation:v1`,
//       spec: {
//         template: {
//           interface: {
//             inputs: {
//               variables: {
//                 data: { type: { simple: 'STRING' }, description: 'JSON data to validate' },
//                 schema: { type: { simple: 'STRING' }, description: 'JSON schema' }
//               }
//             },
//             outputs: {
//               variables: {
//                 is_valid: { type: { simple: 'BOOLEAN' }, description: 'Validation result' }
//               }
//             }
//           }
//         }
//       },
//       createdBy: acme_dev1.id
//     },
//     {
//       id: 'task-data-transform',
//       projectId: acme_dev.id,
//       organizationId: acmeCorp.id,
//       domain: 'development',
//       name: 'data_transform',
//       version: 'v1',
//       description: 'Transforms data using specified rules',
//       flyteTaskId: `${acmeCorp.id}-${acme_dev.id}:development:data_transform:v1`,
//       spec: {
//         template: {
//           interface: {
//             inputs: {
//               variables: {
//                 input_data: { type: { simple: 'STRING' }, description: 'Input data' },
//                 transform_rules: { type: { simple: 'STRING' }, description: 'Rules' }
//               }
//             },
//             outputs: {
//               variables: {
//                 output_data: { type: { simple: 'STRING' }, description: 'Transformed data' }
//               }
//             }
//           }
//         }
//       },
//       createdBy: acme_dev1.id
//     },
//     {
//       id: 'task-http-request',
//       projectId: acme_dev.id,
//       organizationId: acmeCorp.id,
//       domain: 'development',
//       name: 'http_request',
//       version: 'v1',
//       description: 'Makes HTTP requests to external APIs',
//       flyteTaskId: `${acmeCorp.id}-${acme_dev.id}:development:http_request:v1`,
//       spec: {
//         template: {
//           interface: {
//             inputs: {
//               variables: {
//                 url: { type: { simple: 'STRING' }, description: 'API endpoint' },
//                 method: { type: { simple: 'STRING' }, description: 'HTTP method' }
//               }
//             },
//             outputs: {
//               variables: {
//                 status_code: { type: { simple: 'INTEGER' }, description: 'Status code' },
//                 response_body: { type: { simple: 'STRING' }, description: 'Response' }
//               }
//             }
//           }
//         }
//       },
//       createdBy: acme_dev1.id
//     },
//     {
//       id: 'task-send-notification',
//       projectId: acme_ml.id,
//       organizationId: acmeCorp.id,
//       domain: 'production',
//       name: 'send_notification',
//       version: 'v2',
//       description: 'Sends notifications via multiple channels',
//       flyteTaskId: `${acmeCorp.id}-${acme_ml.id}:production:send_notification:v2`,
//       spec: {
//         template: {
//           interface: {
//             inputs: {
//               variables: {
//                 channel: { type: { simple: 'STRING' }, description: 'email, sms, slack' },
//                 recipient: { type: { simple: 'STRING' }, description: 'Recipient address' },
//                 message: { type: { simple: 'STRING' }, description: 'Message content' }
//               }
//             },
//             outputs: {
//               variables: {
//                 sent: { type: { simple: 'BOOLEAN' }, description: 'Success status' }
//               }
//             }
//           }
//         }
//       },
//       createdBy: acme_dev2.id
//     },
//     {
//       id: 'task-ml-train',
//       projectId: acme_ml.id,
//       organizationId: acmeCorp.id,
//       domain: 'production',
//       name: 'ml_train_model',
//       version: 'v1',
//       description: 'Trains ML models with hyperparameter tuning',
//       flyteTaskId: `${acmeCorp.id}-${acme_ml.id}:production:ml_train_model:v1`,
//       spec: {
//         template: {
//           interface: {
//             inputs: {
//               variables: {
//                 dataset_path: { type: { simple: 'STRING' }, description: 'Training dataset' },
//                 model_type: { type: { simple: 'STRING' }, description: 'Model type' },
//                 hyperparameters: { type: { simple: 'STRING' }, description: 'Hyperparameters JSON' }
//               }
//             },
//             outputs: {
//               variables: {
//                 model_path: { type: { simple: 'STRING' }, description: 'Trained model' },
//                 accuracy: { type: { simple: 'FLOAT' }, description: 'Model accuracy' }
//               }
//             }
//           }
//         }
//       },
//       createdBy: acme_dev1.id
//     }
//   ];

//   for (const task of tasks) {
//     await prisma.task.upsert({
//       where: { id: task.id },
//       update: {},
//       create: task
//     });
//   }

//   console.log(`✅ Created ${tasks.length} tasks`);

//   // ============================================================================
//   // WORKFLOWS
//   // ============================================================================
//   console.log('⚙️  Creating workflows...');

//   const workflows = [
//     {
//       id: 'wf-data-pipeline-001',
//       projectId: acme_prod.id,
//       organizationId: acmeCorp.id,
//       domain: 'production',
//       name: 'data_processing_pipeline',
//       version: 'v1.0.0',
//       description: 'Production ETL pipeline',
//       flyteWorkflowId: `${acmeCorp.id}-${acme_prod.id}:production:data_processing_pipeline:v1.0.0`,
//       status: 'ACTIVE',
//       spec: {
//         nodes: ['validate', 'transform', 'load'],
//         edges: [
//           { from: 'validate', to: 'transform' },
//           { from: 'transform', to: 'load' }
//         ]
//       },
//       createdBy: acme_superAdmin.id
//     },
//     {
//       id: 'wf-ml-training-001',
//       projectId: acme_ml.id,
//       organizationId: acmeCorp.id,
//       domain: 'production',
//       name: 'ml_training_workflow',
//       version: 'v2.0.0',
//       description: 'ML model training with validation',
//       flyteWorkflowId: `${acmeCorp.id}-${acme_ml.id}:production:ml_training_workflow:v2.0.0`,
//       status: 'ACTIVE',
//       spec: {
//         nodes: ['load_data', 'preprocess', 'train', 'evaluate', 'deploy'],
//         edges: [
//           { from: 'load_data', to: 'preprocess' },
//           { from: 'preprocess', to: 'train' },
//           { from: 'train', to: 'evaluate' },
//           { from: 'evaluate', to: 'deploy' }
//         ]
//       },
//       createdBy: acme_dev1.id
//     },
//     {
//       id: 'wf-monitoring-001',
//       projectId: acme_prod.id,
//       organizationId: acmeCorp.id,
//       domain: 'production',
//       name: 'monitoring_alerts',
//       version: 'v1.2.0',
//       description: 'System monitoring and alerting',
//       flyteWorkflowId: `${acmeCorp.id}-${acme_prod.id}:production:monitoring_alerts:v1.2.0`,
//       status: 'ACTIVE',
//       spec: {
//         nodes: ['collect_metrics', 'analyze', 'alert'],
//         edges: [
//           { from: 'collect_metrics', to: 'analyze' },
//           { from: 'analyze', to: 'alert' }
//         ]
//       },
//       createdBy: acme_op1.id
//     },
//     {
//       id: 'wf-dev-test-001',
//       projectId: acme_dev.id,
//       organizationId: acmeCorp.id,
//       domain: 'development',
//       name: 'test_workflow',
//       version: 'v0.1.0',
//       description: 'Testing and development workflow',
//       flyteWorkflowId: `${acmeCorp.id}-${acme_dev.id}:development:test_workflow:v0.1.0`,
//       status: 'ACTIVE',
//       spec: {
//         nodes: ['step1', 'step2'],
//         edges: [{ from: 'step1', to: 'step2' }]
//       },
//       createdBy: acme_dev2.id
//     },
//     {
//       id: 'wf-archived-001',
//       projectId: acme_dev.id,
//       organizationId: acmeCorp.id,
//       domain: 'development',
//       name: 'old_workflow',
//       version: 'v1.0.0',
//       description: 'Archived workflow',
//       flyteWorkflowId: `${acmeCorp.id}-${acme_dev.id}:development:old_workflow:v1.0.0`,
//       status: 'ARCHIVED',
//       spec: { nodes: ['step1'], edges: [] },
//       createdBy: acme_dev1.id
//     },
//     {
//       id: 'wf-tech-main-001',
//       projectId: tech_main.id,
//       organizationId: techStart.id,
//       domain: 'development',
//       name: 'api_workflow',
//       version: 'v1.0.0',
//       description: 'API processing workflow',
//       flyteWorkflowId: `${techStart.id}-${tech_main.id}:development:api_workflow:v1.0.0`,
//       status: 'ACTIVE',
//       spec: {
//         nodes: ['receive', 'process', 'respond'],
//         edges: [
//           { from: 'receive', to: 'process' },
//           { from: 'process', to: 'respond' }
//         ]
//       },
//       createdBy: tech_dev.id
//     }
//   ];

//   for (const wf of workflows) {
//     await prisma.workflow.upsert({
//       where: { id: wf.id },
//       update: {},
//       create: wf
//     });
//   }

//   console.log(`✅ Created ${workflows.length} workflows`);

//   // ============================================================================
//   // WORKFLOW EXECUTIONS (with various states)
//   // ============================================================================
//   console.log('▶️  Creating workflow executions...');

//   const executions = [
//     // SUCCEEDED - Recent
//     {
//       id: 'exec-001',
//       executionId: 'exec-prod-001',
//       workflowId: 'wf-data-pipeline-001',
//       projectId: acme_prod.id,
//       organizationId: acmeCorp.id,
//       domain: 'production',
//       name: 'data-pipeline-run-001',
//       phase: 'SUCCEEDED',
//       flyteExecutionId: 'flyte-exec-001',
//       startedAt: hoursAgo(2),
//       duration: 1800000, // 30 minutes
//       inputs: { dataset: 'sales_data_2024', validate: true },
//       outputs: { records_processed: 50000, status: 'success' },
//       createdBy: acme_superAdmin.id
//     },
//     // RUNNING - Current
//     {
//       id: 'exec-002',
//       executionId: 'exec-ml-001',
//       workflowId: 'wf-ml-training-001',
//       projectId: acme_ml.id,
//       organizationId: acmeCorp.id,
//       domain: 'production',
//       name: 'ml-training-run-001',
//       phase: 'RUNNING',
//       flyteExecutionId: 'flyte-exec-002',
//       startedAt: hoursAgo(1),
//       duration: null,
//       inputs: { model_type: 'random_forest', epochs: 100 },
//       outputs: null,
//       createdBy: acme_dev1.id
//     },
//     // FAILED - With error
//     {
//       id: 'exec-003',
//       executionId: 'exec-prod-002',
//       workflowId: 'wf-data-pipeline-001',
//       projectId: acme_prod.id,
//       organizationId: acmeCorp.id,
//       domain: 'production',
//       name: 'data-pipeline-run-002',
//       phase: 'FAILED',
//       flyteExecutionId: 'flyte-exec-003',
//       startedAt: hoursAgo(4),
//       duration: 600000, // 10 minutes
//       inputs: { dataset: 'corrupted_data', validate: true },
//       outputs: null,
//       error: {
//         code: 'VALIDATION_ERROR',
//         message: 'Data validation failed: schema mismatch',
//         stack: 'at validateData (validator.ts:45)'
//       },
//       createdBy: acme_dev2.id
//     },
//     // SUCCEEDED - Long running
//     {
//       id: 'exec-004',
//       executionId: 'exec-ml-002',
//       workflowId: 'wf-ml-training-001',
//       projectId: acme_ml.id,
//       organizationId: acmeCorp.id,
//       domain: 'production',
//       name: 'ml-training-run-002',
//       phase: 'SUCCEEDED',
//       flyteExecutionId: 'flyte-exec-004',
//       startedAt: hoursAgo(6),
//       duration: 14400000, // 4 hours
//       inputs: { model_type: 'neural_network', epochs: 1000 },
//       outputs: { model_id: 'model-v2.0.0', accuracy: 0.94, f1_score: 0.91 },
//       createdBy: acme_dev1.id
//     },
//     // ABORTED - User canceled
//     {
//       id: 'exec-005',
//       executionId: 'exec-dev-001',
//       workflowId: 'wf-dev-test-001',
//       projectId: acme_dev.id,
//       organizationId: acmeCorp.id,
//       domain: 'development',
//       name: 'test-run-001',
//       phase: 'ABORTED',
//       flyteExecutionId: 'flyte-exec-005',
//       startedAt: hoursAgo(8),
//       duration: 300000, // 5 minutes
//       inputs: { test_mode: true },
//       outputs: null,
//       error: { code: 'USER_ABORTED', message: 'Execution aborted by user' },
//       createdBy: acme_dev2.id
//     },
//     // TIMED_OUT
//     {
//       id: 'exec-006',
//       executionId: 'exec-prod-003',
//       workflowId: 'wf-monitoring-001',
//       projectId: acme_prod.id,
//       organizationId: acmeCorp.id,
//       domain: 'production',
//       name: 'monitoring-run-001',
//       phase: 'TIMED_OUT',
//       flyteExecutionId: 'flyte-exec-006',
//       startedAt: hoursAgo(10),
//       duration: 3600000, // 1 hour (timeout)
//       inputs: { check_interval: 60 },
//       outputs: null,
//       error: { code: 'TIMEOUT', message: 'Execution exceeded time limit of 1 hour' },
//       createdBy: acme_op1.id
//     },
//     // QUEUED
//     {
//       id: 'exec-007',
//       executionId: 'exec-prod-004',
//       workflowId: 'wf-data-pipeline-001',
//       projectId: acme_prod.id,
//       organizationId: acmeCorp.id,
//       domain: 'production',
//       name: 'data-pipeline-run-003',
//       phase: 'QUEUED',
//       flyteExecutionId: 'flyte-exec-007',
//       startedAt: null,
//       duration: null,
//       inputs: { dataset: 'pending_data', priority: 'low' },
//       outputs: null,
//       createdBy: acme_superAdmin.id
//     },
//     // TECH ORG - SUCCEEDED
//     {
//       id: 'exec-tech-001',
//       executionId: 'exec-tech-001',
//       workflowId: 'wf-tech-main-001',
//       projectId: tech_main.id,
//       organizationId: techStart.id,
//       domain: 'development',
//       name: 'api-workflow-run-001',
//       phase: 'SUCCEEDED',
//       flyteExecutionId: 'flyte-exec-tech-001',
//       startedAt: hoursAgo(3),
//       duration: 120000, // 2 minutes
//       inputs: { api_endpoint: '/api/v1/users', method: 'GET' },
//       outputs: { status: 200, records: 100 },
//       createdBy: tech_dev.id
//     }
//   ];

//   for (const exec of executions) {
//     await prisma.workflowExecution.upsert({
//       where: { id: exec.id },
//       update: {},
//       create: exec
//     });
//   }

//   console.log(`✅ Created ${executions.length} workflow executions`);

//   // ============================================================================
//   // EXECUTION USAGE (for billing)
//   // ============================================================================
//   console.log('📊 Creating execution usage records...');

//   const executionUsages = [
//     {
//       id: 'usage-exec-001',
//       executionId: 'exec-prod-001',
//       projectId: acme_prod.id,
//       workflowId: 'wf-data-pipeline-001',
//       userId: acme_superAdmin.id,
//       domain: 'production',
//       startTime: hoursAgo(2),
//       endTime: hoursAgo(1.5),
//       duration: 1800,
//       status: 'SUCCEEDED',
//       resourceUsage: {
//         cpuTime: 2.5,
//         memoryUsage: 4.2,
//         storageUsed: 0.5,
//         networkTransfer: 0.2
//       },
//       cost: {
//         total: 0.52,
//         breakdown: { compute: 0.40, storage: 0.05, network: 0.07 }
//       }
//     },
//     {
//       id: 'usage-exec-004',
//       executionId: 'exec-ml-002',
//       projectId: acme_ml.id,
//       workflowId: 'wf-ml-training-001',
//       userId: acme_dev1.id,
//       domain: 'production',
//       startTime: hoursAgo(6),
//       endTime: hoursAgo(2),
//       duration: 14400,
//       status: 'SUCCEEDED',
//       resourceUsage: {
//         cpuTime: 18.5,
//         memoryUsage: 32.0,
//         storageUsed: 2.5,
//         networkTransfer: 1.2
//       },
//       cost: {
//         total: 24.80,
//         breakdown: { compute: 22.00, storage: 1.50, network: 1.30 }
//       }
//     },
//     {
//       id: 'usage-exec-003',
//       executionId: 'exec-prod-002',
//       projectId: acme_prod.id,
//       workflowId: 'wf-data-pipeline-001',
//       userId: acme_dev2.id,
//       domain: 'production',
//       startTime: hoursAgo(4),
//       endTime: hoursAgo(3.83),
//       duration: 600,
//       status: 'FAILED',
//       resourceUsage: {
//         cpuTime: 0.8,
//         memoryUsage: 1.5,
//         storageUsed: 0.1,
//         networkTransfer: 0.05
//       },
//       cost: {
//         total: 0.18,
//         breakdown: { compute: 0.12, storage: 0.02, network: 0.04 }
//       }
//     },
//     {
//       id: 'usage-exec-tech-001',
//       executionId: 'exec-tech-001',
//       projectId: tech_main.id,
//       workflowId: 'wf-tech-main-001',
//       userId: tech_dev.id,
//       domain: 'development',
//       startTime: hoursAgo(3),
//       endTime: hoursAgo(2.97),
//       duration: 120,
//       status: 'SUCCEEDED',
//       resourceUsage: {
//         cpuTime: 0.2,
//         memoryUsage: 0.4,
//         storageUsed: 0.02,
//         networkTransfer: 0.01
//       },
//       cost: {
//         total: 0.05,
//         breakdown: { compute: 0.03, storage: 0.01, network: 0.01 }
//       }
//     }
//   ];

//   for (const usage of executionUsages) {
//     await prisma.executionUsage.upsert({
//       where: { id: usage.id },
//       update: {},
//       create: usage
//     });
//   }

//   console.log(`✅ Created ${executionUsages.length} execution usage records`);

//   // ============================================================================
//   // MARKETPLACE WORKFLOWS
//   // ============================================================================
//   console.log('🛒 Creating marketplace workflows...');

//   const marketplaceWorkflows = [
//     {
//       id: 'mkt-wf-data-pipeline',
//       name: 'Advanced Data Processing Pipeline',
//       description: 'Complete ETL pipeline with validation, transformation, and error handling',
//       category: 'DATA_PROCESSING',
//       version: '2.1.0',
//       authorId: acme_superAdmin.id,
//       pricing: { singleUse: 19.99, unlimited: 99.99, team: 199.99, enterprise: 499.99 },
//       tags: ['etl', 'data-processing', 'validation', 'production-ready'],
//       status: 'APPROVED',
//       featured: true,
//       downloads: 342,
//       rating: 4.7,
//       reviewCount: 28
//     },
//     {
//       id: 'mkt-wf-ml-training',
//       name: 'ML Model Training Pipeline',
//       description: 'End-to-end machine learning training with hyperparameter tuning and validation',
//       category: 'ML_TRAINING',
//       version: '3.0.0',
//       authorId: acme_dev1.id,
//       pricing: { singleUse: 29.99, unlimited: 149.99, team: 299.99, enterprise: 799.99 },
//       tags: ['machine-learning', 'training', 'hyperparameter-tuning', 'mlops'],
//       status: 'APPROVED',
//       featured: true,
//       downloads: 589,
//       rating: 4.9,
//       reviewCount: 67
//     },
//     {
//       id: 'mkt-wf-monitoring',
//       name: 'System Monitoring & Alerting',
//       description: 'Comprehensive monitoring solution with intelligent alerting',
//       category: 'MONITORING',
//       version: '1.5.0',
//       authorId: acme_op1.id,
//       pricing: { singleUse: 14.99, unlimited: 79.99, team: 149.99, enterprise: 399.99 },
//       tags: ['monitoring', 'alerting', 'observability', 'devops'],
//       status: 'APPROVED',
//       featured: false,
//       downloads: 156,
//       rating: 4.3,
//       reviewCount: 19
//     },
//     {
//       id: 'mkt-wf-pending',
//       name: 'Experimental Analytics Workflow',
//       description: 'New analytics workflow pending review',
//       category: 'ANALYTICS',
//       version: '0.9.0',
//       authorId: acme_dev2.id,
//       pricing: { singleUse: 9.99, unlimited: 49.99, team: 99.99, enterprise: 249.99 },
//       tags: ['analytics', 'experimental', 'beta'],
//       status: 'PENDING_REVIEW',
//       featured: false,
//       downloads: 0,
//       rating: 0,
//       reviewCount: 0
//     }
//   ];

//   for (const mwf of marketplaceWorkflows) {
//     await prisma.marketplaceWorkflow.upsert({
//       where: { id: mwf.id },
//       update: {},
//       create: mwf
//     });

//     // Create specification
//     if (mwf.status === 'APPROVED') {
//       await prisma.workflowSpecification.upsert({
//         where: { workflowId: mwf.id },
//         update: {},
//         create: {
//           workflowId: mwf.id,
//           spec: {
//             version: mwf.version,
//             steps: [
//               { id: 'step-1', name: 'Initialize', type: 'init', config: {} },
//               { id: 'step-2', name: 'Process', type: 'process', config: {} },
//               { id: 'step-3', name: 'Finalize', type: 'finalize', config: {} }
//             ],
//             triggers: ['manual', 'scheduled', 'webhook'],
//             outputs: ['logs', 'metrics', 'artifacts']
//           },
//           documentation: {
//             overview: mwf.description,
//             requirements: ['Node.js 18+', 'Docker', 'PostgreSQL'],
//             setup: 'Follow the installation guide',
//             examples: [
//               { name: 'Basic Usage', code: 'workflow.execute({ input: "data" })' }
//             ]
//           },
//           requirements: {
//             cpu: '2 cores',
//             memory: '4GB',
//             storage: '10GB'
//           }
//         }
//       });
//     }
//   }

//   console.log(`✅ Created ${marketplaceWorkflows.length} marketplace workflows`);

//   // ============================================================================
//   // WORKFLOW PURCHASES
//   // ============================================================================
//   console.log('💰 Creating workflow purchases...');

//   const purchases = [
//     {
//       id: 'purchase-001',
//       workflowId: 'mkt-wf-data-pipeline',
//       buyerId: acme_superAdmin.id,
//       projectId: acme_prod.id,
//       licenseType: 'UNLIMITED',
//       purchasePrice: 99.99,
//       platformFee: 14.99,
//       sellerRevenue: 85.00,
//       currency: 'USD',
//       status: 'COMPLETED',
//       paymentId: 'pay_data_pipeline_001',
//       purchasedAt: daysAgo(30)
//     },
//     {
//       id: 'purchase-002',
//       workflowId: 'mkt-wf-ml-training',
//       buyerId: acme_dev1.id,
//       projectId: acme_ml.id,
//       licenseType: 'TEAM',
//       purchasePrice: 299.99,
//       platformFee: 44.99,
//       sellerRevenue: 255.00,
//       currency: 'USD',
//       status: 'COMPLETED',
//       paymentId: 'pay_ml_training_001',
//       purchasedAt: daysAgo(15)
//     },
//     {
//       id: 'purchase-003',
//       workflowId: 'mkt-wf-monitoring',
//       buyerId: tech_dev.id,
//       projectId: tech_main.id,
//       licenseType: 'SINGLE_USE',
//       purchasePrice: 14.99,
//       platformFee: 2.24,
//       sellerRevenue: 12.75,
//       currency: 'USD',
//       status: 'COMPLETED',
//       paymentId: 'pay_monitoring_001',
//       purchasedAt: daysAgo(7)
//     }
//   ];

//   for (const purchase of purchases) {
//     await prisma.workflowPurchase.upsert({
//       where: { id: purchase.id },
//       update: {},
//       create: purchase
//     });

//     // Create revenue record
//     await prisma.marketplaceRevenue.upsert({
//       where: { purchaseId: purchase.id },
//       update: {},
//       create: {
//         purchaseId: purchase.id,
//         workflowId: purchase.workflowId,
//         sellerId: 'system', // Author
//         grossRevenue: purchase.purchasePrice,
//         platformFee: purchase.platformFee,
//         netRevenue: purchase.sellerRevenue,
//         currency: purchase.currency,
//         feePercentage: 15.0,
//         payoutStatus: purchase.id === 'purchase-003' ? 'PENDING' : 'PAID',
//         payoutDate: purchase.id === 'purchase-003' ? null : daysAgo(1)
//       }
//     });
//   }

//   console.log(`✅ Created ${purchases.length} workflow purchases`);

//   // ============================================================================
//   // PAYMENT HISTORY
//   // ============================================================================
//   console.log('💳 Creating payment history...');

//   const billing_acme = await prisma.billingAccount.findUnique({ where: { id: 'billing-acme-001' } });
//   const billing_tech = await prisma.billingAccount.findUnique({ where: { id: 'billing-tech-001' } });

//   const payments = [
//     {
//       id: 'pay-acme-001',
//       billingAccountId: billing_acme.id,
//       amount: 999.00,
//       currency: 'USD',
//       status: 'SUCCEEDED',
//       paymentMethod: 'card',
//       transactionId: 'txn_acme_001',
//       processedAt: daysAgo(15),
//       metadata: { subscriptionId: 'sub-acme-enterprise-001', plan: 'Enterprise' }
//     },
//     {
//       id: 'pay-acme-002',
//       billingAccountId: billing_acme.id,
//       amount: 199.00,
//       currency: 'USD',
//       status: 'SUCCEEDED',
//       paymentMethod: 'card',
//       transactionId: 'txn_acme_002',
//       processedAt: daysAgo(10),
//       metadata: { subscriptionId: 'sub-acme-pro-001', plan: 'Professional' }
//     },
//     {
//       id: 'pay-tech-001',
//       billingAccountId: billing_tech.id,
//       amount: 199.00,
//       currency: 'USD',
//       status: 'SUCCEEDED',
//       paymentMethod: 'card',
//       transactionId: 'txn_tech_001',
//       processedAt: daysAgo(7),
//       metadata: { subscriptionId: 'sub-tech-pro-001', plan: 'Professional' }
//     },
//     {
//       id: 'pay-tech-failed-001',
//       billingAccountId: billing_tech.id,
//       amount: 49.00,
//       currency: 'USD',
//       status: 'FAILED',
//       paymentMethod: 'card',
//       transactionId: 'txn_tech_failed_001',
//       failureReason: 'insufficient_funds',
//       processedAt: daysAgo(2),
//       metadata: { subscriptionId: 'sub-tech-pastdue-001', plan: 'Starter', attemptNumber: 3 }
//     },
//     {
//       id: 'pay-tech-refund-001',
//       billingAccountId: billing_tech.id,
//       amount: -49.00,
//       currency: 'USD',
//       status: 'REFUNDED',
//       paymentMethod: 'card',
//       transactionId: 'txn_tech_refund_001',
//       processedAt: daysAgo(5),
//       metadata: { originalPaymentId: 'pay-tech-001', reason: 'customer_request' }
//     }
//   ];

//   for (const payment of payments) {
//     await prisma.paymentHistory.upsert({
//       where: { id: payment.id },
//       update: {},
//       create: payment
//     });
//   }

//   console.log(`✅ Created ${payments.length} payment records`);

//   // ============================================================================
//   // BILLING ALERTS
//   // ============================================================================
//   console.log('🚨 Creating billing alerts...');

//   const alerts = [
//     {
//       id: 'alert-usage-warning-001',
//       billingAccountId: billing_acme.id,
//       type: 'USAGE_LIMIT',
//       severity: 'WARNING',
//       message: 'Starter plan approaching monthly execution limit (95% used)',
//       threshold: 1000,
//       currentValue: 950,
//       isResolved: false
//     },
//     {
//       id: 'alert-usage-critical-001',
//       billingAccountId: billing_tech.id,
//       type: 'USAGE_LIMIT',
//       severity: 'CRITICAL',
//       message: 'Free tier execution limit exceeded. Upgrade to continue.',
//       threshold: 100,
//       currentValue: 100,
//       isResolved: false
//     },
//     {
//       id: 'alert-payment-failed-001',
//       billingAccountId: billing_tech.id,
//       type: 'PAYMENT_FAILED',
//       severity: 'CRITICAL',
//       message: 'Payment failed after 3 attempts. Please update payment method.',
//       threshold: null,
//       currentValue: null,
//       isResolved: false
//     },
//     {
//       id: 'alert-trial-ending-001',
//       billingAccountId: billing_acme.id,
//       type: 'TRIAL_ENDING',
//       severity: 'WARNING',
//       message: 'Professional trial ending in 3 days',
//       threshold: null,
//       currentValue: null,
//       isResolved: false
//     }
//   ];

//   for (const alert of alerts) {
//     await prisma.billingAlert.upsert({
//       where: { id: alert.id },
//       update: {},
//       create: alert
//     });
//   }

//   console.log(`✅ Created ${alerts.length} billing alerts`);

//   // ============================================================================
//   // FEATURE USAGE TRACKING
//   // ============================================================================
//   console.log('📈 Creating feature usage records...');

//   const featureUsages = [
//     {
//       userId: acme_superAdmin.id,
//       projectId: acme_prod.id,
//       feature: 'advanced_analytics',
//       usageCount: 245,
//       resetPeriod: 'monthly',
//       lastUsed: hoursAgo(2),
//       lastReset: daysAgo(15),
//       metadata: { avgSessionDuration: 1200, mostUsedFeature: 'cost_analysis' }
//     },
//     {
//       userId: acme_dev1.id,
//       projectId: acme_ml.id,
//       feature: 'api_access',
//       usageCount: 892,
//       resetPeriod: 'daily',
//       lastUsed: hoursAgo(1),
//       lastReset: hoursAgo(24),
//       metadata: { endpoint: '/api/v1/workflows', method: 'GET' }
//     },
//     {
//       userId: acme_dev2.id,
//       projectId: acme_dev.id,
//       feature: 'api_access',
//       usageCount: 950, // Near limit of 1000
//       resetPeriod: 'daily',
//       lastUsed: hoursAgo(0.5),
//       lastReset: hoursAgo(23),
//       metadata: { endpoint: '/api/v1/executions', nearLimit: true }
//     },
//     {
//       userId: tech_dev.id,
//       projectId: tech_main.id,
//       feature: 'api_access',
//       usageCount: 1000, // At limit
//       resetPeriod: 'daily',
//       lastUsed: hoursAgo(3),
//       lastReset: hoursAgo(22),
//       metadata: { endpoint: '/api/v1/workflows', atLimit: true, limitReached: true }
//     }
//   ];

//   for (const fu of featureUsages) {
//     await prisma.featureUsage.upsert({
//       where: {
//         userId_projectId_feature_resetPeriod: {
//           userId: fu.userId,
//           projectId: fu.projectId,
//           feature: fu.feature,
//           resetPeriod: fu.resetPeriod
//         }
//       },
//       update: {},
//       create: fu
//     });
//   }

//   console.log(`✅ Created ${featureUsages.length} feature usage records`);

//   // ============================================================================
//   // AUDIT LOGS
//   // ============================================================================
//   console.log('📜 Creating audit logs...');

//   const auditLogs = [
//     {
//       userId: acme_superAdmin.id,
//       projectId: acme_prod.id,
//       action: 'CREATE',
//       resource: 'workflow',
//       resourceId: 'wf-data-pipeline-001',
//       ipAddress: '192.168.1.100',
//       userAgent: 'Mozilla/5.0',
//       timestamp: daysAgo(30),
//       metadata: { workflowName: 'data_processing_pipeline', version: 'v1.0.0' }
//     },
//     {
//       userId: acme_dev1.id,
//       projectId: acme_ml.id,
//       action: 'EXECUTE',
//       resource: 'workflow',
//       resourceId: 'wf-ml-training-001',
//       ipAddress: '192.168.1.101',
//       userAgent: 'Claude-API/1.0',
//       timestamp: hoursAgo(6),
//       metadata: { executionId: 'exec-ml-002', duration: 14400000 }
//     },
//     {
//       userId: acme_sysAdmin.id,
//       projectId: acme_prod.id,
//       action: 'UPDATE',
//       resource: 'subscription',
//       resourceId: 'sub-acme-enterprise-001',
//       ipAddress: '192.168.1.102',
//       userAgent: 'Mozilla/5.0',
//       timestamp: daysAgo(15),
//       metadata: { change: 'plan_upgrade', from: 'professional', to: 'enterprise' }
//     },
//     {
//       userId: acme_dev2.id,
//       projectId: acme_dev.id,
//       action: 'DELETE',
//       resource: 'workflow',
//       resourceId: 'wf-archived-001',
//       ipAddress: '192.168.1.103',
//       userAgent: 'Mozilla/5.0',
//       timestamp: daysAgo(5),
//       metadata: { reason: 'archived', softDelete: true }
//     },
//     {
//       userId: tech_dev.id,
//       projectId: tech_main.id,
//       action: 'PURCHASE',
//       resource: 'marketplace_workflow',
//       resourceId: 'mkt-wf-monitoring',
//       ipAddress: '10.0.0.50',
//       userAgent: 'Mozilla/5.0',
//       timestamp: daysAgo(7),
//       metadata: { purchaseId: 'purchase-003', amount: 14.99, licenseType: 'SINGLE_USE' }
//     }
//   ];

//   for (const log of auditLogs) {
//     await prisma.auditLog.create({ data: log });
//   }

//   console.log(`✅ Created ${auditLogs.length} audit logs`);

//   // ============================================================================
//   // GDPR REQUESTS
//   // ============================================================================
//   console.log('🔒 Creating GDPR requests...');

//   const inactive_deleted = await prisma.user.findUnique({ where: { email: 'deleted@inactive-corp.com' } });

//   const gdprRequests = [
//     {
//       userId: inactive_deleted.id,
//       requestType: 'ERASURE',
//       status: 'COMPLETED',
//       details: { reason: 'User requested account deletion', scope: 'all_data' },
//       responseData: { deletedRecords: 150, anonymizedRecords: 45 },
//       dueDate: daysAgo(25),
//       completedAt: daysAgo(28),
//       completedBy: 'system'
//     },
//     {
//       userId: acme_trial.id,
//       requestType: 'ACCESS',
//       status: 'IN_PROGRESS',
//       details: { reason: 'Data access request', format: 'json' },
//       responseData: null,
//       dueDate: daysFromNow(5),
//       completedAt: null,
//       completedBy: null
//     }
//   ];

//   for (const req of gdprRequests) {
//     await prisma.gdprRequest.create({ data: req });
//   }

//   console.log(`✅ Created ${gdprRequests.length} GDPR requests`);

//   // ============================================================================
//   // USAGE RECORDS (for metrics)
//   // ============================================================================
//   console.log('📊 Creating usage metric records...');

//   const sub_acme_enterprise = await prisma.subscription.findUnique({ where: { id: 'sub-acme-enterprise-001' } });
//   const sub_tech_starter = await prisma.subscription.findUnique({ where: { id: 'sub-tech-starter-001' } });

//   // Generate daily usage for past 30 days
//   const usageRecords = [];
//   for (let i = 0; i < 30; i++) {
//     const date = daysAgo(i);

//     // Acme Corp - Enterprise (high usage)
//     usageRecords.push({
//       subscriptionId: sub_acme_enterprise.id,
//       projectId: acme_prod.id,
//       metric: 'EXECUTIONS',
//       quantity: Math.floor(Math.random() * 200) + 100,
//       unit: 'count',
//       timestamp: date,
//       cost: Math.random() * 50 + 25,
//       currency: 'USD',
//       metadata: { source: 'orchestrator', automated: true }
//     });

//     usageRecords.push({
//       subscriptionId: sub_acme_enterprise.id,
//       projectId: acme_prod.id,
//       metric: 'CPU_HOURS',
//       quantity: Math.random() * 50 + 20,
//       unit: 'hours',
//       timestamp: date,
//       cost: Math.random() * 30 + 10,
//       currency: 'USD',
//       metadata: { source: 'orchestrator', automated: true }
//     });

//     // TechStart - Starter (approaching limits)
//     if (i < 15) {
//       usageRecords.push({
//         subscriptionId: sub_tech_starter.id,
//         projectId: tech_main.id,
//         metric: 'EXECUTIONS',
//         quantity: Math.floor(Math.random() * 50) + 30,
//         unit: 'count',
//         timestamp: date,
//         cost: Math.random() * 5 + 2,
//         currency: 'USD',
//         metadata: { source: 'orchestrator', automated: true }
//       });
//     }
//   }

//   for (const record of usageRecords) {
//     await prisma.usageRecord.create({ data: record });
//   }

//   console.log(`✅ Created ${usageRecords.length} usage records`);

//   // ============================================================================
//   // FORM SCHEMAS
//   // ============================================================================
//   console.log('📋 Creating form schemas...');

//   const acme_op2 = await prisma.user.findUnique({ where: { email: 'operator2@acme-corp.com' } });

//   const formSchemas = [
//     {
//       id: 'form-user-registration',
//       name: 'User Registration Form',
//       description: 'Collect user registration information',
//       version: '1.0.0',
//       category: 'user-management',
//       tags: ['registration', 'onboarding', 'users'],
//       organizationId: acmeCorp.id,
//       createdBy: acme_dev1.id,
//       schema: {
//         type: 'object',
//         properties: {
//           firstName: { type: 'string', minLength: 2, maxLength: 50 },
//           lastName: { type: 'string', minLength: 2, maxLength: 50 },
//           email: { type: 'string', format: 'email' },
//           department: {
//             type: 'string',
//             enum: ['Engineering', 'Sales', 'Marketing', 'Operations']
//           },
//           startDate: { type: 'string', format: 'date' }
//         },
//         required: ['firstName', 'lastName', 'email', 'department']
//       },
//       uischema: {
//         'ui:order': ['firstName', 'lastName', 'email', 'department', 'startDate'],
//         email: { 'ui:help': 'We will never share your email' },
//         department: { 'ui:widget': 'select' },
//         startDate: { 'ui:widget': 'date' }
//       }
//     },
//     {
//       id: 'form-workflow-config',
//       name: 'Workflow Configuration',
//       description: 'Configure workflow execution parameters',
//       version: '1.0.0',
//       category: 'workflow',
//       tags: ['workflow', 'configuration', 'parameters'],
//       organizationId: acmeCorp.id,
//       createdBy: acme_dev1.id,
//       schema: {
//         type: 'object',
//         properties: {
//           workflowName: { type: 'string', minLength: 3 },
//           priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
//           retryCount: { type: 'integer', minimum: 0, maximum: 5 },
//           timeout: { type: 'integer', minimum: 60, maximum: 3600 },
//           notifyOnCompletion: { type: 'boolean' },
//           notifyOnFailure: { type: 'boolean' },
//           recipients: {
//             type: 'array',
//             items: { type: 'string', format: 'email' }
//           }
//         },
//         required: ['workflowName', 'priority', 'timeout']
//       },
//       uischema: {
//         priority: { 'ui:widget': 'radio' },
//         retryCount: { 'ui:widget': 'updown' },
//         timeout: { 'ui:help': 'Timeout in seconds' },
//         recipients: { 'ui:widget': 'textarea' }
//       }
//     },
//     {
//       id: 'form-data-validation',
//       name: 'Data Validation Rules',
//       description: 'Define data validation rules',
//       version: '1.0.0',
//       category: 'data-quality',
//       tags: ['validation', 'data-quality', 'rules'],
//       organizationId: acmeCorp.id,
//       createdBy: acme_dev2.id,
//       schema: {
//         type: 'object',
//         properties: {
//           dataSource: { type: 'string' },
//           validationRules: {
//             type: 'array',
//             items: {
//               type: 'object',
//               properties: {
//                 field: { type: 'string' },
//                 rule: { type: 'string', enum: ['required', 'regex', 'range', 'custom'] },
//                 value: { type: 'string' }
//               }
//             }
//           },
//           onFailure: { type: 'string', enum: ['stop', 'warn', 'continue'] }
//         },
//         required: ['dataSource', 'validationRules', 'onFailure']
//       }
//     },
//     {
//       id: 'form-ml-hyperparameters',
//       name: 'ML Hyperparameters',
//       description: 'Configure ML model hyperparameters',
//       version: '1.0.0',
//       category: 'machine-learning',
//       tags: ['ml', 'hyperparameters', 'training'],
//       organizationId: acmeCorp.id,
//       createdBy: acme_dev1.id,
//       schema: {
//         type: 'object',
//         properties: {
//           modelType: { type: 'string', enum: ['random_forest', 'neural_network', 'svm', 'xgboost'] },
//           learningRate: { type: 'number', minimum: 0.0001, maximum: 1 },
//           epochs: { type: 'integer', minimum: 10, maximum: 1000 },
//           batchSize: { type: 'integer', enum: [16, 32, 64, 128, 256] },
//           validationSplit: { type: 'number', minimum: 0.1, maximum: 0.3 }
//         },
//         required: ['modelType', 'learningRate', 'epochs']
//       }
//     },
//     {
//       id: 'form-simple-feedback',
//       name: 'Simple Feedback Form',
//       description: 'Collect user feedback (TechStart)',
//       version: '1.0.0',
//       category: 'feedback',
//       tags: ['feedback', 'survey'],
//       organizationId: techStart.id,
//       createdBy: tech_dev.id,
//       schema: {
//         type: 'object',
//         properties: {
//           rating: { type: 'integer', minimum: 1, maximum: 5 },
//           comments: { type: 'string', maxLength: 500 },
//           wouldRecommend: { type: 'boolean' }
//         },
//         required: ['rating']
//       }
//     }
//   ];

//   for (const schema of formSchemas) {
//     await prisma.formSchema.upsert({
//       where: { id: schema.id },
//       update: {},
//       create: {
//         ...schema,
//         assignmentCount: 0,
//         popularity: Math.floor(Math.random() * 100)
//       }
//     });
//   }

//   console.log(`✅ Created ${formSchemas.length} form schemas`);

//   // ============================================================================
//   // FORM ASSIGNMENTS
//   // ============================================================================
//   console.log('📎 Creating form assignments...');

//   const formAssignments = [
//     {
//       id: 'assign-user-reg-001',
//       schemaId: 'form-user-registration',
//       organizationId: acmeCorp.id,
//       targetType: 'task',
//       targetProject: acme_prod.id,
//       targetDomain: 'production',
//       targetName: 'user_onboarding',
//       targetVersion: 'v1',
//       assignmentType: 'input',
//       status: 'active',
//       name: 'User Onboarding Input Form',
//       description: 'Collect new user information',
//       createdBy: acme_dev1.id
//     },
//     {
//       id: 'assign-workflow-config-001',
//       schemaId: 'form-workflow-config',
//       organizationId: acmeCorp.id,
//       targetType: 'workflow',
//       targetProject: acme_prod.id,
//       targetDomain: 'production',
//       targetName: 'data_processing_pipeline',
//       targetVersion: 'v1.0.0',
//       assignmentType: 'config',
//       status: 'active',
//       name: 'Pipeline Configuration',
//       description: 'Configure pipeline execution',
//       createdBy: acme_dev1.id
//     },
//     {
//       id: 'assign-ml-params-001',
//       schemaId: 'form-ml-hyperparameters',
//       organizationId: acmeCorp.id,
//       targetType: 'task',
//       targetProject: acme_ml.id,
//       targetDomain: 'production',
//       targetName: 'ml_train_model',
//       targetVersion: 'v1',
//       assignmentType: 'input',
//       status: 'active',
//       name: 'ML Training Parameters',
//       description: 'Configure model training',
//       createdBy: acme_dev1.id
//     },
//     {
//       id: 'assign-validation-001',
//       schemaId: 'form-data-validation',
//       organizationId: acmeCorp.id,
//       targetType: 'task',
//       targetProject: acme_dev.id,
//       targetDomain: 'development',
//       targetName: 'data_validation',
//       targetVersion: 'v1',
//       assignmentType: 'config',
//       status: 'active',
//       name: 'Validation Rules Config',
//       createdBy: acme_dev2.id
//     },
//     {
//       id: 'assign-feedback-001',
//       schemaId: 'form-simple-feedback',
//       organizationId: techStart.id,
//       targetType: 'workflow',
//       targetProject: tech_main.id,
//       targetDomain: 'development',
//       targetName: 'api_workflow',
//       targetVersion: 'v1.0.0',
//       assignmentType: 'output',
//       status: 'active',
//       name: 'User Feedback Collection',
//       createdBy: tech_dev.id
//     }
//   ];

//   for (const assignment of formAssignments) {
//     await prisma.formAssignment.upsert({
//       where: { id: assignment.id },
//       update: {},
//       create: assignment
//     });
//   }

//   console.log(`✅ Created ${formAssignments.length} form assignments`);

//   // ============================================================================
//   // FORM SUBMISSIONS
//   // ============================================================================
//   console.log('📝 Creating form submissions...');

//   const formSubmissions = [
//     // Successful submission
//     {
//       id: 'sub-user-reg-001',
//       assignmentId: 'assign-user-reg-001',
//       organizationId: acmeCorp.id,
//       data: {
//         firstName: 'John',
//         lastName: 'Doe',
//         email: 'john.doe@acme-corp.com',
//         department: 'Engineering',
//         startDate: '2024-01-15'
//       },
//       isValid: true,
//       errors: [],
//       submittedBy: acme_op1.id,
//       submittedAt: daysAgo(5),
//       completionTime: 120, // 2 minutes
//       status: 'success',
//       schemaId: 'form-user-registration'
//     },
//     // Submission with validation errors
//     {
//       id: 'sub-user-reg-002',
//       assignmentId: 'assign-user-reg-001',
//       organizationId: acmeCorp.id,
//       data: {
//         firstName: 'J', // Too short
//         lastName: 'Smith',
//         email: 'invalid-email' // Invalid format
//       },
//       isValid: false,
//       errors: [
//         { field: 'firstName', message: 'String is too short (1 chars), minimum 2' },
//         { field: 'email', message: 'Does not match format "email"' },
//         { field: 'department', message: 'Missing required field' }
//       ],
//       submittedBy: acme_op2.id,
//       submittedAt: daysAgo(3),
//       completionTime: 180,
//       status: 'failed',
//       schemaId: 'form-user-registration'
//     },
//     // ML parameters submission
//     {
//       id: 'sub-ml-params-001',
//       assignmentId: 'assign-ml-params-001',
//       organizationId: acmeCorp.id,
//       data: {
//         modelType: 'neural_network',
//         learningRate: 0.001,
//         epochs: 100,
//         batchSize: 64,
//         validationSplit: 0.2
//       },
//       isValid: true,
//       errors: [],
//       submittedBy: acme_dev1.id,
//       submittedAt: daysAgo(2),
//       completionTime: 300, // 5 minutes
//       status: 'success',
//       schemaId: 'form-ml-hyperparameters',
//       taskId: 'task-ml-train'
//     },
//     // Workflow config submission
//     {
//       id: 'sub-workflow-config-001',
//       assignmentId: 'assign-workflow-config-001',
//       organizationId: acmeCorp.id,
//       data: {
//         workflowName: 'Daily Data Pipeline',
//         priority: 'high',
//         retryCount: 3,
//         timeout: 1800,
//         notifyOnCompletion: true,
//         notifyOnFailure: true,
//         recipients: ['ops@acme-corp.com']
//       },
//       isValid: true,
//       errors: [],
//       submittedBy: acme_superAdmin.id,
//       submittedAt: daysAgo(1),
//       completionTime: 90,
//       status: 'success',
//       schemaId: 'form-workflow-config'
//     },
//     // TechStart feedback submission
//     {
//       id: 'sub-feedback-001',
//       assignmentId: 'assign-feedback-001',
//       organizationId: techStart.id,
//       data: {
//         rating: 5,
//         comments: 'Great workflow system! Very intuitive.',
//         wouldRecommend: true
//       },
//       isValid: true,
//       errors: [],
//       submittedBy: tech_dev.id,
//       submittedAt: hoursAgo(12),
//       completionTime: 45,
//       status: 'success',
//       schemaId: 'form-simple-feedback'
//     },
//     // Abandoned submission
//     {
//       id: 'sub-abandoned-001',
//       assignmentId: 'assign-user-reg-001',
//       organizationId: acmeCorp.id,
//       data: {
//         firstName: 'Jane'
//         // Incomplete - user abandoned form
//       },
//       isValid: false,
//       errors: [
//         { field: 'lastName', message: 'Required field missing' },
//         { field: 'email', message: 'Required field missing' },
//         { field: 'department', message: 'Required field missing' }
//       ],
//       submittedBy: acme_op1.id,
//       submittedAt: null, // Not submitted, just saved
//       completionTime: 30, // Only 30 seconds before abandoning
//       status: 'abandoned',
//       schemaId: 'form-user-registration'
//     }
//   ];

//   for (const submission of formSubmissions) {
//     await prisma.formSubmission.upsert({
//       where: { id: submission.id },
//       update: {},
//       create: submission
//     });
//   }

//   // Update schema usage counts
//   await prisma.formSchema.update({
//     where: { id: 'form-user-registration' },
//     data: { assignmentCount: 1, lastUsed: daysAgo(3), popularity: 85 }
//   });

//   await prisma.formSchema.update({
//     where: { id: 'form-workflow-config' },
//     data: { assignmentCount: 1, lastUsed: daysAgo(1), popularity: 92 }
//   });

//   await prisma.formSchema.update({
//     where: { id: 'form-ml-hyperparameters' },
//     data: { assignmentCount: 1, lastUsed: daysAgo(2), popularity: 78 }
//   });

//   console.log(`✅ Created ${formSubmissions.length} form submissions`);

//   console.log('\n🎉 EXTENDED SEEDING COMPLETED!');
//   console.log('\n📊 Extended Data Summary:');
//   console.log('   - 5 Tasks (reusable components)');
//   console.log('   - 6 Workflows (active, archived, various states)');
//   console.log('   - 8 Workflow Executions (all phases covered)');
//   console.log('   - 4 Execution Usage records (billing data)');
//   console.log('   - 4 Marketplace Workflows (featured, pending review)');
//   console.log('   - 3 Workflow Purchases (revenue tracking)');
//   console.log('   - 5 Payment History records (succeeded, failed, refunded)');
//   console.log('   - 4 Billing Alerts (usage limits, payment failures)');
//   console.log('   - 4 Feature Usage records (at/near limits)');
//   console.log('   - 5 Audit Logs (comprehensive activity tracking)');
//   console.log('   - 2 GDPR Requests (erasure, access)');
//   console.log(`   - ${usageRecords.length} Usage Records (30 days of metrics)`);
//   console.log('   - 5 Form Schemas (various categories and complexity)');
//   console.log('   - 5 Form Assignments (linked to tasks/workflows)');
//   console.log('   - 6 Form Submissions (success, failed, abandoned)');
//   console.log('\n✅ Production database is now ready for comprehensive testing!');
// }

// extendedSeed()
//   .catch((e) => {
//     console.error('❌ Error during extended seeding:', e);
//     process.exit(1);
//   })
//   .finally(async () => {
//     await prisma.$disconnect();
//   });
