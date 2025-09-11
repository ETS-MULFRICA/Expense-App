import { pool } from './db';
import session from 'express-session';
import { IStorage } from './storage';
import { 
  User, InsertUser, ExpenseCategory, InsertExpenseCategory, Expense, InsertExpense, 
  ExpenseSubcategory, InsertExpenseSubcategory, IncomeCategory, InsertIncomeCategory, 
  IncomeSubcategory, InsertIncomeSubcategory, Income, InsertIncome, Budget, InsertBudget, 
  BudgetAllocation, InsertBudgetAllocation
} from '@shared/schema';

export class PostgresStorage implements IStorage {
  sessionStore: session.Store;

  constructor(sessionStore: session.Store) {
    this.sessionStore = sessionStore;
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    return result.rows[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await pool.query(
      'INSERT INTO users (username, password, name, email) VALUES ($1, $2, $3, $4) RETURNING *',
      [user.username, user.password, user.name, user.email]
    );
    return result.rows[0];
  }

    // Legacy expense methods (for backward compatibility)
    async createLegacyExpense(data: any) {
      // For now, treat as normal expense creation
      return this.createExpense(data);
    }

    async updateLegacyExpense(id: number, data: any) {
      // For now, treat as normal expense update
      return this.updateExpense(id, data);
    }

    // Analytics/reporting methods
    async getMonthlyExpenseTotals(userId: number, year: number) {
      const result = await pool.query(
        `SELECT EXTRACT(MONTH FROM date) AS month, SUM(amount) AS total
         FROM expenses WHERE user_id = $1 AND EXTRACT(YEAR FROM date) = $2
         GROUP BY month ORDER BY month`,
        [userId, year]
      );
      return result.rows;
    }

    async getCategoryExpenseTotals(userId: number, start: Date, end: Date) {
      const result = await pool.query(
        `SELECT category_id, SUM(amount) AS total
         FROM expenses WHERE user_id = $1 AND date >= $2 AND date <= $3
         GROUP BY category_id`,
        [userId, start, end]
      );
      return result.rows;
    }

    async getMonthlyIncomeTotals(userId: number, year: number) {
      const result = await pool.query(
        `SELECT EXTRACT(MONTH FROM date) AS month, SUM(amount) AS total
         FROM incomes WHERE user_id = $1 AND EXTRACT(YEAR FROM date) = $2
         GROUP BY month ORDER BY month`,
        [userId, year]
      );
      return result.rows;
    }

    async getCategoryIncomeTotals(userId: number, start: Date, end: Date) {
      const result = await pool.query(
        `SELECT category_id, SUM(amount) AS total
         FROM incomes WHERE user_id = $1 AND date >= $2 AND date <= $3
         GROUP BY category_id`,
        [userId, start, end]
      );
      return result.rows;
    }

    async getBudgetPerformance(budgetId: number) {
      // Return object with allocated, spent, remaining, categories
      // Example stub: you should implement real logic here
      return {
        allocated: 0,
        spent: 0,
        remaining: 0,
        categories: []
      };
    }

    // Admin methods
    async getAllExpenses() {
      const result = await pool.query('SELECT * FROM expenses');
      return result.rows;
    }

    async getAllIncomes() {
      const result = await pool.query('SELECT * FROM incomes');
      return result.rows;
    }
  async getAllUsers(): Promise<User[]> {
    const result = await pool.query('SELECT * FROM users');
    return result.rows;
  }

  async getUserRole(userId: number): Promise<string> {
    const result = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
    return result.rows[0]?.role || 'user';
  }

  async setUserRole(userId: number, role: string): Promise<void> {
    await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, userId]);
  }

  async updateUserSettings(userId: number, settings: { currency?: string }): Promise<User> {
    const result = await pool.query(
      'UPDATE users SET currency = $1 WHERE id = $2 RETURNING *',
      [settings.currency, userId]
    );
    return result.rows[0];
  }

  // Expense Category operations
  async getExpenseCategories(userId: number): Promise<ExpenseCategory[]> {
    const result = await pool.query('SELECT * FROM expense_categories WHERE user_id = $1', [userId]);
    return result.rows;
  }

  async getExpenseCategoryById(id: number): Promise<any> {
    const result = await pool.query('SELECT * FROM expense_categories WHERE id = $1', [id]);
    return result.rows[0];
  }

  async createExpenseCategory(userId: number, category: InsertExpenseCategory): Promise<ExpenseCategory> {
    const result = await pool.query(
      'INSERT INTO expense_categories (user_id, name, description) VALUES ($1, $2, $3) RETURNING *',
      [userId, category.name, category.description]
    );
    return result.rows[0];
  }

  async updateExpenseCategory(id: number, category: InsertExpenseCategory): Promise<ExpenseCategory> {
    const result = await pool.query(
      'UPDATE expense_categories SET name = $1, description = $2 WHERE id = $3 RETURNING *',
      [category.name, category.description, id]
    );
    return result.rows[0];
  }

  async deleteExpenseCategory(id: number): Promise<void> {
    await pool.query('DELETE FROM expense_categories WHERE id = $1', [id]);
  }

  // Expense Subcategory operations
  async getExpenseSubcategories(categoryId: number): Promise<ExpenseSubcategory[]> {
    const result = await pool.query('SELECT * FROM expense_subcategories WHERE category_id = $1', [categoryId]);
    return result.rows;
  }

  async getExpenseSubcategoryById(id: number): Promise<ExpenseSubcategory | undefined> {
    const result = await pool.query('SELECT * FROM expense_subcategories WHERE id = $1', [id]);
    return result.rows[0];
  }

  async createExpenseSubcategory(userId: number, subcategory: InsertExpenseSubcategory): Promise<ExpenseSubcategory> {
    const result = await pool.query(
      'INSERT INTO expense_subcategories (user_id, category_id, name, description) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, subcategory.categoryId, subcategory.name, subcategory.description]
    );
    return result.rows[0];
  }

  async updateExpenseSubcategory(id: number, subcategory: InsertExpenseSubcategory): Promise<ExpenseSubcategory> {
    const result = await pool.query(
      'UPDATE expense_subcategories SET name = $1, description = $2 WHERE id = $3 RETURNING *',
      [subcategory.name, subcategory.description, id]
    );
    return result.rows[0];
  }

  async deleteExpenseSubcategory(id: number): Promise<void> {
    await pool.query('DELETE FROM expense_subcategories WHERE id = $1', [id]);
  }

  // Income Category operations
  async getIncomeCategories(userId: number): Promise<IncomeCategory[]> {
    const result = await pool.query('SELECT * FROM income_categories WHERE user_id = $1', [userId]);
    return result.rows;
  }

  async getIncomeCategoryById(id: number): Promise<IncomeCategory | undefined> {
    const result = await pool.query('SELECT * FROM income_categories WHERE id = $1', [id]);
    return result.rows[0];
  }

  async createIncomeCategory(userId: number, category: InsertIncomeCategory): Promise<IncomeCategory> {
    const result = await pool.query(
      'INSERT INTO income_categories (user_id, name, description) VALUES ($1, $2, $3) RETURNING *',
      [userId, category.name, category.description]
    );
    return result.rows[0];
  }

  async updateIncomeCategory(id: number, category: InsertIncomeCategory): Promise<IncomeCategory> {
    const result = await pool.query(
      'UPDATE income_categories SET name = $1, description = $2 WHERE id = $3 RETURNING *',
      [category.name, category.description, id]
    );
    return result.rows[0];
  }

  async deleteIncomeCategory(id: number): Promise<void> {
    await pool.query('DELETE FROM income_categories WHERE id = $1', [id]);
  }

  // Income Subcategory operations
  async getIncomeSubcategories(categoryId: number): Promise<IncomeSubcategory[]> {
    const result = await pool.query('SELECT * FROM income_subcategories WHERE category_id = $1', [categoryId]);
    return result.rows;
  }

  async getIncomeSubcategoryById(id: number): Promise<IncomeSubcategory | undefined> {
    const result = await pool.query('SELECT * FROM income_subcategories WHERE id = $1', [id]);
    return result.rows[0];
  }

  async createIncomeSubcategory(userId: number, subcategory: InsertIncomeSubcategory): Promise<IncomeSubcategory> {
    const result = await pool.query(
      'INSERT INTO income_subcategories (user_id, category_id, name, description) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, subcategory.categoryId, subcategory.name, subcategory.description]
    );
    return result.rows[0];
  }

  async updateIncomeSubcategory(id: number, subcategory: InsertIncomeSubcategory): Promise<IncomeSubcategory> {
    const result = await pool.query(
      'UPDATE income_subcategories SET name = $1, description = $2 WHERE id = $3 RETURNING *',
      [subcategory.name, subcategory.description, id]
    );
    return result.rows[0];
  }

  async deleteIncomeSubcategory(id: number): Promise<void> {
    await pool.query('DELETE FROM income_subcategories WHERE id = $1', [id]);
  }

  // Expense operations
  async getExpensesByUserId(userId: number): Promise<Expense[]> {
    // Join with expense_categories to get category name
    const result = await pool.query(`
      SELECT e.*, c.name AS category_name
      FROM expenses e
      LEFT JOIN expense_categories c ON e.category_id = c.id
      WHERE e.user_id = $1
    `, [userId]);
    return result.rows;
  }

  async getExpenseById(id: number): Promise<any> {
    const result = await pool.query('SELECT * FROM expenses WHERE id = $1', [id]);
    return result.rows[0];
  }

  async createExpense(expense: InsertExpense & { userId: number }): Promise<Expense> {
    // Get category name
    let categoryName = null;
    if (expense.categoryId) {
      const catRes = await pool.query('SELECT name FROM expense_categories WHERE id = $1', [expense.categoryId]);
      categoryName = catRes.rows[0]?.name || null;
    }
    const result = await pool.query(
      'INSERT INTO expenses (user_id, amount, description, date, category_id, category_name, subcategory_id, merchant, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [expense.userId, expense.amount, expense.description, expense.date, expense.categoryId, categoryName, expense.subcategoryId, expense.merchant, expense.notes]
    );
    return result.rows[0];
  }

  async updateExpense(id: number, expense: InsertExpense & { userId: number }): Promise<Expense> {
    // Get category name
    let categoryName = null;
    if (expense.categoryId) {
      const catRes = await pool.query('SELECT name FROM expense_categories WHERE id = $1', [expense.categoryId]);
      categoryName = catRes.rows[0]?.name || null;
    }
    const result = await pool.query(
      'UPDATE expenses SET amount = $1, description = $2, date = $3, category_id = $4, category_name = $5, subcategory_id = $6, merchant = $7, notes = $8 WHERE id = $9 RETURNING *',
      [expense.amount, expense.description, expense.date, expense.categoryId, categoryName, expense.subcategoryId, expense.merchant, expense.notes, id]
    );
    return result.rows[0];
  }

  async deleteExpense(id: number): Promise<void> {
    await pool.query('DELETE FROM expenses WHERE id = $1', [id]);
  }

  // Income operations
  async getIncomesByUserId(userId: number): Promise<Income[]> {
    const result = await pool.query('SELECT * FROM incomes WHERE user_id = $1', [userId]);
    return result.rows;
  }

  async getIncomeById(id: number): Promise<Income | undefined> {
    const result = await pool.query('SELECT * FROM incomes WHERE id = $1', [id]);
    return result.rows[0];
  }

  async createIncome(income: InsertIncome & { userId: number }): Promise<Income> {
    const result = await pool.query(
      'INSERT INTO incomes (user_id, amount, description, date, category_id, subcategory_id, source, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [income.userId, income.amount, income.description, income.date, income.categoryId, income.subcategoryId, income.source, income.notes]
    );
    return result.rows[0];
  }

  async updateIncome(id: number, income: InsertIncome & { userId: number }): Promise<Income> {
    const result = await pool.query(
      'UPDATE incomes SET amount = $1, description = $2, date = $3, category_id = $4, subcategory_id = $5, source = $6, notes = $7 WHERE id = $8 RETURNING *',
      [income.amount, income.description, income.date, income.categoryId, income.subcategoryId, income.source, income.notes, id]
    );
    return result.rows[0];
  }

  async deleteIncome(id: number): Promise<void> {
    await pool.query('DELETE FROM incomes WHERE id = $1', [id]);
  }

  // Budget operations
  async getBudgetsByUserId(userId: number): Promise<Budget[]> {
    const result = await pool.query('SELECT * FROM budgets WHERE user_id = $1', [userId]);
    return result.rows;
  }

  async getBudgetById(id: number): Promise<Budget | undefined> {
    const result = await pool.query('SELECT * FROM budgets WHERE id = $1', [id]);
    return result.rows[0];
  }

  async createBudget(budget: InsertBudget & { userId: number }): Promise<Budget> {
    const result = await pool.query(
      'INSERT INTO budgets (user_id, name, start_date, end_date, amount, period, notes) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [budget.userId, budget.name, budget.startDate, budget.endDate, budget.amount, budget.period, budget.notes]
    );
    return result.rows[0];
  }

  async updateBudget(id: number, budget: InsertBudget): Promise<Budget> {
    const result = await pool.query(
      'UPDATE budgets SET name = $1, start_date = $2, end_date = $3, amount = $4, period = $5, notes = $6 WHERE id = $7 RETURNING *',
      [budget.name, budget.startDate, budget.endDate, budget.amount, budget.period, budget.notes, id]
    );
    return result.rows[0];
  }

  async deleteBudget(id: number): Promise<void> {
    await pool.query('DELETE FROM budgets WHERE id = $1', [id]);
  }

  // Budget Allocation operations
  async getBudgetAllocations(budgetId: number): Promise<BudgetAllocation[]> {
    const result = await pool.query('SELECT * FROM budget_allocations WHERE budget_id = $1', [budgetId]);
    return result.rows;
  }

  async createBudgetAllocation(allocation: InsertBudgetAllocation): Promise<BudgetAllocation> {
    const result = await pool.query(
      'INSERT INTO budget_allocations (budget_id, category_id, subcategory_id, amount) VALUES ($1, $2, $3, $4) RETURNING *',
      [allocation.budgetId, allocation.categoryId, allocation.subcategoryId, allocation.amount]
    );
    return result.rows[0];
  }

  async updateBudgetAllocation(id: number, allocation: InsertBudgetAllocation): Promise<BudgetAllocation> {
    const result = await pool.query(
      'UPDATE budget_allocations SET budget_id = $1, category_id = $2, subcategory_id = $3, amount = $4 WHERE id = $5 RETURNING *',
      [allocation.budgetId, allocation.categoryId, allocation.subcategoryId, allocation.amount, id]
    );
    return result.rows[0];
  }

  async deleteBudgetAllocation(id: number): Promise<void> {
    await pool.query('DELETE FROM budget_allocations WHERE id = $1', [id]);
  }

  // Reports and analytics methods can be implemented similarly using SQL queries
}
