import { seed } from './src/db/seed.js';

async function main() {
  console.log("Starting seed process...");
  try {
    await seed();
    console.log("Seed process completed successfully!");
  } catch (error) {
    console.error("Seed failed:", error);
  }
}

main();
