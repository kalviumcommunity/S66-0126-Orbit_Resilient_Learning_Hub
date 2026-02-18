import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

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

  const student = await prisma.user.upsert({
    where: { email: "student@orbit.edu" },
    update: {},
    create: {
      email: "student@orbit.edu",
      name: "Aryan Anand",
      password: "hashed_password_placeholder",
    },
  });

  const lessons = [
    {
      title: "Introduction to Offline Web Apps",
      slug: "intro-to-offline-apps",
      content:
        "In this lesson, you will learn how PWAs work without internet...",
      order: 1,
    },
    {
      title: "Mastering Database Migrations",
      slug: "mastering-migrations",
      content:
        "Learn how Prisma keeps your database in sync across the team...",
      order: 2,
    },
  ];

  for (const lesson of lessons) {
    await prisma.lesson.upsert({
      where: { slug: lesson.slug },
      update: {},
      create: lesson,
    });
  }

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
