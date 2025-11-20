'use client';

/**
 * Example Component for y
 */
export default function ExampleComponent() {
  return (
    <div style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
      <h3>y Component</h3>
      <p>This is an example component from my-awesome-plugin plugin.</p>
      <button onClick={() => alert('Hello from y!')}>
        Click Me
      </button>
    </div>
  );
}
