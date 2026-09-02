const { db } = require('../dist/services/db');

async function testSubmissionsDtoRoundtrip() {
  console.log('========================================================================');
  console.log('🧪 VERIFYING SYSTEM DESIGN & TRIAGE DTO PERSISTENCE & ROUND-TRIP');
  console.log('========================================================================\n');

  const userId = 'test_user_phase3';

  // 1. Test System Design with Canvas Topology
  const sdScenarioId = 'test_sd_scenario';
  const canvasTopology = {
    nodes: [
      { id: 'node-1', label: 'API Gateway', type: 'gateway' },
      { id: 'node-2', label: 'Order Service', type: 'service' }
    ],
    edges: [
      { source: 'node-1', target: 'node-2', protocol: 'gRPC' }
    ],
    simulationMetrics: {
      globalInputRps: 5000,
      globalProcessedRps: 4990,
      globalP99LatencyMs: 12
    }
  };

  const sdNotes = '## Scalability Strategy\nPartitioned by userId across 16 shards.';
  const sdEval = {
    totalScore: 92,
    verdict: 'STRONG_HIRE',
    strengths: ['Clear CQRS separation', 'Sub-15ms p99 latency']
  };

  db.prepare(`
    INSERT INTO system_design_submissions (
      id, scenario_id, user_id, architecture_mermaid, notes_markdown, evaluation_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(
    `sd_${Date.now()}`,
    sdScenarioId,
    userId,
    JSON.stringify(canvasTopology),
    sdNotes,
    JSON.stringify(sdEval)
  );

  // Fetch back
  const sdRow = db.prepare(`
    SELECT architecture_mermaid, notes_markdown, evaluation_json
    FROM system_design_submissions
    WHERE scenario_id = ? AND user_id = ?
    ORDER BY created_at DESC LIMIT 1
  `).get(sdScenarioId, userId);

  const parsedTopology = JSON.parse(sdRow.architecture_mermaid);
  const parsedEval = JSON.parse(sdRow.evaluation_json);

  console.log('✅ System Design Saved & Restored:');
  console.log(`  - Nodes count: ${parsedTopology.nodes.length}`);
  console.log(`  - Edges count: ${parsedTopology.edges.length}`);
  console.log(`  - Evaluation totalScore: ${parsedEval.totalScore}`);
  console.log(`  - Notes: "${sdRow.notes_markdown.slice(0, 24)}..."`);

  if (parsedTopology.nodes.length !== 2 || parsedEval.totalScore !== 92) {
    throw new Error('System design roundtrip failed!');
  }

  // 2. Test Incident Triage Accurate Score Preservation
  const incidentId = 'test_incident_oom';
  const triageHypothesis = 'Unbounded byte array allocation in ZipExportService.';
  const triagePrevention = 'Add MaxHeapBuffer constraint and streaming chunks.';
  const exactLlmScore = 87; // Not a crude 20/60/100 fallback!
  const triageEval = {
    score: exactLlmScore,
    verdict: 'RESOLVED',
    rootCauseAccuracy: 95
  };

  db.prepare(`
    INSERT INTO triage_submissions (
      id, incident_id, user_id, rca_hypothesis, prevention_plan, evaluation_json, score, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(
    `triage_${Date.now()}`,
    incidentId,
    userId,
    triageHypothesis,
    triagePrevention,
    JSON.stringify(triageEval),
    exactLlmScore
  );

  // Fetch back
  const triageRow = db.prepare(`
    SELECT score, rca_hypothesis, prevention_plan, evaluation_json
    FROM triage_submissions
    WHERE incident_id = ? AND user_id = ?
    ORDER BY created_at DESC LIMIT 1
  `).get(incidentId, userId);

  console.log('\n✅ Incident Triage Saved & Restored:');
  console.log(`  - Preserved exact score: ${triageRow.score}%`);
  console.log(`  - Hypothesis: "${triageRow.rca_hypothesis.slice(0, 30)}..."`);
  console.log(`  - Prevention: "${triageRow.prevention_plan.slice(0, 30)}..."`);

  if (triageRow.score !== 87) {
    throw new Error(`Expected score 87, but got ${triageRow.score}`);
  }

  console.log('\n🎉 ALL PERSISTENCE ROUND-TRIP VERIFICATIONS PASSED!');
}

testSubmissionsDtoRoundtrip().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
