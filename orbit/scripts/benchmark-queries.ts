import { config } from "dotenv";

// Load environment variables
config({ path: ".env.local" });

const BASE_URL = "http://localhost:3000";

interface BenchmarkResult {
  name: string;
  duration: number;
  success: boolean;
  error?: string;
}

async function benchmark(
  name: string,
  fn: () => Promise<Response>
): Promise<BenchmarkResult> {
  const start = performance.now();
  try {
    const response = await fn();
    const end = performance.now();
    return {
      name,
      duration: Math.round(end - start),
      success: response.ok,
      error: response.ok ? undefined : await response.text(),
    };
  } catch (error) {
    const end = performance.now();
    return {
      name,
      duration: Math.round(end - start),
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runBenchmarks() {
  console.log("🚀 Starting Performance Benchmarks\n");
  console.log("⚠️  Make sure the dev server is running (npm run dev)\n");

  // Wait a moment to ensure server is ready
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const results: BenchmarkResult[] = [];

  // First, get the existing user ID
  console.log("📋 Step 1: Enrolling a test user...\n");
  const enrollResponse = await fetch(`${BASE_URL}/api/users/enroll`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Benchmark Test User",
      email: `benchmark-${Date.now()}@orbit.edu`,
      password: "test123",
    }),
  });

  if (!enrollResponse.ok) {
    console.error("❌ Failed to enroll user:", await enrollResponse.text());
    process.exit(1);
  }

  const { data: enrollData } = await enrollResponse.json();
  const userId = enrollData.user.id;
  console.log(`✅ User enrolled: ${userId}`);
  console.log(
    `   Progress initialized: ${enrollData.progressInitialized} lessons\n`
  );

  // Benchmark 1: Enrollment transaction
  console.log("📊 Benchmark 1: Student Enrollment Transaction\n");
  const enrollResult = await benchmark(
    "Enrollment Transaction",
    async () =>
      await fetch(`${BASE_URL}/api/users/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Benchmark User 2",
          email: `benchmark-2-${Date.now()}@orbit.edu`,
          password: "test456",
        }),
      })
  );
  results.push(enrollResult);
  console.log(
    `   ${enrollResult.success ? "✅" : "❌"} ${enrollResult.name}: ${enrollResult.duration}ms\n`
  );

  // Benchmark 2: Optimized Dashboard Query
  console.log("📊 Benchmark 2: Optimized Dashboard Query\n");
  const dashboardOptimized = await benchmark(
    "Dashboard (Optimized)",
    async () => await fetch(`${BASE_URL}/api/users/${userId}/dashboard`)
  );
  results.push(dashboardOptimized);
  console.log(
    `   ${dashboardOptimized.success ? "✅" : "❌"} ${dashboardOptimized.name}: ${dashboardOptimized.duration}ms\n`
  );

  // Benchmark 3: Unoptimized Dashboard Query
  console.log("📊 Benchmark 3: Unoptimized Dashboard Query (For Comparison)\n");
  const dashboardUnoptimized = await benchmark(
    "Dashboard (Unoptimized)",
    async () =>
      await fetch(`${BASE_URL}/api/users/${userId}/dashboard-unoptimized`)
  );
  results.push(dashboardUnoptimized);
  console.log(
    `   ${dashboardUnoptimized.success ? "✅" : "❌"} ${dashboardUnoptimized.name}: ${dashboardUnoptimized.duration}ms\n`
  );

  // Benchmark 4: Lessons List
  console.log("📊 Benchmark 4: Lessons List\n");
  const lessonsList = await benchmark(
    "Lessons List",
    async () => await fetch(`${BASE_URL}/api/lessons`)
  );
  results.push(lessonsList);
  console.log(
    `   ${lessonsList.success ? "✅" : "❌"} ${lessonsList.name}: ${lessonsList.duration}ms\n`
  );

  // Benchmark 5: Lessons with User Progress
  console.log("📊 Benchmark 5: Lessons with User Progress\n");
  const lessonsWithProgress = await benchmark(
    "Lessons with Progress",
    async () => await fetch(`${BASE_URL}/api/lessons?userId=${userId}`)
  );
  results.push(lessonsWithProgress);
  console.log(
    `   ${lessonsWithProgress.success ? "✅" : "❌"} ${lessonsWithProgress.name}: ${lessonsWithProgress.duration}ms\n`
  );

  // Calculate comparison
  const optimizedTime = dashboardOptimized.duration;
  const unoptimizedTime = dashboardUnoptimized.duration;
  const improvement =
    ((unoptimizedTime - optimizedTime) / unoptimizedTime) * 100;

  // Results summary
  console.log("═══════════════════════════════════════════════════════");
  console.log("                    BENCHMARK RESULTS                   ");
  console.log("═══════════════════════════════════════════════════════\n");

  results.forEach((result) => {
    const status = result.success ? "✅ PASS" : "❌ FAIL";
    console.log(`${status} ${result.name.padEnd(30)} ${result.duration}ms`);
  });

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("                 OPTIMIZATION ANALYSIS                  ");
  console.log("═══════════════════════════════════════════════════════\n");

  console.log(`Dashboard Query (Optimized):    ${optimizedTime}ms`);
  console.log(`Dashboard Query (Unoptimized):  ${unoptimizedTime}ms`);
  console.log(`\n🎯 Performance Improvement:      ${improvement.toFixed(1)}%`);
  console.log(
    `⚡ Speed Multiplier:              ${(unoptimizedTime / optimizedTime).toFixed(1)}x faster\n`
  );

  console.log("═══════════════════════════════════════════════════════");
  console.log("                   KEY TAKEAWAYS                        ");
  console.log("═══════════════════════════════════════════════════════\n");

  console.log("✅ Optimizations Applied:");
  console.log("   • Single query with nested select (no N+1)");
  console.log("   • Field selection (no over-fetching)");
  console.log("   • Index usage on userId and lesson.order");
  console.log("   • Client-side aggregation\n");

  console.log("❌ Anti-patterns Avoided:");
  console.log("   • Multiple separate queries (N+1 problem)");
  console.log("   • Over-fetching with include: true");
  console.log("   • Full table scans without indexes");
  console.log("   • Unnecessary data transfer\n");

  console.log("═══════════════════════════════════════════════════════\n");

  // Exit with success
  process.exit(0);
}

// Run benchmarks
runBenchmarks().catch((error) => {
  console.error("❌ Benchmark failed:", error);
  process.exit(1);
});
