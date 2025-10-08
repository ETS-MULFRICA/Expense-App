import { pool } from './db';
import session from 'express-session';
import { 
  User, InsertUser, ExpenseCategory, InsertExpenseCategory, Expense, InsertExpense, 
  ExpenseSubcategory, InsertExpenseSubcategory, IncomeCategory, InsertIncomeCategory, 
  IncomeSubcategory, InsertIncomeSubcategory, Income, InsertIncome, Budget, InsertBudget,
  BudgetAllocation, InsertBudgetAllocation, Role, Permission, RoleWithPermissions,
  UserWithRoles, UserPermissions
} from '@shared/schema';

export class PostgresStorage {
  // Create default categories for a new user
  async createDefaultCategories(userId: number): Promise<void> {
    // Default expense categories and subcategories
    const expenseCategories = {
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

    // Default income categories and subcategories
    const incomeCategories = {
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
    // Debug log: show all income categories for user
    const allCats = await pool.query('SELECT * FROM income_categories WHERE user_id = $1', [userId]);
    console.log('All income categories for user', userId, allCats.rows);
  }
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
      try {
        // Get budget details
        const budgetResult = await pool.query('SELECT * FROM budgets WHERE id = $1', [budgetId]);
        const budget = budgetResult.rows[0];
        
        if (!budget) {
          return { allocated: 0, spent: 0, remaining: 0, categories: [] };
        }

        // Get budget allocations with category names
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

        // Get actual expenses within the budget date range for this user
        console.log('Budget performance debug:', {
          budgetId,
          userId: budget.user_id,
          startDate: budget.start_date,
          endDate: budget.end_date
        });

        // Get actual expenses within the budget date range for this user
        // Include expenses that are either:
        // 1. Specifically assigned to this budget (budget_id = budgetId)
        // 2. Not assigned to any budget but fall within the date range (budget_id IS NULL)
        // This ensures we capture all relevant spending for budget performance tracking
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
        const spendingByCategory = new Map();
        expenses.forEach(expense => {
          const categoryId = expense.categoryId;
          const currentSpending = spendingByCategory.get(categoryId) || 0;
          spendingByCategory.set(categoryId, currentSpending + expense.amount);
        });

        console.log(`[DEBUG] Budget ${budgetId} spending by category:`, Array.from(spendingByCategory.entries()));
        console.log(`[DEBUG] Budget ${budgetId} allocations:`, allocations.map(a => ({ categoryId: a.categoryId, categoryName: a.categoryName, amount: a.amount })));

        // Build category performance data from allocations
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

        // Add categories that have expenses but no allocations (allocated = 0)
        const allocatedCategoryIds = new Set(allocations.map(alloc => alloc.categoryId));
        
        spendingByCategory.forEach((spent, categoryId) => {
          if (!allocatedCategoryIds.has(categoryId)) {
            // Find the category name from expenses
            const expenseWithCategory = expenses.find(exp => exp.categoryId === categoryId);
            if (expenseWithCategory) {
              categoryPerformance.push({
                categoryId: categoryId,
                categoryName: expenseWithCategory.categoryName,
                allocated: 0, // No allocation for this category
                spent: spent,
                remaining: -spent // Negative because we're overspending (no budget allocated)
              });
            }
          }
        });

        // Sort categories: allocated categories first, then unallocated categories with expenses
        categoryPerformance.sort((a, b) => {
          // Categories with allocations first (allocated > 0)
          if (a.allocated > 0 && b.allocated === 0) return -1;
          if (a.allocated === 0 && b.allocated > 0) return 1;
          // Within each group, sort by category name
          return a.categoryName.localeCompare(b.categoryName);
        });

        // Calculate totals
        const totalAllocated = allocations.reduce((sum, alloc) => sum + alloc.amount, 0);
        const totalSpent = expenses.reduce((sum, expense) => sum + expense.amount, 0);
        const totalRemaining = budget.amount - totalSpent; // Use budget.amount, not totalAllocated

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

    // Admin methods
    async getAllExpenses() {
      const result = await pool.query(`
        SELECT 
          e.id,
          e.user_id,
          e.amount,
          e.description,
          e.date,
          e.category_id,
          e.merchant,
          e.notes,
          e.created_at,
          COALESCE(u.name, 'Unknown User') as "userName",
          COALESCE(u.username, 'unknown') as "userUsername",
          COALESCE(ec.name, e.category_name, 'Uncategorized') as "categoryName"
        FROM expenses e
        LEFT JOIN users u ON e.user_id = u.id
        LEFT JOIN expense_categories ec ON e.category_id = ec.id
        ORDER BY e.date DESC
      `);
      return result.rows;
    }

    async getAllIncomes() {
      const result = await pool.query(`
        SELECT 
          i.id,
          i.user_id,
          i.amount,
          i.description,
          i.date,
          i.category_id,
          COALESCE(u.name, 'Unknown User') as "userName",
          COALESCE(u.username, 'unknown') as "userUsername",
          COALESCE(ic.name, i.category_name, 'Uncategorized') as "categoryName"
        FROM incomes i
        LEFT JOIN users u ON i.user_id = u.id
        LEFT JOIN income_categories ic ON i.category_id = ic.id
        ORDER BY i.date DESC
      `);
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
      
      // Disable the trigger temporarily if it exists
      try {
        await client.query('ALTER TABLE activity_log DISABLE TRIGGER ALL');
      } catch (triggerError) {
        console.warn('Could not disable activity_log triggers:', triggerError);
      }
      
      // First, delete budget allocations that reference budgets
      await client.query('DELETE FROM budget_allocations WHERE budget_id IN (SELECT id FROM budgets WHERE user_id = $1)', [userId]);
      
      // Delete user's budgets
      await client.query('DELETE FROM budgets WHERE user_id = $1', [userId]);
      
      // Delete user's expenses
      await client.query('DELETE FROM expenses WHERE user_id = $1', [userId]);
      
      // Delete user's incomes
      await client.query('DELETE FROM incomes WHERE user_id = $1', [userId]);
      
      // Delete user's expense categories (not system categories)
      await client.query('DELETE FROM expense_categories WHERE user_id = $1 AND is_system = false', [userId]);
      
      // Delete user's income categories
      await client.query('DELETE FROM income_categories WHERE user_id = $1', [userId]);
      
      // Delete user's hidden categories
      await client.query('DELETE FROM user_hidden_categories WHERE user_id = $1', [userId]);
      
      // Delete activity logs for this user
      await client.query('DELETE FROM activity_log WHERE user_id = $1', [userId]);
      
      // Re-enable triggers
      try {
        await client.query('ALTER TABLE activity_log ENABLE TRIGGER ALL');
      } catch (triggerError) {
        console.warn('Could not re-enable activity_log triggers:', triggerError);
      }
      
      // Finally delete the user
      await client.query('DELETE FROM users WHERE id = $1', [userId]);
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      
      // Make sure to re-enable triggers even if there was an error
      try {
        await client.query('ALTER TABLE activity_log ENABLE TRIGGER ALL');
      } catch (triggerError) {
        console.warn('Could not re-enable activity_log triggers after error:', triggerError);
      }
      
      throw error;
    } finally {
      client.release();
    }
  }

  async softDeleteUser(userId: number): Promise<void> {
    await pool.query(
      'UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2', 
      ['deleted', userId]
    );
  }

  async resetUserPassword(userId: number, newPassword: string): Promise<void> {
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [newPassword, userId]);
  }

  async searchUsers(query: string, filters: { role?: string; status?: string } = {}): Promise<User[]> {
    let sql = `
      SELECT id, username, name, email, role, status, created_at, updated_at
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

    if (filters.status) {
      sql += ` AND status = $${paramCount}`;
      params.push(filters.status);
      paramCount++;
    }

    sql += ' ORDER BY created_at DESC';

    const result = await pool.query(sql, params);
    return result.rows;
  }

  async getUserStats(): Promise<{ totalUsers: number; activeUsers: number; suspendedUsers: number; adminUsers: number }> {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_users,
        COUNT(CASE WHEN status = 'suspended' THEN 1 END) as suspended_users,
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

    // Expense Category operations
  async getExpenseCategories(userId: number): Promise<ExpenseCategory[]> {
    // Get all categories: system categories (user_id = 14) + user's own categories
    // Exclude categories that the user has hidden
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
        AND uhc.category_type = 'expense'
      )
      WHERE ((ec.user_id = 14 AND ec.is_system = true) OR (ec.user_id = $1 AND ec.is_system = false))
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
    // First check if any expenses are using this category
    const expenseCheck = await pool.query(
      'SELECT COUNT(*) as count FROM expenses WHERE category_id = $1',
      [id]
    );
    
    const expenseCount = parseInt(expenseCheck.rows[0].count);
    if (expenseCount > 0) {
      throw new Error(`Cannot delete category. It is being used by ${expenseCount} expense(s). Please update or delete those expenses first.`);
    }
    
    // Also check if any budget allocations are using this category
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
    // First verify this is a system category
    const category = await this.getExpenseCategoryById(categoryId);
    if (!category || !category.isSystem) {
      throw new Error('Only system categories can be hidden');
    }

    // Check if the category is currently in use
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
    
    // Check if category is used in expenses
    const expenseCount = await pool.query(
      'SELECT COUNT(*) as count FROM expenses WHERE user_id = $1 AND category_id = $2',
      [userId, categoryId]
    );
    const expenseCountNum = parseInt(expenseCount.rows[0].count);
    
    // Check if category is used in budget allocations
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
    const row = result.rows[0];
    if (!row) return undefined;
    // Map snake_case to camelCase for TS compatibility
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
    // Get category name
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
    // Get category name
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

  // Income operations
  async getIncomesByUserId(userId: number): Promise<Income[]> {
    const result = await pool.query('SELECT * FROM incomes WHERE user_id = $1', [userId]);
    // Map all fields to camelCase for TS compatibility
    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      amount: row.amount,
      description: row.description,
      date: row.date,
      categoryId: row.category_id,
      categoryName: row.category_name, // Include category_name for custom categories
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
    // Ensure all fields are camelCase for TS compatibility
    return {
      id: row.id,
      userId: row.user_id,
      amount: row.amount,
      description: row.description,
      date: row.date,
      categoryId: row.category_id,
      categoryName: row.category_name, // Include category_name for custom categories
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
      categoryName: row.category_name, // Include category_name for custom categories
      subcategoryId: row.subcategory_id,
      source: row.source,
      notes: row.notes,
      createdAt: row.created_at
    };
  }

  async deleteIncome(id: number): Promise<void> {
    await pool.query('DELETE FROM incomes WHERE id = $1', [id]);
  }

  // Budget operations
  async getBudgetsByUserId(userId: number): Promise<Budget[]> {
    const result = await pool.query('SELECT * FROM budgets WHERE user_id = $1', [userId]);
    // Map database fields to camelCase for TypeScript compatibility
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
    
    // Map database fields to camelCase for TypeScript compatibility
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
    // Map database fields to camelCase for TypeScript compatibility
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
    // Map database fields to camelCase for TypeScript compatibility
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

  // Budget Allocation operations
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
    
    // Get the category name
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

  // Custom Currency methods
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

  // -------------------------------------------------------------------------
  // RBAC (Role-Based Access Control) Methods
  // -------------------------------------------------------------------------

  // Role management
  async getAllRoles(): Promise<Role[]> {
    const result = await pool.query(`
      SELECT id, name, description, is_system, created_at, updated_at 
      FROM roles 
      ORDER BY name
    `);
    return result.rows;
  }

  // Get all roles with their permissions populated
  async getAllRolesWithPermissions(): Promise<RoleWithPermissions[]> {
    const result = await pool.query(`
      SELECT 
        r.id, r.name, r.description, r.is_system, r.created_at, r.updated_at,
        COALESCE(
          JSON_AGG(
            CASE WHEN p.id IS NOT NULL THEN
              JSON_BUILD_OBJECT(
                'id', p.id,
                'name', p.name,
                'description', p.description,
                'resource', p.resource
              )
            END
          ) FILTER (WHERE p.id IS NOT NULL), 
          '[]'::json
        ) as permissions
      FROM roles r
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      LEFT JOIN permissions p ON rp.permission_id = p.id
      GROUP BY r.id, r.name, r.description, r.is_system, r.created_at, r.updated_at
      ORDER BY r.name
    `);
    
    return result.rows.map(row => ({
      ...row,
      permissions: row.permissions || []
    }));
  }

  async getRoleById(roleId: number): Promise<Role | null> {
    const result = await pool.query(`
      SELECT id, name, description, is_system, created_at, updated_at 
      FROM roles 
      WHERE id = $1
    `, [roleId]);
    return result.rows[0] || null;
  }

  async getRoleByName(name: string): Promise<Role | null> {
    const result = await pool.query(`
      SELECT id, name, description, is_system, created_at, updated_at 
      FROM roles 
      WHERE name = $1
    `, [name]);
    return result.rows[0] || null;
  }

  async createRole(roleData: { name: string; description?: string }): Promise<Role> {
    const result = await pool.query(`
      INSERT INTO roles (name, description) 
      VALUES ($1, $2) 
      RETURNING id, name, description, is_system, created_at, updated_at
    `, [roleData.name, roleData.description]);
    return result.rows[0];
  }

  async updateRole(roleId: number, updates: { name?: string; description?: string }): Promise<Role> {
    const setParts: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (updates.name !== undefined) {
      setParts.push(`name = $${paramCount}`);
      values.push(updates.name);
      paramCount++;
    }

    if (updates.description !== undefined) {
      setParts.push(`description = $${paramCount}`);
      values.push(updates.description);
      paramCount++;
    }

    if (setParts.length === 0) {
      throw new Error('No fields to update');
    }

    setParts.push(`updated_at = NOW()`);
    values.push(roleId);

    const result = await pool.query(`
      UPDATE roles 
      SET ${setParts.join(', ')} 
      WHERE id = $${paramCount} AND is_system = false
      RETURNING id, name, description, is_system, created_at, updated_at
    `, values);

    if (result.rows.length === 0) {
      throw new Error('Role not found or cannot modify system role');
    }

    return result.rows[0];
  }

  async deleteRole(roleId: number): Promise<void> {
    const result = await pool.query(`
      DELETE FROM roles 
      WHERE id = $1 AND is_system = false
    `, [roleId]);

    if (result.rowCount === 0) {
      throw new Error('Role not found or cannot delete system role');
    }
  }

  // Permission management
  async getAllPermissions(): Promise<Permission[]> {
    const result = await pool.query(`
      SELECT id, name, description, resource, action, created_at 
      FROM permissions 
      ORDER BY resource, action
    `);
    return result.rows;
  }

  async getPermissionsByResource(resource: string): Promise<Permission[]> {
    const result = await pool.query(`
      SELECT id, name, description, resource, action, created_at 
      FROM permissions 
      WHERE resource = $1
      ORDER BY action
    `, [resource]);
    return result.rows;
  }

  // Role-Permission relationships
  async getRolePermissions(roleId: number): Promise<Permission[]> {
    const result = await pool.query(`
      SELECT p.id, p.name, p.description, p.resource, p.action, p.created_at
      FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = $1
      ORDER BY p.resource, p.action
    `, [roleId]);
    return result.rows;
  }

  async getRoleWithPermissions(roleId: number): Promise<RoleWithPermissions | null> {
    const role = await this.getRoleById(roleId);
    if (!role) return null;

    const permissions = await this.getRolePermissions(roleId);
    return { ...role, permissions };
  }

  async assignPermissionToRole(roleId: number, permissionId: number): Promise<void> {
    await pool.query(`
      INSERT INTO role_permissions (role_id, permission_id) 
      VALUES ($1, $2) 
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `, [roleId, permissionId]);
  }

  async removePermissionFromRole(roleId: number, permissionId: number): Promise<void> {
    await pool.query(`
      DELETE FROM role_permissions 
      WHERE role_id = $1 AND permission_id = $2
    `, [roleId, permissionId]);
  }

  async setRolePermissions(roleId: number, permissionIds: number[]): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Remove all existing permissions for this role
      await client.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);
      
      // Add new permissions
      if (permissionIds.length > 0) {
        const values = permissionIds.map((permId, index) => 
          `($1, $${index + 2})`
        ).join(', ');
        
        await client.query(`
          INSERT INTO role_permissions (role_id, permission_id) 
          VALUES ${values}
        `, [roleId, ...permissionIds]);
      }
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // User-Role relationships
  async getUserRoles(userId: number): Promise<Role[]> {
    const result = await pool.query(`
      SELECT r.id, r.name, r.description, r.is_system, r.created_at, r.updated_at
      FROM roles r
      JOIN user_roles ur ON r.id = ur.role_id
      WHERE ur.user_id = $1
      ORDER BY r.name
    `, [userId]);
    return result.rows;
  }

  async getUserWithRoles(userId: number): Promise<UserWithRoles | null> {
    const user = await this.getUser(userId);
    if (!user) return null;

    const roles = await this.getUserRoles(userId);
    return { ...user, roles };
  }

  async assignRoleToUser(userId: number, roleId: number): Promise<void> {
    await pool.query(`
      INSERT INTO user_roles (user_id, role_id) 
      VALUES ($1, $2) 
      ON CONFLICT (user_id, role_id) DO NOTHING
    `, [userId, roleId]);
  }

  async removeRoleFromUser(userId: number, roleId: number): Promise<void> {
    await pool.query(`
      DELETE FROM user_roles 
      WHERE user_id = $1 AND role_id = $2
    `, [userId, roleId]);
  }

  async setUserRoles(userId: number, roleIds: number[]): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Remove all existing roles for this user
      await client.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);
      
      // Add new roles
      if (roleIds.length > 0) {
        const values = roleIds.map((roleId, index) => 
          `($1, $${index + 2})`
        ).join(', ');
        
        await client.query(`
          INSERT INTO user_roles (user_id, role_id) 
          VALUES ${values}
        `, [userId, ...roleIds]);
      }
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Permission checking
  async getUserPermissions(userId: number): Promise<Permission[]> {
    const result = await pool.query(`
      SELECT DISTINCT p.id, p.name, p.description, p.resource, p.action, p.created_at
      FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      JOIN user_roles ur ON rp.role_id = ur.role_id
      WHERE ur.user_id = $1
      ORDER BY p.resource, p.action
    `, [userId]);
    return result.rows;
  }

  async hasPermission(userId: number, permissionName: string): Promise<boolean> {
    const result = await pool.query(`
      SELECT 1
      FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      JOIN user_roles ur ON rp.role_id = ur.role_id
      WHERE ur.user_id = $1 AND p.name = $2
      LIMIT 1
    `, [userId, permissionName]);
    return result.rows.length > 0;
  }

  async hasAnyPermission(userId: number, permissionNames: string[]): Promise<boolean> {
    if (permissionNames.length === 0) return false;
    
    const placeholders = permissionNames.map((_, index) => `$${index + 2}`).join(', ');
    const result = await pool.query(`
      SELECT 1
      FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      JOIN user_roles ur ON rp.role_id = ur.role_id
      WHERE ur.user_id = $1 AND p.name IN (${placeholders})
      LIMIT 1
    `, [userId, ...permissionNames]);
    return result.rows.length > 0;
  }

  async hasRole(userId: number, roleName: string): Promise<boolean> {
    const result = await pool.query(`
      SELECT 1
      FROM roles r
      JOIN user_roles ur ON r.id = ur.role_id
      WHERE ur.user_id = $1 AND r.name = $2
      LIMIT 1
    `, [userId, roleName]);
    return result.rows.length > 0;
  }

  async getUserPermissionsSummary(userId: number): Promise<UserPermissions> {
    const roles = await this.getUserRoles(userId);
    const permissions = await this.getUserPermissions(userId);
    return { userId, roles, permissions };
  }

  // Get all users that have a specific role
  async getUsersByRole(roleId: number): Promise<{ id: number; username: string; email: string }[]> {
    const result = await pool.query(`
      SELECT DISTINCT u.id, u.username, u.email
      FROM users u
      JOIN user_roles ur ON u.id = ur.user_id
      WHERE ur.role_id = $1
      ORDER BY u.username
    `, [roleId]);
    
    return result.rows;
  }

  // Reports and analytics methods can be implemented similarly using SQL queries
}
