import { store } from './src/store.js';
import { runDoctor } from './src/init-doctor.js';

async function testWatch() {
  console.log('Testing pinmark_watch_annotations...');

  const session = store.createSession('https://test.com', 'test-session');
  
  // Test async blocking watch
  const watchPromise = store.waitForAnnotations({
    sessionId: 'test-session',
    batchWindowSeconds: 1,
    timeoutSeconds: 5,
  });

  // Add annotation after 500ms
  setTimeout(async () => {
    await store.addAnnotation('test-session', {
      id: 'ann-watch-1',
      index: 1,
      comment: 'Watch test annotation',
      url: 'https://test.com',
      timestamp: Date.now(),
      status: 'pending',
      element: {
        selector: 'button.save',
        tagName: 'button',
        classes: ['save'],
        dataAttributes: {},
        boundingRect: { x: 0, y: 0, width: 100, height: 40, top: 0, right: 100, bottom: 40, left: 0 }
      }
    });
  }, 500);

  const result = await watchPromise;
  console.log('Watcher received batch:', JSON.stringify(result, null, 2));

  if (result.count !== 1 || result.annotations[0].id !== 'ann-watch-1') {
    throw new Error('Watcher test failed: expected 1 annotation');
  }

  console.log('✓ Watcher test passed!');

  // Test doctor
  console.log('\nTesting pinmark doctor output...');
  await runDoctor(4747);
  console.log('✓ Doctor test passed!');
}

testWatch().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
