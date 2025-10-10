import { storage } from './api/storage.js';

async function run() {
  try {
    console.log('Fetching categories for userId 1');
    const a = await storage.getIncomeCategories(1);
    console.log('User 1 categories:', a.map(c => c.name));

    console.log('Fetching categories for userId 2');
    const b = await storage.getIncomeCategories(2);
    console.log('User 2 categories:', b.map(c => c.name));
  } catch (err) {
    console.error('Error calling storage.getIncomeCategories', err);
  }
}

run();
