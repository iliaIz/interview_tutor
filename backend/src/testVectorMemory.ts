import {
  cosineSimilarity,
  applyKnowledgeDecay,
  recordNewErrorGap,
  getKnowledgeRadarData,
  resetGapForPractice,
  getUserProfile,
  updateUserProfile
} from './services/vectorMemoryService';

async function runTests() {
  console.log('🧪 Starting Vector Memory & Scaffolded Knowledge Tracing Tests...');

  // 1. Test Cosine Similarity Math
  const vecA = new Float32Array([1, 0, 0, 0]);
  const vecB = new Float32Array([1, 0, 0, 0]);
  const vecC = new Float32Array([0, 1, 0, 0]);
  const vecD = new Float32Array([0.7071, 0.7071, 0, 0]);

  const simIdentical = cosineSimilarity(vecA, vecB);
  const simOrthogonal = cosineSimilarity(vecA, vecC);
  const simPartial = cosineSimilarity(vecA, vecD);

  console.log(`✓ Cosine Similarity (Identical): ${simIdentical.toFixed(4)} (Expected: ~1.0000)`);
  console.log(`✓ Cosine Similarity (Orthogonal): ${simOrthogonal.toFixed(4)} (Expected: ~0.0000)`);
  console.log(`✓ Cosine Similarity (Partial): ${simPartial.toFixed(4)} (Expected: ~0.7071)`);

  if (Math.abs(simIdentical - 1.0) > 0.001 || Math.abs(simOrthogonal - 0.0) > 0.001) {
    throw new Error('Cosine similarity test failed!');
  }

  // 2. Test User Profile Persistence
  const updatedProfile = updateUserProfile({
    candidateName: 'Анна Архитектор',
    targetSeniority: 'senior',
    primaryStack: 'Java 21, Spring Boot 3.3, Kafka, PostgreSQL, Redis'
  });
  console.log(`✓ User Profile Updated: ${updatedProfile.candidateName} [${updatedProfile.targetSeniority}]`);

  const fetchedProfile = getUserProfile();
  if (fetchedProfile.candidateName !== 'Анна Архитектор' || fetchedProfile.targetSeniority !== 'senior') {
    throw new Error('User profile persistence test failed!');
  }

  // 3. Test Recording New Error Gap
  const gapId = await recordNewErrorGap({
    questionId: 'test_q_aop_01',
    topic: 'Spring Framework',
    subtopic: 'AOP & Proxying',
    errorConcept: 'Self-invocation bypasses Spring @Transactional proxy',
    initialDeficit: 1.0
  });
  console.log(`✓ Recorded Error Gap: ${gapId}`);

  let radar = getKnowledgeRadarData();
  const recordedGap = radar.activeDeficits.find((g) => g.id === gapId);
  if (!recordedGap || recordedGap.deficitWeight !== 1.0 || recordedGap.status !== 'ACTIVE_DEFICIT') {
    throw new Error(`Error gap record verification failed for ${gapId}`);
  }
  console.log(`✓ Gap verified in Active Deficits with weight ${recordedGap.deficitWeight}`);

  // 4. Test Guided Assistance (-0.5 decay)
  const guidedDecay = await applyKnowledgeDecay({
    questionId: 'test_q_aop_01',
    topic: 'Spring Framework',
    assistanceLevel: 'guided',
    resolvedGapIds: [gapId]
  });
  console.log('✓ Applied Guided Decay (-0.5):', guidedDecay);

  radar = getKnowledgeRadarData();
  const verifyingGap = radar.verifyingGaps.find((g) => g.id === gapId);
  if (!verifyingGap || verifyingGap.deficitWeight !== 0.5 || verifyingGap.status !== 'VERIFYING') {
    throw new Error(`Guided decay failed! Weight: ${verifyingGap?.deficitWeight}, Status: ${verifyingGap?.status}`);
  }
  console.log(`✓ Gap transitioned to VERIFYING (Weight: ${verifyingGap.deficitWeight})`);

  // 5. Test Solo Mastery (-1.0 decay -> MASTERED)
  const soloDecay = await applyKnowledgeDecay({
    questionId: 'test_q_aop_01',
    topic: 'Spring Framework',
    assistanceLevel: 'solo',
    resolvedGapIds: [gapId]
  });
  console.log('✓ Applied Solo Decay (-1.0):', soloDecay);

  radar = getKnowledgeRadarData();
  const masteredGap = radar.masteredGaps.find((g) => g.id === gapId);
  if (!masteredGap || masteredGap.deficitWeight !== 0.0 || masteredGap.status !== 'MASTERED') {
    throw new Error(`Solo decay failed! Status: ${masteredGap?.status}, Weight: ${masteredGap?.deficitWeight}`);
  }
  console.log(`✓ Gap successfully neutralized and transitioned to MASTERED (Weight: 0.0)`);

  // 6. Test Reset for Practice
  const resetSuccess = resetGapForPractice(gapId);
  if (!resetSuccess) throw new Error('Reset gap failed!');
  radar = getKnowledgeRadarData();
  const resetGap = radar.activeDeficits.find((g) => g.id === gapId);
  if (!resetGap || resetGap.deficitWeight !== 1.0 || resetGap.status !== 'ACTIVE_DEFICIT') {
    throw new Error('Reset gap verification failed!');
  }
  console.log(`✓ Gap reset back to ACTIVE_DEFICIT (Weight: 1.0)`);

  console.log('🎉 ALL VECTOR MEMORY & SCAFFOLDED KNOWLEDGE TRACING TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
