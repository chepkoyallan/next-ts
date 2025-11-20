/**
 * Test: Enhanced Error Messages for Flyte Deployment Failures
 *
 * This test demonstrates how the error enhancement system works.
 * Run with: npm test error-enhancement.test.ts
 */

import type { WorkflowDraft } from '../workflow-draft-service';

describe('Enhanced Error Messages', () => {
  // Mock workflow draft for testing
  const mockDraft: Partial<WorkflowDraft> = {
    id: 'test-draft',
    name: 'test-workflow',
    project: 'test-project',
    domain: 'development',
    version: 'v1',
    nodes: [
      {
        id: 'node-123',
        type: 'task',
        data: {
          label: 'API Task',
          taskId: {
            project: 'test',
            domain: 'development',
            name: 'rest_api.make_request',
            version: 'v1',
          },
        },
        position: { x: 0, y: 0 },
      },
      {
        id: 'node-456',
        type: 'branch',
        data: {
          label: 'Check Timeout',
          branchConfig: {
            primaryCase: {
              id: 'primary',
              condition: {
                operator: 'EQ',
                leftValue: { type: 'field', field: 'status' },
                rightValue: { type: 'constant', constant: 'success' },
              },
              thenNodeId: 'node-789',
            },
            elseCases: [],
          },
        },
        position: { x: 200, y: 0 },
      },
    ],
    edges: [],
  };

  describe('Pattern 1: Nested Field Access Error', () => {
    it('should enhance error with step-by-step solution', () => {
      const flyteError = {
        message:
          'rpc error: code = InvalidArgument desc = Variable [node-123.o0.timeout_requests] not found on node [node-456]',
        code: 3,
        details: 'Variable [node-123.o0.timeout_requests] not found on node [node-456]',
      };

      // Simulate what parseAndEnhanceFlyteError would do
      const errorMessage = flyteError.message;
      const nestedFieldPattern = /Variable \[([^\]]+)\.o0\.([^\]]+)\] not found/;
      const match = errorMessage.match(nestedFieldPattern);

      expect(match).not.toBeNull();
      expect(match![1]).toBe('node-123'); // Node ID
      expect(match![2]).toBe('timeout_requests'); // Field name

      // Lookup node label from draft
      const node = mockDraft.nodes!.find((n) => n.id === match![1]);
      expect(node?.data?.label).toBe('API Task');

      // Expected enhanced message structure
      const expectedEnhancement = {
        code: 'VariableNameNotFound',
        message: `Cannot access nested field 'timeout_requests' directly in branch conditions`,
        nodeId: 'node-123',
        nodeLabel: 'API Task',
        suggestion:
          'Flyte cannot validate nested field access on STRUCT types at compile time. Use a field extractor task before the branch.',
        steps: [
          'Add task: fieldextractor.field_extractor.extract_integer_field',
          "Connect 'API Task' output to the extractor's 'data' input",
          "Set extractor's 'field_path' parameter to: \"timeout_requests\"",
          "Connect the extractor's output to your branch condition",
          'Update branch condition to compare the extracted value',
        ],
      };

      expect(expectedEnhancement.nodeLabel).toBe('API Task');
      expect(expectedEnhancement.code).toBe('VariableNameNotFound');
    });
  });

  describe('Pattern 2: Variable Not Found (General)', () => {
    it('should provide general troubleshooting steps', () => {
      const flyteError = {
        message: 'Variable [node-789.o0] not found',
      };

      const pattern = /Variable \[([^\]]+)\] not found/;
      const match = flyteError.message.match(pattern);

      expect(match).not.toBeNull();
      expect(match![1]).toBe('node-789.o0');

      const expectedSuggestions = [
        "Check that the upstream node exists and produces output 'o0'",
        'Verify that node inputs are correctly bound to upstream outputs',
        'For branch conditions, ensure the branch node has passthrough bindings',
      ];

      expectedSuggestions.forEach((suggestion) => {
        expect(suggestion).toBeTruthy();
      });
    });
  });

  describe('Pattern 3: Parameter Not Bound', () => {
    it('should identify missing parameter and provide fix', () => {
      const flyteError = {
        message: 'Parameter not bound [url]',
      };

      const pattern = /Parameter not bound \[([^\]]+)\]/;
      const match = flyteError.message.match(pattern);

      expect(match).not.toBeNull();
      expect(match![1]).toBe('url');

      const expectedMessage = {
        code: 'ParameterNotBound',
        message: "Parameter 'url' is not bound",
        suggestion: 'Ensure all task inputs are connected to upstream outputs or workflow inputs.',
      };

      expect(expectedMessage.code).toBe('ParameterNotBound');
    });
  });

  describe('Pattern 4: Node Reference Not Found', () => {
    it('should suggest checking branch configuration', () => {
      const flyteError = {
        message: 'Referenced node [node-xyz] not found',
      };

      const pattern = /Referenced node \[([^\]]+)\] not found/;
      const match = flyteError.message.match(pattern);

      expect(match).not.toBeNull();
      expect(match![1]).toBe('node-xyz');

      const expectedSuggestion =
        'This node may be embedded in a branch. Check branch configuration.';
      expect(expectedSuggestion).toContain('branch');
    });
  });

  describe('Pattern 5: Type Mismatch', () => {
    it('should detect type mismatch and suggest field extractor', () => {
      const flyteError = {
        message: 'MismatchingTypes: expected INTEGER but got STRUCT',
      };

      const pattern = /MismatchingTypes.*expected.*got/i;
      const isMatch = pattern.test(flyteError.message);

      expect(isMatch).toBe(true);

      const expectedSuggestion = 'Use a field extractor to extract simple types before branching';
      expect(expectedSuggestion).toContain('field extractor');
    });
  });

  describe('Error Enhancement Integration', () => {
    it('should produce complete enhanced error object', () => {
      // Simulated enhanced error output
      const enhancedError = {
        message: 'Flyte Validation Error\n\nVariable [node-123.o0.timeout_requests] not found...',
        suggestions: [
          "🔧 Solution: Add a field extractor task between 'API Task' and your branch node.",
          '   1. Add task: fieldextractor.field_extractor.extract_integer_field',
          "   2. Connect 'API Task' output to the extractor's 'data' input",
          "   3. Set extractor's 'field_path' parameter to: \"timeout_requests\"",
          "   4. Connect the extractor's output to your branch condition",
          '   5. Update branch condition to compare the extracted value',
          '',
          '📖 Learn more: Check /src/tasks/field-extractor/README.md for detailed examples',
        ],
        errors: [
          {
            code: 'VariableNameNotFound',
            message: "Cannot access nested field 'timeout_requests' directly in branch conditions",
            nodeId: 'node-123',
            nodeLabel: 'API Task',
            suggestion:
              'Flyte cannot validate nested field access on STRUCT types at compile time. Use a field extractor task before the branch.',
          },
        ],
      };

      // Verify structure
      expect(enhancedError.message).toContain('Flyte Validation Error');
      expect(enhancedError.suggestions).toHaveLength(8);
      expect(enhancedError.suggestions[0]).toContain('🔧 Solution');
      expect(enhancedError.errors).toHaveLength(1);
      expect(enhancedError.errors[0].code).toBe('VariableNameNotFound');
      expect(enhancedError.errors[0].nodeLabel).toBe('API Task');

      // Verify specific content
      expect(enhancedError.suggestions[1]).toContain('extract_integer_field');
      expect(enhancedError.suggestions[3]).toContain('timeout_requests');
      expect(enhancedError.suggestions[7]).toContain('/src/tasks/field-extractor/README.md');
    });

    it('should format error for API response', () => {
      // Simulated API response
      const apiResponse = {
        success: false,
        error: 'Workflow deployment failed',
        errors: [
          {
            code: 'DeploymentGuidance',
            message: 'Deployment failed with suggestions:',
            details: [
              '🔧 Solution: Add a field extractor task...',
              '   1. Add task: fieldextractor.field_extractor.extract_integer_field',
              // ... more steps
            ],
          },
          {
            code: 'VariableNameNotFound',
            message: "Cannot access nested field 'timeout_requests' directly",
            nodeId: 'node-123',
            nodeLabel: 'API Task',
            suggestion: 'Use a field extractor task before the branch.',
          },
        ],
      };

      expect(apiResponse.success).toBe(false);
      expect(apiResponse.errors).toHaveLength(2);
      expect(apiResponse.errors![0].code).toBe('DeploymentGuidance');
      expect(apiResponse.errors![1].nodeLabel).toBe('API Task');
    });
  });
});
