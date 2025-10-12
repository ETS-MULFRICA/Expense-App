// src/storage/PostgresStorage.ts
import { pool } from './db';
import session from 'express-session';
import { 
  User, InsertUser, ExpenseCategory, InsertExpenseCategory, Expense, InsertExpense, 
  ExpenseSubcategory, InsertExpenseSubcategory, IncomeCategory, InsertIncomeCategory, 
  IncomeSubcategory, InsertIncomeSubcategory, Income, InsertIncome, Budget, InsertBudget,
  BudgetAllocation, InsertBudgetAllocation
} from '@shared/schema';

export class PostgresStorage {
  sessionStore: session.Store;

  constructor(sessionStore: session.Store) {
    this.sessionStore = sessionStore;
  }

  // ======================
  // Default Categories
  // ======================
  async createDefaultCategories(userId: number): Promise<void> {
    const expenseCategories: Record<string, string[]> = {
      "Children": ["Activities", "Allowance", "Medical", "Childcare", "Clothing", "School", "Toys"],
      "Debt": ["Credit cards", "Student loans", "Other loans", "Taxes (federal)", "Taxes (state)", "Other"],
      "Education": ["Tuition", "Books", "Music lessons", "Other"],
      "Entertainment": ["Books", "Concerts/shows", "Games", "Hobbies", "Movies", "Music", "Outdoor activities", "Photography", "Sports", "Theater/plays", "TV", "Other"],
      "Everyday": ["Groceries", "Restaurants", "Personal supplies", "Clothes", "Laundry/dry cleaning", "Hair/beauty", "Subscriptions", "Other"],
      "Gifts": ["Gifts", "Donations (charity)", "Other"],
      "Health/medical": ["Doctors/dental/vision", "Specialty care", "Pharmacy", "Emergency", "Other"],
      "Home": ["Rent/mortgage", "Property taxes", "Furnishings", "Lawn/garden", "Supplies", "Maintenance", "Improvements", "Moving", "Other"],
      "Insurance": ["Car", "Health", "Home", "Life", "Other"],
      "Pets": ["Food", "Vet/medical", "Toys", "Supplies", "Other"],
      "Technology": ["Domains & hosting", "Online services", "Hardware", "Software", "Other"],
      "Transportation": ["Fuel", "Car payments", "Repairs", "Registration/license", "Supplies", "Public transit", "Other"],
      "Travel": ["Airfare", "Hotels", "Food", "Transportation", "Entertainment", "Other"],
      "Utilities": ["Phone", "TV", "Internet", "Electricity", "Heat/gas", "Water", "Trash", "Other"]
    };

    const incomeCategories: Record<string, string[]> = {
      "Wages": ["Paycheck", "Tips", "Bonus", "Commission", "Other"],
      "Other": ["Transfer from savings", "Interest income", "Dividends", "Gifts", "Refunds", "Other"]
    };

    // Insert expense categories and subcategories
    for (const [catName, subcats] of Object.entries(expenseCategories)) {
      const catRes = await pool.query(
        'INSERT INTO expense_categories (user_id, name, description, is_system) VALUES ($1, $2, $3, $4) RETURNING id',
        [userId, catName, `${catName} expenses`, true]
      );
      const categoryId = catRes.rows[0].id;
      for (const subcatName of subcats) {
        await pool.query(
          'INSERT INTO expense_subcategories (category_id, user_id, name, description) VALUES ($1, $2, $3, $4)',
          [categoryId, userId, subcatName, `${subcatName} in ${catName}`]
        );
      }
    }

    // Insert income categories and subcategories
    for (const [catName, subcats] of Object.entries(incomeCategories)) {
      const catRes = await pool.query(
        'INSERT INTO income_categories (user_id, name, description, is_system) VALUES ($1, $2, $3, $4) RETURNING id',
        [userId, catName, `${catName} income`, true]
      );
      const categoryId = catRes.rows[0].id;
      console.log('Created income category:', catName, 'for user', userId, 'with id', categoryId);
      for (const subcatName of subcats) {
        await pool.query(
          'INSERT INTO income_subcategories (category_id, user_id, name, description) VALUES ($1, $2, $3, $4)',
          [categoryId, userId, subcatName, `${subcatName} in ${catName}`]
        );
      }
    }

    // Debug print
    const allCats = await pool.query('SELECT * FROM income_categories WHERE user_id = $1', [userId]);
    console.log('All income categories for user', userId, allCats.rows);
  }

  // ======================
  // User operations
  // ======================
  async getUser(id: number): Promise<User | undefined> {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    return result.rows[0];
  }

  async getUserByUsernameOrEmail(username: string, email: string): Promise<User | undefined> {
    const result = await pool.query('SELECT * FROM users WHERE username = $1 OR email = $2', [username, email]);
    return result.rows[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await pool.query(
      'INSERT INTO users (username, password, name, email) VALUES ($1, $2, $3, $4) RETURNING *',
      [user.username, user.password, user.name, user.email]
    );
    return result.rows[0];
  }

  async getAllUsers(): Promise<User[]> {
    const result = await pool.query('SELECT * FROM users');
    return result.rows;
  }

  async getUserRole(userId: number): Promise<string> {
    const result = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
    return result.rows[0]?.role || 'user';
  }


  async updateUserSettings(userId: number, settings: { currency?: string }): Promise<User> {
    const result = await pool.query(
      'UPDATE users SET currency = $1 WHERE id = $2 RETURNING *',
      [settings.currency, userId]
    );
    return result.rows[0];
  }

  async updateUser(userId: number, updates: { name?: string; email?: string; role?: string; status?: string }): Promise<User> {
    const setClause: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (updates.name !== undefined) {
      setClause.push(`name = $${paramCount}`);
      values.push(updates.name);
      paramCount++;
    }
    if (updates.email !== undefined) {
      setClause.push(`email = $${paramCount}`);
      values.push(updates.email);
      paramCount++;
    }
    if (updates.role !== undefined) {
      setClause.push(`role = $${paramCount}`);
      values.push(updates.role);
      paramCount++;
    }
    if (updates.status !== undefined) {
      setClause.push(`status = $${paramCount}`);
      values.push(updates.status);
      paramCount++;
    }

    values.push(userId);

    const result = await pool.query(
      `UPDATE users SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramCount} RETURNING *`,
      values
    );
    return result.rows[0];
  }

  async suspendUser(userId: number): Promise<void> {
    await pool.query('UPDATE users SET status = $1 WHERE id = $2', ['suspended', userId]);
  }

  async reactivateUser(userId: number): Promise<void> {
    await pool.query('UPDATE users SET status = $1 WHERE id = $2', ['active', userId]);
  }

  async deleteUser(userId: number): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Delete user's expense categories (not system categories)
      await client.query('DELETE FROM expense_categories WHERE user_id = $1 AND is_system = false', [userId]);

      // Delete user's income categories
      await client.query('DELETE FROM income_categories WHERE user_id = $1', [userId]);

      // Delete user's hidden categories
      await client.query('DELETE FROM user_hidden_categories WHERE user_id = $1', [userId]);

      // Delete user's expenses
      await client.query('DELETE FROM expenses WHERE user_id = $1', [userId]);

      // Delete user's incomes
      await client.query('DELETE FROM incomes WHERE user_id = $1', [userId]);

      // Delete user's budgets
      await client.query('DELETE FROM budgets WHERE user_id = $1', [userId]);

      // Delete user's budget allocations
      await client.query('DELETE FROM budget_allocations WHERE budget_id IN (SELECT id FROM budgets WHERE user_id = $1)', [userId]);

      // Delete activity logs for this user
      await client.query('DELETE FROM activity_log WHERE user_id = $1', [userId]);

      // Finally delete the user
      await client.query('DELETE FROM users WHERE id = $1', [userId]);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Soft-delete a user by marking their status as 'deleted' (preserve data)
  async softDeleteUser(userId: number): Promise<void> {
    await pool.query(
      "UPDATE users SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [userId]
    );
  }

  async resetUserPassword(userId: number, newPassword: string): Promise<void> {
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [newPassword, userId]);
  }

  async searchUsers(query: string, filters: { role?: string; status?: string } = {}): Promise<User[]> {
    let sql = `
      SELECT id, username, name, email, role, created_at 
      FROM users 
      WHERE (username ILIKE $1 OR name ILIKE $1 OR email ILIKE $1)
    `;
    const params: any[] = [`%${query}%`];
    let paramCount = 2;

    if (filters.role) {
      sql += ` AND role = $${paramCount}`;
      params.push(filters.role);
      paramCount++;
    }

    // Apply status filter when provided
    if (filters.status) {
      sql += ` AND status = $${paramCount}`;
      params.push(filters.status);
      paramCount++;
    }

    sql += ' ORDER BY created_at DESC';

    const result = await pool.query(sql, params);
    // Add default status for compatibility
    return result.rows.map(user => ({ ...user, status: 'active' }));
  }

  async getUserStats(): Promise<{ totalUsers: number; activeUsers: number; suspendedUsers: number; adminUsers: number }> {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(*) as active_users,
        0 as suspended_users,
        COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_users
      FROM users
    `);

    const stats = result.rows[0];
    return {
      totalUsers: parseInt(stats.total_users),
      activeUsers: parseInt(stats.active_users),
      suspendedUsers: parseInt(stats.suspended_users),
      adminUsers: parseInt(stats.admin_users)
    };
  }

  // ======================
  // Expense Category operations
  // ======================
  async getExpenseCategories(userId: number): Promise<ExpenseCategory[]> {
    const result = await pool.query(`
      SELECT 
        ec.id,
        ec.user_id as "userId",
        ec.name,
        ec.description,
        ec.is_system as "isSystem",
        ec.created_at as "createdAt"
      FROM expense_categories ec
      LEFT JOIN user_hidden_categories uhc ON (
        uhc.user_id = $1 
        AND uhc.category_id = ec.id 
      )
      WHERE ((ec.is_system = true) OR (ec.user_id = $1 AND ec.is_system = false))
        AND uhc.id IS NULL
      ORDER BY ec.is_system DESC, ec.name ASC
    `, [userId]);

    return result.rows;
  }

  async getExpenseCategoryById(id: number): Promise<any> {
    const result = await pool.query(`
      SELECT 
        id,
        user_id as "userId",
        name,
        description,
        is_system as "isSystem",
        created_at as "createdAt"
      FROM expense_categories 
      WHERE id = $1
    `, [id]);

    return result.rows[0] || null;
  }

  async createExpenseCategory(userId: number, category: InsertExpenseCategory): Promise<ExpenseCategory> {
    // Set the sequence to start from 16 if this is the first user category
    await pool.query(`
      SELECT setval('expense_categories_id_seq', 
        GREATEST(16, (SELECT COALESCE(MAX(id), 15) FROM expense_categories) + 1), 
        false)
    `);

    const result = await pool.query(
      'INSERT INTO expense_categories (user_id, name, description, is_system) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, category.name, category.description, false]
    );
    return {
      ...result.rows[0],
      userId: result.rows[0].user_id,
      isSystem: result.rows[0].is_system,
      createdAt: result.rows[0].created_at
    };
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

  async deleteUserExpenseCategory(id: number): Promise<void> {
    const expenseCheck = await pool.query(
      'SELECT COUNT(*) as count FROM expenses WHERE category_id = $1',
      [id]
    );

    const expenseCount = parseInt(expenseCheck.rows[0].count);
    if (expenseCount > 0) {
      throw new Error(`Cannot delete category. It is being used by ${expenseCount} expense(s). Please update or delete those expenses first.`);
    }

    const budgetCheck = await pool.query(
      'SELECT COUNT(*) as count FROM budget_allocations WHERE category_id = $1',
      [id]
    );

    const budgetCount = parseInt(budgetCheck.rows[0].count);
    if (budgetCount > 0) {
      throw new Error(`Cannot delete category. It is being used by ${budgetCount} budget allocation(s). Please remove those allocations first.`);
    }

    await pool.query('DELETE FROM expense_categories WHERE id = $1 AND is_system = false', [id]);
  }

  // Hidden Category operations
  async hideSystemCategory(userId: number, categoryId: number, categoryType: 'expense' | 'budget'): Promise<void> {
    const category = await this.getExpenseCategoryById(categoryId);
    if (!category || !category.isSystem) {
      throw new Error('Only system categories can be hidden');
    }

    const isInUse = await this.isCategoryInUse(userId, categoryId, categoryType);
    if (isInUse.inUse) {
      throw new Error(`Cannot hide this category because it is currently in use. ${isInUse.details}`);
    }

    await pool.query(`
      INSERT INTO user_hidden_categories (user_id, category_id, category_type)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, category_id, category_type) DO NOTHING
    `, [userId, categoryId, categoryType]);
  }

  async isCategoryInUse(userId: number, categoryId: number, categoryType: 'expense' | 'budget'): Promise<{inUse: boolean, details: string}> {
    let details = '';

    const expenseCount = await pool.query(
      'SELECT COUNT(*) as count FROM expenses WHERE user_id = $1 AND category_id = $2',
      [userId, categoryId]
    );
    const expenseCountNum = parseInt(expenseCount.rows[0].count);

    const budgetAllocationCount = await pool.query(`
      SELECT COUNT(*) as count 
      FROM budget_allocations ba 
      JOIN budgets b ON ba.budget_id = b.id 
      WHERE b.user_id = $1 AND ba.category_id = $2
    `, [userId, categoryId]);
    const budgetCountNum = parseInt(budgetAllocationCount.rows[0].count);

    const inUse = expenseCountNum > 0 || budgetCountNum > 0;

    if (inUse) {
      const usageDetails = [];
      if (expenseCountNum > 0) {
        usageDetails.push(`${expenseCountNum} expense${expenseCountNum === 1 ? '' : 's'}`);
      }
      if (budgetCountNum > 0) {
        usageDetails.push(`${budgetCountNum} budget allocation${budgetCountNum === 1 ? '' : 's'}`);
      }
      details = `Found in ${usageDetails.join(' and ')}.`;
    }

    return { inUse, details };
  }

  async unhideSystemCategory(userId: number, categoryId: number, categoryType: 'expense' | 'budget'): Promise<void> {
    await pool.query(`
      DELETE FROM user_hidden_categories 
      WHERE user_id = $1 AND category_id = $2 AND category_type = $3
    `, [userId, categoryId, categoryType]);
  }

  async getHiddenCategories(userId: number, categoryType?: 'expense' | 'budget'): Promise<any[]> {
    let query = `
      SELECT 
        uhc.id,
        uhc.user_id as "userId",
        uhc.category_id as "categoryId",
        uhc.category_type as "categoryType",
        uhc.hidden_at as "hiddenAt",
        ec.name as "categoryName"
      FROM user_hidden_categories uhc
      JOIN expense_categories ec ON uhc.category_id = ec.id
      WHERE uhc.user_id = $1
    `;

    const params: any[] = [userId];

    if (categoryType) {
      query += ' AND uhc.category_type = $2';
      params.push(categoryType);
    }

    query += ' ORDER BY uhc.hidden_at DESC';

    const result = await pool.query(query, params);
    return result.rows;
  }

  // ======================
  // Expense Subcategory operations
  // ======================
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

  // ======================
  // Income Category operations
  // ======================
  async getIncomeCategories(userId: number): Promise<IncomeCategory[]> {
    const result = await pool.query('SELECT * FROM income_categories WHERE user_id = $1', [userId]);
    return result.rows;
  }

  async getIncomeCategoryById(id: number): Promise<IncomeCategory | undefined> {
    const result = await pool.query('SELECT * FROM income_categories WHERE id = $1', [id]);
    const row = result.rows[0];
    if (!row) return undefined;
    return {
      id: row.id,
      name: row.name,
      userId: row.user_id,
      description: row.description,
      isSystem: row.is_system,
      createdAt: row.created_at
    };
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

  // ======================
  // Income Subcategory operations
  // ======================
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

  // ======================
  // Expense operations (unchanged logic)
  // ======================
  async getExpensesByUserId(userId: number): Promise<Expense[]> {
    const result = await pool.query(`
      SELECT 
        e.id,
        e.user_id as "userId",
        e.amount,
        e.description,
        e.date,
        e.category_id as "categoryId",
        e.subcategory_id as "subcategoryId", 
        e.budget_id as "budgetId",
        e.merchant,
        e.notes,
        e.created_at as "createdAt",
        c.name AS category_name
      FROM expenses e
      LEFT JOIN expense_categories c ON e.category_id = c.id
      WHERE e.user_id = $1
      ORDER BY e.created_at DESC
    `, [userId]);
    return result.rows;
  }

  async getExpenseById(id: number): Promise<any> {
    const result = await pool.query('SELECT * FROM expenses WHERE id = $1', [id]);
    return result.rows[0];
  }

  async createExpense(expense: InsertExpense & { userId: number }): Promise<Expense> {
    let categoryName = null;
    if (expense.categoryId) {
      const catRes = await pool.query('SELECT name FROM expense_categories WHERE id = $1', [expense.categoryId]);
      categoryName = catRes.rows[0]?.name || null;
    }
    const result = await pool.query(
      'INSERT INTO expenses (user_id, amount, description, date, category_id, category_name, subcategory_id, budget_id, merchant, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
      [expense.userId, expense.amount, expense.description, expense.date, expense.categoryId, categoryName, expense.subcategoryId, expense.budgetId || null, expense.merchant, expense.notes]
    );
    return result.rows[0];
  }

  async updateExpense(id: number, expense: InsertExpense & { userId: number }): Promise<Expense> {
    let categoryName = null;
    if (expense.categoryId) {
      const catRes = await pool.query('SELECT name FROM expense_categories WHERE id = $1', [expense.categoryId]);
      categoryName = catRes.rows[0]?.name || null;
    }
    const result = await pool.query(
      'UPDATE expenses SET amount = $1, description = $2, date = $3, category_id = $4, category_name = $5, subcategory_id = $6, budget_id = $7, merchant = $8, notes = $9 WHERE id = $10 RETURNING *',
      [expense.amount, expense.description, expense.date, expense.categoryId, categoryName, expense.subcategoryId, expense.budgetId || null, expense.merchant, expense.notes, id]
    );
    return result.rows[0];
  }

  async deleteExpense(id: number): Promise<void> {
    await pool.query('DELETE FROM expenses WHERE id = $1', [id]);
  }

  // ======================
  // Income operations (unchanged logic)
  // ======================
  async getIncomesByUserId(userId: number): Promise<Income[]> {
    const result = await pool.query('SELECT * FROM incomes WHERE user_id = $1', [userId]);
    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      amount: row.amount,
      description: row.description,
      date: row.date,
      categoryId: row.category_id,
      categoryName: row.category_name,
      subcategoryId: row.subcategory_id,
      source: row.source,
      notes: row.notes,
      createdAt: row.created_at
    }));
  }

  async getIncomeById(id: number): Promise<Income | undefined> {
    const result = await pool.query('SELECT * FROM incomes WHERE id = $1', [id]);
    const row = result.rows[0];
    if (!row) return undefined;
    return {
      id: row.id,
      userId: row.user_id,
      amount: row.amount,
      description: row.description,
      date: row.date,
      categoryId: row.category_id,
      categoryName: row.category_name,
      subcategoryId: row.subcategory_id,
      source: row.source,
      notes: row.notes,
      createdAt: row.created_at
    };
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
    const row = result.rows[0];
    if (!row) throw new Error('Income not found after update');
    return {
      id: row.id,
      userId: row.user_id,
      amount: row.amount,
      description: row.description,
      date: row.date,
      categoryId: row.category_id,
      categoryName: row.category_name,
      subcategoryId: row.subcategory_id,
      source: row.source,
      notes: row.notes,
      createdAt: row.created_at
    };
  }

  async deleteIncome(id: number): Promise<void> {
    await pool.query('DELETE FROM incomes WHERE id = $1', [id]);
  }

  // ======================
  // Budget operations (unchanged logic)
  // ======================
  async getBudgetsByUserId(userId: number): Promise<Budget[]> {
    const result = await pool.query('SELECT * FROM budgets WHERE user_id = $1', [userId]);
    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      period: row.period,
      startDate: row.start_date,
      endDate: row.end_date,
      amount: row.amount,
      notes: row.notes,
      createdAt: row.created_at,
    }));
  }

  async getBudgetById(id: number): Promise<Budget | undefined> {
    const result = await pool.query('SELECT * FROM budgets WHERE id = $1', [id]);
    const row = result.rows[0];
    if (!row) return undefined;
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      period: row.period,
      startDate: row.start_date,
      endDate: row.end_date,
      amount: row.amount,
      notes: row.notes,
      createdAt: row.created_at,
    };
  }

  async createBudget(budget: InsertBudget & { userId: number }): Promise<Budget> {
    const result = await pool.query(
      'INSERT INTO budgets (user_id, name, start_date, end_date, amount, period, notes) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [budget.userId, budget.name, budget.startDate, budget.endDate, budget.amount, budget.period, budget.notes]
    );
    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      period: row.period,
      startDate: row.start_date,
      endDate: row.end_date,
      amount: row.amount,
      notes: row.notes,
      createdAt: row.created_at,
    };
  }

  async updateBudget(id: number, budget: InsertBudget): Promise<Budget> {
    const result = await pool.query(
      'UPDATE budgets SET name = $1, start_date = $2, end_date = $3, amount = $4, period = $5, notes = $6 WHERE id = $7 RETURNING *',
      [budget.name, budget.startDate, budget.endDate, budget.amount, budget.period, budget.notes, id]
    );
    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      period: row.period,
      startDate: row.start_date,
      endDate: row.end_date,
      amount: row.amount,
      notes: row.notes,
      createdAt: row.created_at,
    };
  }

  async deleteBudget(id: number): Promise<void> {
    await pool.query('DELETE FROM budgets WHERE id = $1', [id]);
  }

  // ======================
  // Budget Allocation operations (unchanged logic)
  // ======================
  async getBudgetAllocations(budgetId: number): Promise<(BudgetAllocation & { categoryName?: string })[]> {
    const result = await pool.query(`
      SELECT 
        ba.id,
        ba.budget_id as "budgetId",
        ba.category_id as "categoryId", 
        ba.subcategory_id as "subcategoryId",
        ba.amount,
        ba.created_at as "createdAt",
        ec.name as "categoryName"
      FROM budget_allocations ba
      LEFT JOIN expense_categories ec ON ba.category_id = ec.id
      WHERE ba.budget_id = $1
      ORDER BY ba.created_at DESC
    `, [budgetId]);
    console.log('DEBUG: getBudgetAllocations raw result:', result.rows);
    return result.rows;
  }

  async createBudgetAllocation(allocation: InsertBudgetAllocation): Promise<BudgetAllocation> {
    const result = await pool.query(`
      INSERT INTO budget_allocations (budget_id, category_id, subcategory_id, amount) 
      VALUES ($1, $2, $3, $4) 
      RETURNING 
        id,
        budget_id as "budgetId",
        category_id as "categoryId", 
        subcategory_id as "subcategoryId",
        amount,
        created_at as "createdAt"
    `, [allocation.budgetId, allocation.categoryId, allocation.subcategoryId, allocation.amount]);

    const categoryResult = await pool.query('SELECT name FROM expense_categories WHERE id = $1', [allocation.categoryId]);
    const categoryName = categoryResult.rows[0]?.name || 'Unknown';

    return {
      ...result.rows[0],
      categoryName
    };
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

  async deleteBudgetAllocations(budgetId: number): Promise<void> {
    await pool.query('DELETE FROM budget_allocations WHERE budget_id = $1', [budgetId]);
  }

  // ======================
  // Custom Currency methods
  // ======================
  async getCustomCurrenciesByUserId(userId: number) {
    const result = await pool.query(`
      SELECT id, user_id as "userId", code, name, created_at as "createdAt"
      FROM custom_currencies 
      WHERE user_id = $1 
      ORDER BY created_at DESC
    `, [userId]);
    return result.rows;
  }

  async createCustomCurrency(data: { userId: number; code: string; name: string }) {
    const result = await pool.query(`
      INSERT INTO custom_currencies (user_id, code, name)
      VALUES ($1, $2, $3)
      RETURNING id, user_id as "userId", code, name, created_at as "createdAt"
    `, [data.userId, data.code, data.name]);

    return result.rows[0];
  }

  async deleteCustomCurrency(currencyCode: string, userId: number): Promise<void> {
    await pool.query('DELETE FROM custom_currencies WHERE code = $1 AND user_id = $2', [currencyCode, userId]);
  }

  // ======================
  // Analytics / Reporting
  // ======================
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
    try {
      const budgetResult = await pool.query('SELECT * FROM budgets WHERE id = $1', [budgetId]);
      const budget = budgetResult.rows[0];

      if (!budget) {
        return { allocated: 0, spent: 0, remaining: 0, categories: [] };
      }

      const allocationsResult = await pool.query(`
        SELECT ba.*, ec.name as category_name 
        FROM budget_allocations ba 
        JOIN expense_categories ec ON ba.category_id = ec.id 
        WHERE ba.budget_id = $1
      `, [budgetId]);

      const allocations = allocationsResult.rows.map(row => ({
        id: row.id,
        budgetId: row.budget_id,
        categoryId: row.category_id,
        categoryName: row.category_name,
        subcategoryId: row.subcategory_id,
        amount: row.amount,
        createdAt: row.created_at
      }));

      console.log('Allocations found:', allocations);

      console.log('Budget performance debug:', {
        budgetId,
        userId: budget.user_id,
        startDate: budget.start_date,
        endDate: budget.end_date
      });

      const expensesResult = await pool.query(`
        SELECT e.*, ec.name as category_name 
        FROM expenses e 
        JOIN expense_categories ec ON e.category_id = ec.id 
        WHERE e.user_id = $1 
        AND e.date >= $2 
        AND e.date <= $3
        AND (e.budget_id = $4 OR e.budget_id IS NULL)
      `, [budget.user_id, budget.start_date, budget.end_date, budgetId]);

      console.log(`[DEBUG] Budget ${budgetId} performance query:`, {
        userId: budget.user_id,
        startDate: budget.start_date,
        endDate: budget.end_date,
        budgetId,
        foundExpenses: expensesResult.rows.length,
        sqlQuery: `
          SELECT e.*, ec.name as category_name 
          FROM expenses e 
          JOIN expense_categories ec ON e.category_id = ec.id 
          WHERE e.user_id = ${budget.user_id}
          AND e.date >= '${budget.start_date}' 
          AND e.date <= '${budget.end_date}'
          AND (e.budget_id = ${budgetId} OR e.budget_id IS NULL)`,
        expenses: expensesResult.rows.map(e => ({
          id: e.id,
          description: e.description,
          amount: e.amount,
          category: e.category_name,
          categoryId: e.category_id,
          date: e.date,
          budget_id: e.budget_id
        }))
      });

      const expenses = expensesResult.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        amount: row.amount,
        description: row.description,
        date: row.date,
        categoryId: row.category_id,
        categoryName: row.category_name,
        subcategoryId: row.subcategory_id,
        budgetId: row.budget_id,
        merchant: row.merchant,
        notes: row.notes,
        createdAt: row.created_at
      }));

      // Calculate spending by category
      const spendingByCategory = new Map<number, number>();
      expenses.forEach(expense => {
        const categoryId = expense.categoryId;
        const currentSpending = spendingByCategory.get(categoryId) || 0;
        spendingByCategory.set(categoryId, currentSpending + expense.amount);
      });

      console.log(`[DEBUG] Budget ${budgetId} spending by category:`, Array.from(spendingByCategory.entries()));
      console.log(`[DEBUG] Budget ${budgetId} allocations:`, allocations.map(a => ({ categoryId: a.categoryId, categoryName: a.categoryName, amount: a.amount })));

      const categoryPerformance = allocations.map(allocation => {
        const spent = spendingByCategory.get(allocation.categoryId) || 0;
        return {
          categoryId: allocation.categoryId,
          categoryName: allocation.categoryName,
          allocated: allocation.amount,
          spent: spent,
          remaining: allocation.amount - spent
        };
      });

      const allocatedCategoryIds = new Set(allocations.map(alloc => alloc.categoryId));

      spendingByCategory.forEach((spent, categoryId) => {
        if (!allocatedCategoryIds.has(categoryId)) {
          const expenseWithCategory = expenses.find(exp => exp.categoryId === categoryId);
          if (expenseWithCategory) {
            categoryPerformance.push({
              categoryId: categoryId,
              categoryName: expenseWithCategory.categoryName,
              allocated: 0,
              spent: spent,
              remaining: -spent
            });
          }
        }
      });

      categoryPerformance.sort((a, b) => {
        if (a.allocated > 0 && b.allocated === 0) return -1;
        if (a.allocated === 0 && b.allocated > 0) return 1;
        return a.categoryName.localeCompare(b.categoryName);
      });

      const totalAllocated = allocations.reduce((sum, alloc) => sum + alloc.amount, 0);
      const totalSpent = expenses.reduce((sum, expense) => sum + expense.amount, 0);
      const totalRemaining = budget.amount - totalSpent;

      console.log(`[DEBUG] Budget ${budgetId} final performance:`, {
        totalAllocated,
        totalSpent,
        totalRemaining,
        categoriesCount: categoryPerformance.length,
        categories: categoryPerformance.map(c => ({
          name: c.categoryName,
          allocated: c.allocated,
          spent: c.spent,
          remaining: c.remaining
        }))
      });

      return {
        allocated: totalAllocated,
        spent: totalSpent,
        remaining: totalRemaining,
        categories: categoryPerformance
      };
    } catch (error) {
      console.error('Error calculating budget performance:', error);
      return {
        allocated: 0,
        spent: 0,
        remaining: 0,
        categories: []
      };
    }
  }

  // ======================
  // Admin methods
  // ======================
  async getAllExpenses() {
    const result = await pool.query('SELECT * FROM expenses');
    return result.rows;
  }

  async getAllIncomes() {
    const result = await pool.query('SELECT * FROM incomes');
    return result.rows;
  }

  // Admin metrics for dashboard
  async getAdminMetrics() {
    // total users
    const totalUsersRes = await pool.query('SELECT COUNT(*) as count FROM users');
    const totalUsers = parseInt(totalUsersRes.rows[0].count || '0');

    // daily active users (users with expenses or incomes in last 24 hours)
    const dauRes = await pool.query(`
      SELECT COUNT(DISTINCT user_id) as count FROM (
        SELECT user_id FROM expenses WHERE created_at >= NOW() - INTERVAL '1 day'
        UNION ALL
        SELECT user_id FROM incomes WHERE created_at >= NOW() - INTERVAL '1 day'
      ) t
    `);
    const dailyActiveUsers = parseInt(dauRes.rows[0].count || '0');

    // total transactions (expenses + incomes)
    const expCountRes = await pool.query('SELECT COUNT(*) as count FROM expenses');
    const incCountRes = await pool.query('SELECT COUNT(*) as count FROM incomes');
    const totalTransactions = parseInt(expCountRes.rows[0].count || '0') + parseInt(incCountRes.rows[0].count || '0');

    // top categories by total expense amount (global)
    const topCatRes = await pool.query(`
      SELECT ec.name as category_name, COALESCE(SUM(e.amount),0) as total
      FROM expense_categories ec
      LEFT JOIN expenses e ON e.category_id = ec.id
      GROUP BY ec.id, ec.name
      ORDER BY total DESC
      LIMIT 8
    `);
    const topCategories = topCatRes.rows.map((r: any) => ({ name: r.category_name, total: parseFloat(r.total) }));

    // recent activity: combine recent expenses and incomes
    const recentRes = await pool.query(`
      SELECT type, id, user_id, amount, description, date, category_name, created_at FROM (
        SELECT 'expense' as type, e.id, e.user_id, e.amount, e.description, e.date, ec.name as category_name, e.created_at
        FROM expenses e
        LEFT JOIN expense_categories ec ON e.category_id = ec.id
        UNION ALL
        SELECT 'income' as type, i.id, i.user_id, i.amount, i.description, i.date, ic.name as category_name, i.created_at
        FROM incomes i
        LEFT JOIN income_categories ic ON i.category_id = ic.id
      ) t
      ORDER BY created_at DESC
      LIMIT 12
    `);

    const recentActivity = recentRes.rows.map((r: any) => ({
      type: r.type,
      id: r.id,
      userId: r.user_id,
      amount: parseFloat(r.amount || 0),
      description: r.description,
      date: r.date,
      categoryName: r.category_name,
      createdAt: r.created_at
    }));

    return {
      totalUsers,
      dailyActiveUsers,
      totalTransactions,
      topCategories,
      recentActivity
    };
  }

  // ======================
  // Application settings (single-row JSONB)
  // ======================
  async getSettings(): Promise<any> {
    try {
      // Ensure table exists (safe to call multiple times)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS app_settings (
          id boolean PRIMARY KEY DEFAULT true,
          data jsonb NOT NULL DEFAULT '{}'::jsonb,
          updated_at timestamptz DEFAULT now()
        )
      `);

      const res = await pool.query('SELECT data FROM app_settings WHERE id = true LIMIT 1');
      if (res.rows.length === 0) return {};
      return res.rows[0].data || {};
    } catch (err) {
      console.error('getSettings error', err);
      return {};
    }
  }

  async upsertSettings(data: any): Promise<any> {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS app_settings (
          id boolean PRIMARY KEY DEFAULT true,
          data jsonb NOT NULL DEFAULT '{}'::jsonb,
          updated_at timestamptz DEFAULT now()
        )
      `);

      const payload = JSON.stringify(data || {});
      await pool.query(
        `INSERT INTO app_settings (id, data, updated_at) VALUES (true, $1::jsonb, now()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
        [payload]
      );
      return await this.getSettings();
    } catch (err) {
      console.error('upsertSettings error', err);
      throw err;
    }
  }

  // ======================
  // Announcements (admin)
  // ======================
  async createAnnouncement(announcement: { title: string; body: string; createdBy: number; targetRoles?: string[]; sendAt?: string | null; sendEmail?: boolean }) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS announcements (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          created_by INTEGER,
          created_at timestamptz DEFAULT now()
        )
      `);
      // ensure new columns exist for backwards compatibility
      await pool.query("ALTER TABLE announcements ADD COLUMN IF NOT EXISTS target_roles jsonb DEFAULT '[]'::jsonb");
      await pool.query("ALTER TABLE announcements ADD COLUMN IF NOT EXISTS send_at timestamptz NULL");
      await pool.query("ALTER TABLE announcements ADD COLUMN IF NOT EXISTS is_sent boolean DEFAULT false");
      await pool.query("ALTER TABLE announcements ADD COLUMN IF NOT EXISTS send_email boolean DEFAULT false");

      const res = await pool.query(
        `INSERT INTO announcements (title, body, target_roles, send_at, is_sent, send_email, created_by) VALUES ($1, $2, $3::jsonb, $4::timestamptz, false, $5, $6) RETURNING id, title, body, target_roles, send_at, is_sent, send_email, created_by, created_at`,
        [announcement.title, announcement.body, JSON.stringify(announcement.targetRoles || []), announcement.sendAt || null, !!announcement.sendEmail, announcement.createdBy]
      );
      // In a real system we'd enqueue notifications or send emails to users here.
      return res.rows[0];
    } catch (err) {
      console.error('createAnnouncement error', err);
      throw err;
    }
  }

  async getAnnouncements(limit = 50, forUser?: { id: number; role?: string }) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS announcements (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          created_by INTEGER,
          created_at timestamptz DEFAULT now()
        )
      `);
      await pool.query("ALTER TABLE announcements ADD COLUMN IF NOT EXISTS target_roles jsonb DEFAULT '[]'::jsonb");
      await pool.query("ALTER TABLE announcements ADD COLUMN IF NOT EXISTS send_at timestamptz NULL");
      await pool.query("ALTER TABLE announcements ADD COLUMN IF NOT EXISTS is_sent boolean DEFAULT false");

      // Only return announcements that are published (send_at <= now OR send_at IS NULL)
      // and, if forUser provided and announcement has target_roles, filter accordingly in JS
  const res = await pool.query(`SELECT id, title, body, target_roles, send_at, is_sent, send_email, created_by, created_at FROM announcements WHERE (send_at IS NULL OR send_at <= now()) ORDER BY created_at DESC LIMIT $1`, [limit]);
      let rows = res.rows;
      if (forUser && typeof forUser.role === 'string') {
        rows = rows.filter((r: any) => {
          try {
            const targets: string[] = (r.target_roles && Array.isArray(r.target_roles)) ? r.target_roles : JSON.parse(r.target_roles || '[]');
            if (!targets || targets.length === 0) return true;
            return targets.includes(forUser.role as string);
          } catch (e) {
            return true;
          }
        });
      }
      // If forUser provided, join with announcement_reads to include readAt
      if (forUser && forUser.id) {
        const readRes = await pool.query('SELECT announcement_id, read_at FROM announcement_reads WHERE user_id = $1', [forUser.id]);
        const readMap: Record<number, string> = {};
        for (const r of readRes.rows) readMap[r.announcement_id] = r.read_at;
        rows = rows.map((r: any) => ({ ...r, readAt: readMap[r.id] || null }));
      }
      return rows;
    } catch (err) {
      console.error('getAnnouncements error', err);
      return [];
    }
  }

  // Announcement read tracking
  async markAnnouncementRead(userId: number, announcementId: number) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS announcement_reads (
          user_id integer NOT NULL,
          announcement_id integer NOT NULL,
          read_at timestamptz DEFAULT now(),
          PRIMARY KEY (user_id, announcement_id)
        )
      `);
      await pool.query(`INSERT INTO announcement_reads (user_id, announcement_id, read_at) VALUES ($1, $2, now()) ON CONFLICT (user_id, announcement_id) DO UPDATE SET read_at = now()`, [userId, announcementId]);
      return true;
    } catch (err) {
      console.error('markAnnouncementRead error', err);
      return false;
    }
  }

  async getUserAnnouncementReads(userId: number) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS announcement_reads (
          user_id integer NOT NULL,
          announcement_id integer NOT NULL,
          read_at timestamptz DEFAULT now(),
          PRIMARY KEY (user_id, announcement_id)
        )
      `);
      const res = await pool.query('SELECT announcement_id, read_at FROM announcement_reads WHERE user_id = $1', [userId]);
      return res.rows;
    } catch (err) {
      console.error('getUserAnnouncementReads error', err);
      return [];
    }
  }

  // ======================
  // Dashboard combined method (single call)
  // ======================
  async getFullDashboard(userId: number, year: number, month: number) {
    const client = await pool.connect();
    try {
      // 1) Expenses by Category
      const expensesByCategoryQuery = `
        SELECT ec.id as "categoryId", ec.name as "categoryName",
               SUM(e.amount) as "totalAmount"
        FROM expenses e
        JOIN expense_subcategories esc ON e.subcategory_id = esc.id
        JOIN expense_categories ec ON esc.category_id = ec.id
        WHERE e.user_id = $1
          AND EXTRACT(YEAR FROM e.date) = $2
          AND EXTRACT(MONTH FROM e.date) = $3
        GROUP BY ec.id, ec.name
        ORDER BY "totalAmount" DESC
      `;
      const expensesRes = await client.query(expensesByCategoryQuery, [userId, year, month]);

      // 2) Budget Report
      const budgetReportQuery = `
        SELECT b.id as "budgetId", b.name as "budgetName", b.total_amount as "budgetAmount",
               COALESCE(SUM(e.amount), 0) as "spentAmount",
               (b.total_amount - COALESCE(SUM(e.amount), 0)) as "remainingAmount"
        FROM budgets b
        LEFT JOIN budget_allocations ba ON ba.budget_id = b.id
        LEFT JOIN expenses e ON e.subcategory_id = ba.subcategory_id AND e.user_id = b.user_id
        WHERE b.user_id = $1
        GROUP BY b.id
      `;
      const budgetRes = await client.query(budgetReportQuery, [userId]);

      // 3) Monthly Summary
      const summaryQuery = `
        SELECT
            COALESCE((SELECT SUM(amount) FROM incomes
                      WHERE user_id = $1
                        AND EXTRACT(YEAR FROM date) = $2
                        AND EXTRACT(MONTH FROM date) = $3), 0) as "totalIncome",
            COALESCE((SELECT SUM(amount) FROM expenses
                      WHERE user_id = $1
                        AND EXTRACT(YEAR FROM date) = $2
                        AND EXTRACT(MONTH FROM date) = $3), 0) as "totalExpense"
      `;
      const summaryRes = await client.query(summaryQuery, [userId, year, month]);
      const summaryRow = summaryRes.rows[0];

      return {
        expensesByCategory: expensesRes.rows,
        budgetReport: budgetRes.rows,
        monthlySummary: {
          totalIncome: parseFloat(summaryRow.totalIncome),
          totalExpense: parseFloat(summaryRow.totalExpense),
          balance: parseFloat(summaryRow.totalIncome) - parseFloat(summaryRow.totalExpense),
        },
      };
    } finally {
      client.release();
    }
  }

  // ======================
  // Roles & Permissions
  // ======================
  async getRoles(): Promise<{id:number,name:string,description?:string}[]> {
    const result = await pool.query('SELECT id, name, description FROM roles ORDER BY name');
    return result.rows;
  }

  async getPermissions(): Promise<{id:number,name:string,description?:string}[]> {
    const result = await pool.query('SELECT id, name, description FROM permissions ORDER BY name');
    return result.rows;
  }

  async createRole(name: string, description?: string) {
    const result = await pool.query('INSERT INTO roles (name, description) VALUES ($1, $2) RETURNING *', [name, description || null]);
    return result.rows[0];
  }

  async assignPermissionToRole(roleId: number, permissionId: number) {
    await pool.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [roleId, permissionId]);
  }

  async removePermissionFromRole(roleId: number, permissionId: number) {
    await pool.query('DELETE FROM role_permissions WHERE role_id = $1 AND permission_id = $2', [roleId, permissionId]);
  }

  async getPermissionsForRole(roleId: number): Promise<string[]> {
    const result = await pool.query(`
      SELECT p.name FROM permissions p
      JOIN role_permissions rp ON rp.permission_id = p.id
      WHERE rp.role_id = $1
    `, [roleId]);
    return result.rows.map(r => r.name);
  }

  async setUserRole(userId: number, roleName: string): Promise<void> {
    await pool.query('UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [roleName, userId]);
  }

  async getPermissionsForUser(userId: number): Promise<string[]> {
    const result = await pool.query(`
      SELECT p.name FROM permissions p
      JOIN role_permissions rp ON rp.permission_id = p.id
      JOIN roles r ON r.id = rp.role_id
      JOIN users u ON u.role = r.name
      WHERE u.id = $1
    `, [userId]);
    return result.rows.map(r => r.name);
  }
}
