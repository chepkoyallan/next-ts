/**
 * Workflow Compiler Service V2 Tests
 * Tests for the minimal compiler focused on tasks and branches
 */

import type { WorkflowDraft } from '../workflow-draft-service';
import { WorkflowCompilerServiceV2 } from '../workflow-compiler-service-v2';

describe('WorkflowCompilerServiceV2', () => {
  let compiler: WorkflowCompilerServiceV2;

  beforeEach(() => {
    compiler = new WorkflowCompilerServiceV2();
  });

  describe('Simple Task Workflow', () => {
    it('should compile a single task workflow', () => {
      const draft: WorkflowDraft = {
        id: 'draft-1',
        project: 'testproject',
        domain: 'development',
        name: 'simple_task_workflow',
        version: 'v1',
        description: 'A simple workflow with one task',
        nodes: [
          {
            id: 'start',
            type: 'start',
            data: { label: 'Start' },
            position: { x: 0, y: 0 },
          },
          {
            id: 'task-1',
            type: 'task',
            data: {
              label: 'Process Data',
              taskId: {
                project: 'testproject',
                domain: 'development',
                name: 'process_data_task',
                version: 'v1',
              },
              inputSchema: {
                type: 'object',
                properties: {
                  input_data: { type: 'string' },
                },
                required: ['input_data'],
              },
              outputSchema: {
                type: 'object',
                properties: {
                  result: { type: 'string' },
                },
              },
            },
            position: { x: 200, y: 0 },
          },
          {
            id: 'end',
            type: 'end',
            data: { label: 'End' },
            position: { x: 400, y: 0 },
          },
        ],
        edges: [
          {
            id: 'e1',
            source: 'start',
            target: 'task-1',
            type: 'execution-path',
          },
          {
            id: 'e2',
            source: 'task-1',
            target: 'end',
            type: 'execution-path',
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = compiler.compile(draft);

      expect(result).toBeDefined();
      expect(result.closure).toBeDefined();
      expect(result.closure.primary).toBeDefined();
      expect(result.stats.taskCount).toBe(1);
      expect(result.stats.branchCount).toBe(0);
      expect(result.closure.primary?.template?.nodes).toHaveLength(1);
    });

    it('should compile a two-task workflow with data flow', () => {
      const draft: WorkflowDraft = {
        id: 'draft-2',
        project: 'testproject',
        domain: 'development',
        name: 'two_task_workflow',
        version: 'v1',
        description: 'Workflow with two connected tasks',
        nodes: [
          {
            id: 'start',
            type: 'start',
            data: { label: 'Start' },
            position: { x: 0, y: 0 },
          },
          {
            id: 'task-1',
            type: 'task',
            data: {
              label: 'Extract Data',
              taskId: {
                project: 'testproject',
                domain: 'development',
                name: 'extract_data_task',
                version: 'v1',
              },
              outputSchema: {
                type: 'object',
                properties: {
                  data: { type: 'string' },
                },
              },
            },
            position: { x: 200, y: 0 },
          },
          {
            id: 'task-2',
            type: 'task',
            data: {
              label: 'Transform Data',
              taskId: {
                project: 'testproject',
                domain: 'development',
                name: 'transform_data_task',
                version: 'v1',
              },
              inputSchema: {
                type: 'object',
                properties: {
                  raw_data: { type: 'string' },
                },
              },
            },
            position: { x: 400, y: 0 },
          },
          {
            id: 'end',
            type: 'end',
            data: { label: 'End' },
            position: { x: 600, y: 0 },
          },
        ],
        edges: [
          {
            id: 'e1',
            source: 'start',
            target: 'task-1',
            type: 'execution-path',
          },
          {
            id: 'e2',
            source: 'task-1',
            target: 'task-2',
            type: 'data',
            data: {
              fieldMappings: [
                {
                  sourceField: 'data',
                  targetField: 'raw_data',
                },
              ],
            },
          },
          {
            id: 'e3',
            source: 'task-2',
            target: 'end',
            type: 'execution-path',
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = compiler.compile(draft);

      expect(result).toBeDefined();
      expect(result.stats.taskCount).toBe(2);
      expect(result.closure.primary?.template?.nodes).toHaveLength(2);

      // Check that task-2 has input binding from task-1
      const task2Node = result.closure.primary?.template?.nodes?.find((n) => n.id === 'task-2');
      expect(task2Node).toBeDefined();
      expect(task2Node?.inputs).toHaveLength(1);
      expect(task2Node?.inputs?.[0].binding?.promise?.nodeId).toBe('task-1');
      expect(task2Node?.inputs?.[0].binding?.promise?.var).toBe('data');
    });
  });

  describe('Branch Workflow', () => {
    it('should compile a workflow with a branch node', () => {
      const draft: WorkflowDraft = {
        id: 'draft-3',
        project: 'testproject',
        domain: 'development',
        name: 'branch_workflow',
        version: 'v1',
        description: 'Workflow with conditional branching',
        nodes: [
          {
            id: 'start',
            type: 'start',
            data: { label: 'Start' },
            position: { x: 0, y: 0 },
          },
          {
            id: 'task-1',
            type: 'task',
            data: {
              label: 'Check Value',
              taskId: {
                project: 'testproject',
                domain: 'development',
                name: 'check_value_task',
                version: 'v1',
              },
              outputSchema: {
                type: 'object',
                properties: {
                  value: { type: 'integer' },
                },
              },
            },
            position: { x: 200, y: 0 },
          },
          {
            id: 'branch-1',
            type: 'branch',
            data: {
              label: 'Decision',
              branchConfig: {
                primaryCase: {
                  id: 'case-1',
                  condition: {
                    type: 'comparison',
                    expression: {
                      operator: '>',
                      leftValue: { type: 'field', field: 'value' },
                      rightValue: { type: 'constant', constant: { value: 10 } },
                    },
                  },
                  thenNodeId: 'task-2',
                },
                elseCases: [],
                elseNodeId: 'task-3',
              },
            },
            position: { x: 400, y: 0 },
          },
          {
            id: 'task-2',
            type: 'task',
            data: {
              label: 'High Value Path',
              taskId: {
                project: 'testproject',
                domain: 'development',
                name: 'high_value_task',
                version: 'v1',
              },
            },
            position: { x: 600, y: -100 },
          },
          {
            id: 'task-3',
            type: 'task',
            data: {
              label: 'Low Value Path',
              taskId: {
                project: 'testproject',
                domain: 'development',
                name: 'low_value_task',
                version: 'v1',
              },
            },
            position: { x: 600, y: 100 },
          },
          {
            id: 'end',
            type: 'end',
            data: { label: 'End' },
            position: { x: 800, y: 0 },
          },
        ],
        edges: [
          {
            id: 'e1',
            source: 'start',
            target: 'task-1',
            type: 'execution-path',
          },
          {
            id: 'e2',
            source: 'task-1',
            target: 'branch-1',
            type: 'data',
          },
          {
            id: 'e3',
            source: 'branch-1',
            target: 'end',
            type: 'execution-path',
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = compiler.compile(draft);

      expect(result).toBeDefined();
      expect(result.stats.taskCount).toBe(1); // Only task-1, others are embedded in branch
      expect(result.stats.branchCount).toBe(1);

      // Check branch node structure
      const branchNode = result.closure.primary?.template?.nodes?.find((n) => n.id === 'branch-1');
      expect(branchNode).toBeDefined();
      expect(branchNode?.branchNode).toBeDefined();
      expect(branchNode?.branchNode?.ifElse).toBeDefined();
      expect(branchNode?.branchNode?.ifElse?.case).toBeDefined();
      expect(branchNode?.branchNode?.ifElse?.case?.thenNode).toBeDefined();
      expect(branchNode?.branchNode?.ifElse?.elseNode).toBeDefined();
    });

    it('should compile a branch with else-if cases', () => {
      const draft: WorkflowDraft = {
        id: 'draft-4',
        project: 'testproject',
        domain: 'development',
        name: 'complex_branch_workflow',
        version: 'v1',
        description: 'Workflow with multiple branch conditions',
        nodes: [
          {
            id: 'start',
            type: 'start',
            data: { label: 'Start' },
            position: { x: 0, y: 0 },
          },
          {
            id: 'task-1',
            type: 'task',
            data: {
              label: 'Get Score',
              taskId: {
                project: 'testproject',
                domain: 'development',
                name: 'get_score_task',
                version: 'v1',
              },
              outputSchema: {
                type: 'object',
                properties: {
                  score: { type: 'integer' },
                },
              },
            },
            position: { x: 200, y: 0 },
          },
          {
            id: 'branch-1',
            type: 'branch',
            data: {
              label: 'Grade Decision',
              branchConfig: {
                primaryCase: {
                  id: 'case-primary',
                  condition: {
                    type: 'comparison',
                    expression: {
                      operator: '>=',
                      leftValue: { type: 'field', field: 'score' },
                      rightValue: { type: 'constant', constant: { value: 90 } },
                    },
                  },
                  thenNodeId: 'task-a',
                },
                elseCases: [
                  {
                    id: 'case-else-1',
                    condition: {
                      type: 'comparison',
                      expression: {
                        operator: '>=',
                        leftValue: { type: 'field', field: 'score' },
                        rightValue: { type: 'constant', constant: { value: 70 } },
                      },
                    },
                    thenNodeId: 'task-b',
                  },
                ],
                elseNodeId: 'task-c',
              },
            },
            position: { x: 400, y: 0 },
          },
          {
            id: 'task-a',
            type: 'task',
            data: {
              label: 'Grade A',
              taskId: {
                project: 'testproject',
                domain: 'development',
                name: 'grade_a_task',
                version: 'v1',
              },
            },
            position: { x: 600, y: -150 },
          },
          {
            id: 'task-b',
            type: 'task',
            data: {
              label: 'Grade B',
              taskId: {
                project: 'testproject',
                domain: 'development',
                name: 'grade_b_task',
                version: 'v1',
              },
            },
            position: { x: 600, y: 0 },
          },
          {
            id: 'task-c',
            type: 'task',
            data: {
              label: 'Grade C',
              taskId: {
                project: 'testproject',
                domain: 'development',
                name: 'grade_c_task',
                version: 'v1',
              },
            },
            position: { x: 600, y: 150 },
          },
          {
            id: 'end',
            type: 'end',
            data: { label: 'End' },
            position: { x: 800, y: 0 },
          },
        ],
        edges: [
          {
            id: 'e1',
            source: 'start',
            target: 'task-1',
            type: 'execution-path',
          },
          {
            id: 'e2',
            source: 'task-1',
            target: 'branch-1',
            type: 'data',
          },
          {
            id: 'e3',
            source: 'branch-1',
            target: 'end',
            type: 'execution-path',
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = compiler.compile(draft);

      expect(result).toBeDefined();
      expect(result.stats.branchCount).toBe(1);

      // Check else-if case
      const branchNode = result.closure.primary?.template?.nodes?.find((n) => n.id === 'branch-1');
      expect(branchNode?.branchNode?.ifElse?.other).toHaveLength(1);
      expect(branchNode?.branchNode?.ifElse?.other?.[0].thenNode).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should throw error for task without taskId', () => {
      const draft: WorkflowDraft = {
        id: 'draft-5',
        project: 'testproject',
        domain: 'development',
        name: 'invalid_task_workflow',
        version: 'v1',
        description: 'Invalid workflow',
        nodes: [
          {
            id: 'start',
            type: 'start',
            data: { label: 'Start' },
            position: { x: 0, y: 0 },
          },
          {
            id: 'task-1',
            type: 'task',
            data: {
              label: 'Invalid Task',
              // Missing taskId
            },
            position: { x: 200, y: 0 },
          },
          {
            id: 'end',
            type: 'end',
            data: { label: 'End' },
            position: { x: 400, y: 0 },
          },
        ],
        edges: [
          {
            id: 'e1',
            source: 'start',
            target: 'task-1',
            type: 'execution-path',
          },
          {
            id: 'e2',
            source: 'task-1',
            target: 'end',
            type: 'execution-path',
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(() => compiler.compile(draft)).toThrow("Task node 'task-1' missing taskId");
    });

    it('should throw error for branch without branchConfig', () => {
      const draft: WorkflowDraft = {
        id: 'draft-6',
        project: 'testproject',
        domain: 'development',
        name: 'invalid_branch_workflow',
        version: 'v1',
        description: 'Invalid branch workflow',
        nodes: [
          {
            id: 'start',
            type: 'start',
            data: { label: 'Start' },
            position: { x: 0, y: 0 },
          },
          {
            id: 'branch-1',
            type: 'branch',
            data: {
              label: 'Invalid Branch',
              // Missing branchConfig
            },
            position: { x: 200, y: 0 },
          },
          {
            id: 'end',
            type: 'end',
            data: { label: 'End' },
            position: { x: 400, y: 0 },
          },
        ],
        edges: [
          {
            id: 'e1',
            source: 'start',
            target: 'branch-1',
            type: 'execution-path',
          },
          {
            id: 'e2',
            source: 'branch-1',
            target: 'end',
            type: 'execution-path',
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(() => compiler.compile(draft)).toThrow("Branch node 'branch-1' missing branchConfig");
    });
  });
});
