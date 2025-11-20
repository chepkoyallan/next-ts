'use client';

import { useEffect, useState } from 'react';
import { hookRegistry } from '@app/config/registry';
import type { HookDefinition, HookSubscription } from '@app/config/registry';
import {
  useHooks,
  useHookStats,
  useHookSubscription,
  useHookEmitter,
} from '@app/config/registry';

export default function RegistryPhase3TestPage() {
  const [hookStats, setHookStats] = useState<any>(null);
  const [hooks, setHooks] = useState<HookDefinition[]>([]);
  const [subscriptions, setSubscriptions] = useState<HookSubscription[]>([]);
  const [events, setEvents] = useState<any[]>([]);

  // Use the hook stats hook
  const stats = useHookStats();

  // Use the hook emitter for test events
  const { emit } = useHookEmitter('test.event');

  useEffect(() => {
    // Define some test hooks
    hookRegistry.defineHook('test.event', 'test-plugin', 'A test event hook');
    hookRegistry.defineHook('user.action', 'test-plugin', 'User action hook');
    hookRegistry.defineHook('system.status', 'test-plugin', 'System status hook');

    // Subscribe to test events
    const sub1 = hookRegistry.subscribe(
      'test.event',
      (data) => {
        console.log('[Test Hook] Received event:', data);
        setEvents((prev) => [...prev, { hook: 'test.event', data, timestamp: Date.now() }]);
      },
      'test-subscriber-1',
      { priority: 10 }
    );

    const sub2 = hookRegistry.subscribe(
      'test.event',
      (data) => {
        console.log('[Test Hook 2] Received event:', data);
      },
      'test-subscriber-2',
      { priority: 5 }
    );

    // Subscribe to user actions
    const sub3 = hookRegistry.subscribe(
      'user.action',
      (data) => {
        console.log('[User Action] Received:', data);
        setEvents((prev) => [...prev, { hook: 'user.action', data, timestamp: Date.now() }]);
      },
      'test-subscriber-3'
    );

    // Update stats and hooks
    const updateData = () => {
      setHookStats(hookRegistry.getStats());
      setHooks(hookRegistry.getHooks());
      setSubscriptions([
        ...hookRegistry.getSubscriptions('test.event'),
        ...hookRegistry.getSubscriptions('user.action'),
      ]);
    };

    updateData();
    const interval = setInterval(updateData, 1000);

    return () => {
      clearInterval(interval);
      hookRegistry.unsubscribe(sub1);
      hookRegistry.unsubscribe(sub2);
      hookRegistry.unsubscribe(sub3);
    };
  }, []);

  const handleEmitEvent = async () => {
    await hookRegistry.emit('test.event', {
      message: 'Test event emitted',
      timestamp: Date.now(),
    });
  };

  const handleEmitUserAction = async () => {
    await hookRegistry.emit('user.action', {
      action: 'button_click',
      userId: 'test-user',
      timestamp: Date.now(),
    });
  };

  const handleEmitSequential = async () => {
    await hookRegistry.emitSequential('test.event', {
      message: 'Sequential event',
      timestamp: Date.now(),
    });
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>Registry System - Phase 3 Test</h1>
      <p>Testing Hook Registry and Event System</p>

      <div style={{ marginTop: '30px' }}>
        <h2>Hook Registry Statistics</h2>
        <div
          style={{
            background: '#f5f5f5',
            padding: '15px',
            borderRadius: '5px',
            marginTop: '10px',
          }}
        >
          <div>
            <strong>Total Hooks:</strong> {stats?.totalHooks || 0}
          </div>
          <div>
            <strong>Total Subscriptions:</strong> {stats?.totalSubscriptions || 0}
          </div>
          <div>
            <strong>Active Subscriptions:</strong> {stats?.activeSubscriptions || 0}
          </div>
          <div>
            <strong>Plugins:</strong> {stats?.plugins || 0}
          </div>
        </div>
      </div>

      <div style={{ marginTop: '30px' }}>
        <h2>Defined Hooks</h2>
        <div style={{ marginTop: '10px' }}>
          {hooks.map((hook) => (
            <div
              key={hook.name}
              style={{
                background: '#e3f2fd',
                padding: '10px',
                marginBottom: '10px',
                borderRadius: '5px',
                borderLeft: '4px solid #2196f3',
              }}
            >
              <div>
                <strong>{hook.name}</strong> (by {hook.pluginId})
              </div>
              {hook.description && (
                <div style={{ fontSize: '0.9em', color: '#666', marginTop: '5px' }}>
                  {hook.description}
                </div>
              )}
              <div style={{ fontSize: '0.85em', marginTop: '5px' }}>
                Subscribers: {hook.subscriberCount} | Executions: {hook.executionCount}
                {hook.lastExecuted && (
                  <span> | Last: {new Date(hook.lastExecuted).toLocaleTimeString()}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: '30px' }}>
        <h2>Active Subscriptions</h2>
        <div style={{ marginTop: '10px' }}>
          {subscriptions.map((sub) => (
            <div
              key={sub.id}
              style={{
                background: '#f3e5f5',
                padding: '10px',
                marginBottom: '10px',
                borderRadius: '5px',
                borderLeft: '4px solid #9c27b0',
              }}
            >
              <div>
                <strong>Hook:</strong> {sub.hookName}
              </div>
              <div style={{ fontSize: '0.9em', marginTop: '5px' }}>
                Plugin: {sub.pluginId} | Priority: {sub.priority} | Enabled:{' '}
                {sub.enabled ? 'Yes' : 'No'}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: '30px' }}>
        <h2>Test Actions</h2>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={handleEmitEvent}
            style={{
              padding: '10px 20px',
              background: '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
            }}
          >
            Emit Test Event
          </button>
          <button
            onClick={handleEmitUserAction}
            style={{
              padding: '10px 20px',
              background: '#2196f3',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
            }}
          >
            Emit User Action
          </button>
          <button
            onClick={handleEmitSequential}
            style={{
              padding: '10px 20px',
              background: '#ff9800',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
            }}
          >
            Emit Sequential
          </button>
        </div>
      </div>

      <div style={{ marginTop: '30px' }}>
        <h2>Event Log ({events.length} events)</h2>
        <div
          style={{
            maxHeight: '300px',
            overflow: 'auto',
            background: '#263238',
            padding: '10px',
            borderRadius: '5px',
            color: '#aed581',
            fontFamily: 'monospace',
            fontSize: '0.9em',
          }}
        >
          {events.length === 0 ? (
            <div style={{ color: '#666' }}>No events yet. Click buttons above to emit events.</div>
          ) : (
            events
              .slice()
              .reverse()
              .map((event, index) => (
                <div key={index} style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #37474f' }}>
                  <div style={{ color: '#81c784' }}>
                    [{new Date(event.timestamp).toLocaleTimeString()}] {event.hook}
                  </div>
                  <div style={{ paddingLeft: '10px', color: '#fff59d' }}>
                    {JSON.stringify(event.data, null, 2)}
                  </div>
                </div>
              ))
          )}
        </div>
      </div>

      <div style={{ marginTop: '30px' }}>
        <h2>System Features Demonstrated</h2>
        <ul style={{ lineHeight: '1.8' }}>
          <li>
            <strong>Hook Registry:</strong> Event-driven communication system
          </li>
          <li>
            <strong>Hook Definitions:</strong> Plugins can define custom hooks
          </li>
          <li>
            <strong>Subscriptions:</strong> Multiple subscribers with priority ordering
          </li>
          <li>
            <strong>Event Emission:</strong> Parallel and sequential execution modes
          </li>
          <li>
            <strong>React Hooks:</strong> useHooks, useHookStats, useHookEmitter
          </li>
          <li>
            <strong>Real-time Updates:</strong> Live statistics and event logs
          </li>
          <li>
            <strong>Plugin Manifest:</strong> JSON-based plugin configuration (see example-analytics)
          </li>
        </ul>
      </div>
    </div>
  );
}
