const { JvmExecutionService } = require('../dist/services/sandbox/JvmExecutionService');

async function testSecurityReflectionGuards() {
  console.log('========================================================================');
  console.log('🧪 VERIFYING DYNAMIC REFLECTION & THREAD BOMB AST SECURITY GUARDS');
  console.log('========================================================================\n');

  // 1. Test Class.forName reflection exploit blocked
  console.log('--- 1. Testing Class.forName exploit attempt ---');
  const exploitCode = [
    {
      path: 'src/main/java/com/ExploitService.java',
      content: `package com;
import java.lang.reflect.Method;
public class ExploitService {
    public void hack() throws Exception {
        Class<?> clazz = Class.forName("java.lang.System");
        Method m = clazz.getMethod("exit", int.class);
        m.invoke(null, 1);
    }
}`
    }
  ];

  const res1 = await JvmExecutionService.execute({ challengeId: 'test_exploit', files: exploitCode });
  console.log('  * Exploit Blocked:', !res1.isCompilable);
  console.log('  * Error:', res1.error || res1.syntaxErrors?.[0]?.errorMessage);
  if (res1.isCompilable) {
    throw new Error('Security scanner failed to block Class.forName dynamic reflection!');
  }
  console.log('  ✅ Class.forName Dynamic Reflection Correctly Blocked!');

  // 2. Test Thread Bomb blocked
  console.log('\n--- 2. Testing Thread Bomb (new Thread) exploit attempt ---');
  const threadBombCode = [
    {
      path: 'src/main/java/com/BombService.java',
      content: `package com;
public class BombService {
    public void spawn() {
        new Thread(() -> {
            while (true) {}
        }).start();
    }
}`
    }
  ];

  const res2 = await JvmExecutionService.execute({ challengeId: 'test_thread_bomb', files: threadBombCode });
  console.log('  * Thread Bomb Blocked:', !res2.isCompilable);
  console.log('  * Error:', res2.error || res2.syntaxErrors?.[0]?.errorMessage);
  if (res2.isCompilable) {
    throw new Error('Security scanner failed to block new Thread() Thread Bomb!');
  }
  console.log('  ✅ Thread Bomb Correctly Blocked!');

  console.log('\n🎉 ALL ADVANCED AST SECURITY GUARDS VERIFIED SUCCESSFULLY!');
}

testSecurityReflectionGuards().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
