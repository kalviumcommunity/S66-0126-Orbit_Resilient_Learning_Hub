import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { config } from "dotenv";

// Load environment variables
config({ path: ".env.local" });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  console.log("🌱 Starting seeding...");

  await prisma.user.upsert({
    where: { email: "student@orbit.edu" },
    update: {},
    create: {
      email: "student@orbit.edu",
      name: "Aryan Anand",
      password: "hashed_password_placeholder",
    },
  });

  // Expanded lesson dataset for better performance testing
  const lessons = [
    {
      title: "Introduction to Offline Web Apps",
      slug: "intro-to-offline-apps",
      content:
        "In this lesson, you will learn how PWAs work without internet. We'll cover service workers, cache strategies, and background sync.",
      order: 1,
    },
    {
      title: "Mastering Database Migrations",
      slug: "mastering-migrations",
      content:
        "Learn how Prisma keeps your database in sync across the team. Understand migration files, rollback strategies, and production deployment.",
      order: 2,
    },
    {
      title: "Building Resilient APIs",
      slug: "building-resilient-apis",
      content:
        "Design APIs that handle failures gracefully. Learn about retry logic, circuit breakers, and error handling patterns.",
      order: 3,
    },
    {
      title: "Understanding Database Indexes",
      slug: "understanding-database-indexes",
      content:
        "Master the art of database optimization with indexes. Learn when to add indexes, composite indexes, and how to analyze query performance.",
      order: 4,
    },
    {
      title: "Transaction Management in PostgreSQL",
      slug: "transaction-management",
      content:
        "Explore ACID properties, isolation levels, and transaction patterns. Learn how to prevent race conditions and ensure data integrity.",
      order: 5,
    },
    {
      title: "Progressive Web App Fundamentals",
      slug: "pwa-fundamentals",
      content:
        "Build web applications that work offline and feel native. Learn about manifest files, app icons, and installation prompts.",
      order: 6,
    },
    {
      title: "Advanced Prisma Queries",
      slug: "advanced-prisma-queries",
      content:
        "Level up your Prisma skills with complex queries, aggregations, and raw SQL. Optimize your data fetching patterns.",
      order: 7,
    },
    {
      title: "Authentication and Authorization",
      slug: "authentication-authorization",
      content:
        "Implement secure authentication flows with JWT, sessions, and OAuth. Learn best practices for password hashing and token management.",
      order: 8,
    },
    {
      title: "Caching Strategies with Redis",
      slug: "caching-strategies-redis",
      content:
        "Improve application performance with Redis caching. Learn cache invalidation strategies, TTL management, and cache warming.",
      order: 9,
    },
    {
      title: "Deployment and DevOps Basics",
      slug: "deployment-devops-basics",
      content:
        "Deploy your application to production with confidence. Learn about Docker, CI/CD pipelines, environment variables, and monitoring.",
      order: 10,
    },
  ];

  // OPTIMIZATION: Batch insert with skipDuplicates instead of individual upserts
  console.log("📚 Inserting lessons...");

  // Delete old lessons that are no longer in the dataset
  const existingSlugs = lessons.map((l) => l.slug);
  await prisma.lesson.deleteMany({
    where: {
      slug: {
        notIn: existingSlugs,
      },
    },
  });

  // Upsert all lessons (createMany doesn't support upsert, so we still use individual upserts)
  // But we do it in a transaction for atomicity
  await prisma.$transaction(
    lessons.map((lesson) =>
      prisma.lesson.upsert({
        where: { slug: lesson.slug },
        update: {
          title: lesson.title,
          content: lesson.content,
          order: lesson.order,
        },
        create: lesson,
      })
    )
  );

  console.log(`✅ Seeded ${lessons.length} lessons and 1 user.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
