import { pool } from './db';
import session from 'express-session';
import { 
  User, InsertUser, ExpenseCategory, InsertExpenseCategory, Expense, InsertExpense, 
  ExpenseSubcategory, InsertExpenseSubcategory, IncomeCategory, InsertIncomeCategory, 
  IncomeSubcategory, InsertIncomeSubcategory, Income, InsertIncome, Budget, InsertBudget,
  BudgetAllocation, InsertBudgetAllocation, Role, Permission, RoleWithPermissions,
  UserWithRoles, UserPermissions, SystemSetting, InsertSystemSetting, SystemSettingsByCategory,
  PublicSystemSettings
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

  // Analytics & Dashboard Methods
  async getAnalyticsOverview(): Promise<{
    totalUsers: number;
    dailyActiveUsers: number;
    totalTransactions: number;
    totalExpenseAmount: number;
    totalIncomeAmount: number;
    topCategories: { name: string; count: number; totalAmount: number }[];
    recentSignups: number;
    avgTransactionValue: number;
  }> {
    const [userStats, transactionStats, topCategories, recentSignups] = await Promise.all([
      this.getUserStats(),
      pool.query(`
        SELECT 
          COUNT(CASE WHEN e.id IS NOT NULL THEN 1 END) as total_expenses,
          COUNT(CASE WHEN i.id IS NOT NULL THEN 1 END) as total_incomes,
          COALESCE(SUM(e.amount), 0) as total_expense_amount,
          COALESCE(SUM(i.amount), 0) as total_income_amount,
          COALESCE(AVG(CASE WHEN e.amount IS NOT NULL THEN e.amount END), 0) as avg_expense_amount
        FROM expenses e
        FULL OUTER JOIN incomes i ON false
      `),
      pool.query(`
        SELECT 
          ec.name,
          COUNT(e.id) as count,
          COALESCE(SUM(e.amount), 0) as total_amount
        FROM expense_categories ec
        LEFT JOIN expenses e ON e.category_id = ec.id
        WHERE ec.is_system = true
        GROUP BY ec.id, ec.name
        ORDER BY total_amount DESC
        LIMIT 5
      `),
      pool.query(`
        SELECT COUNT(*) as recent_signups
        FROM users 
        WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
      `),
      pool.query(`
        SELECT COUNT(DISTINCT user_id) as daily_active
        FROM activity_logs 
        WHERE created_at >= CURRENT_DATE
      `)
    ]);

    const stats = transactionStats.rows[0];
    const dailyActive = await pool.query(`
      SELECT COUNT(DISTINCT user_id) as daily_active
      FROM activity_logs 
      WHERE created_at >= CURRENT_DATE
    `);

    return {
      totalUsers: userStats.totalUsers,
      dailyActiveUsers: parseInt(dailyActive.rows[0]?.daily_active || '0'),
      totalTransactions: parseInt(stats.total_expenses) + parseInt(stats.total_incomes),
      totalExpenseAmount: parseFloat(stats.total_expense_amount),
      totalIncomeAmount: parseFloat(stats.total_income_amount),
      topCategories: topCategories.rows.map(row => ({
        name: row.name,
        count: parseInt(row.count),
        totalAmount: parseFloat(row.total_amount)
      })),
      recentSignups: parseInt(recentSignups.rows[0].recent_signups),
      avgTransactionValue: parseFloat(stats.avg_expense_amount)
    };
  }

  async getDailyActiveUsers(days: number = 30): Promise<{ date: string; activeUsers: number }[]> {
    const result = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(DISTINCT user_id) as active_users
      FROM activity_logs 
      WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    return result.rows.map(row => ({
      date: row.date.toISOString().split('T')[0],
      activeUsers: parseInt(row.active_users)
    }));
  }

  async getExpenseTrends(days: number = 30): Promise<{ date: string; totalAmount: number; transactionCount: number }[]> {
    const result = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        COALESCE(SUM(amount), 0) as total_amount,
        COUNT(*) as transaction_count
      FROM expenses 
      WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    return result.rows.map(row => ({
      date: row.date.toISOString().split('T')[0],
      totalAmount: parseFloat(row.total_amount),
      transactionCount: parseInt(row.transaction_count)
    }));
  }

  async getTopExpenseCategories(limit: number = 10): Promise<{ 
    categoryName: string; 
    transactionCount: number; 
    totalAmount: number; 
    avgAmount: number;
    percentage: number;
  }[]> {
    const result = await pool.query(`
      WITH category_stats AS (
        SELECT 
          ec.name as category_name,
          COUNT(e.id) as transaction_count,
          COALESCE(SUM(e.amount), 0) as total_amount,
          COALESCE(AVG(e.amount), 0) as avg_amount
        FROM expense_categories ec
        LEFT JOIN expenses e ON e.category_id = ec.id
        WHERE ec.is_system = true
        GROUP BY ec.id, ec.name
      ),
      total_expenses AS (
        SELECT COALESCE(SUM(total_amount), 0) as grand_total
        FROM category_stats
      )
      SELECT 
        cs.category_name,
        cs.transaction_count,
        cs.total_amount,
        cs.avg_amount,
        CASE 
          WHEN te.grand_total > 0 THEN (cs.total_amount / te.grand_total * 100)
          ELSE 0
        END as percentage
      FROM category_stats cs
      CROSS JOIN total_expenses te
      ORDER BY cs.total_amount DESC
      LIMIT $1
    `, [limit]);

    return result.rows.map(row => ({
      categoryName: row.category_name,
      transactionCount: parseInt(row.transaction_count),
      totalAmount: parseFloat(row.total_amount),
      avgAmount: parseFloat(row.avg_amount),
      percentage: parseFloat(row.percentage)
    }));
  }

  async getRecentActivity(limit: number = 20): Promise<{
    id: number;
    actionType: string;
    resourceType: string;
    description: string;
    userName: string;
    createdAt: Date;
    metadata?: any;
  }[]> {
    const result = await pool.query(`
      SELECT 
        al.id,
        al.action_type as "actionType",
        al.resource_type as "resourceType", 
        al.description,
        u.username as "userName",
        al.created_at as "createdAt",
        al.metadata
      FROM activity_logs al
      JOIN users u ON al.user_id = u.id
      ORDER BY al.created_at DESC
      LIMIT $1
    `, [limit]);

    return result.rows;
  }

  async exportToCSV(reportType: string): Promise<string> {
    let data: any[] = [];
    let headers: string[] = [];

    switch (reportType) {
      case 'users':
        const usersResult = await pool.query(`
          SELECT id, username, email, role, status, created_at, last_login_at
          FROM users
          ORDER BY created_at DESC
        `);
        data = usersResult.rows;
        headers = ['ID', 'Username', 'Email', 'Role', 'Status', 'Created At', 'Last Login'];
        break;

      case 'expenses':
        const expensesResult = await pool.query(`
          SELECT 
            e.id,
            u.username,
            e.amount,
            ec.name as category,
            e.description,
            e.merchant,
            e.created_at
          FROM expenses e
          JOIN users u ON e.user_id = u.id
          LEFT JOIN expense_categories ec ON e.category_id = ec.id
          ORDER BY e.created_at DESC
          LIMIT 1000
        `);
        data = expensesResult.rows;
        headers = ['ID', 'User', 'Amount', 'Category', 'Description', 'Merchant', 'Date'];
        break;

      case 'budgets':
        const budgetsResult = await pool.query(`
          SELECT 
            b.id,
            u.username,
            b.name,
            b.amount,
            b.period_start,
            b.period_end,
            b.created_at
          FROM budgets b
          JOIN users u ON b.user_id = u.id
          ORDER BY b.created_at DESC
        `);
        data = budgetsResult.rows;
        headers = ['ID', 'User', 'Budget Name', 'Total Amount', 'Start Date', 'End Date', 'Created At'];
        break;

      default:
        throw new Error(`Unsupported report type: ${reportType}`);
    }

    // Convert to CSV
    const csvHeaders = headers.join(',');
    const csvRows = data.map(row => 
      Object.values(row).map(value => 
        typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value
      ).join(',')
    );
    
    return [csvHeaders, ...csvRows].join('\n');
  }

  async exportToJSON(reportType: string): Promise<any> {
    switch (reportType) {
      case 'overview':
        return await this.getAnalyticsOverview();
        
      case 'detailed':
        const [overview, dailyActive, expenseTrends, topCategories] = await Promise.all([
          this.getAnalyticsOverview(),
          this.getDailyActiveUsers(30),
          this.getExpenseTrends(30),
          this.getTopExpenseCategories(10)
        ]);
        
        return {
          overview,
          dailyActiveUsers: dailyActive,
          expenseTrends,
          topCategories,
          generatedAt: new Date().toISOString()
        };

      case 'users':
        const [userOverview, recentActivity, userTopCategories] = await Promise.all([
          this.getAnalyticsOverview(),
          this.getRecentActivity(50), // Get actual recent activity
          this.getTopExpenseCategories(10) // Get top categories
        ]);
        
        return {
          totalUsers: userOverview.totalUsers,
          dailyActiveUsers: userOverview.dailyActiveUsers,
          totalTransactions: userOverview.totalTransactions,
          totalExpenseAmount: userOverview.totalExpenseAmount,
          recentSignups: 0, // Will be calculated separately if needed
          recentActivity: recentActivity,
          topCategories: userTopCategories,
          generatedAt: new Date().toISOString()
        };

      case 'expenses':
        const [expenseOverview, expensesByCategory, trends] = await Promise.all([
          this.getAnalyticsOverview(),
          this.getTopExpenseCategories(10),
          this.getExpenseTrends(30)
        ]);
        
        return {
          totalExpenseAmount: expenseOverview.totalExpenseAmount,
          totalTransactions: expenseOverview.totalTransactions,
          avgTransactionValue: expenseOverview.avgTransactionValue,
          expenseTrends: trends,
          topCategories: expensesByCategory,
          generatedAt: new Date().toISOString()
        };

      case 'budgets':
        // For now, return basic budget data - can be enhanced later
        return {
          message: "Budget analytics not yet implemented",
          generatedAt: new Date().toISOString()
        };

      default:
        throw new Error(`Unsupported report type: ${reportType}`);
    }
  }

  // Admin History & Audit Methods
  async getAdminHistory(filters: {
    search?: string;
    userId?: number;
    category?: string;
    activityType?: string;
    startDate?: string;
    endDate?: string;
    minAmount?: number;
    maxAmount?: number;
    page: number;
    limit: number;
  }): Promise<{
    data: any[];
    totalCount: number;
    totalPages: number;
    currentPage: number;
  }> {
    const offset = (filters.page - 1) * filters.limit;
    
    // Build WHERE conditions for each table
    const buildConditions = (tableAlias: string, params: any[], paramIndex: { value: number }) => {
      const conditions: string[] = [];
      
      if (filters.search) {
        conditions.push(`(
          u.username ILIKE $${paramIndex.value} OR 
          u.email ILIKE $${paramIndex.value} OR 
          ${tableAlias}.description ILIKE $${paramIndex.value}
          ${tableAlias === 'e' ? ` OR ${tableAlias}.merchant ILIKE $${paramIndex.value}` : ''}
          ${tableAlias === 'b' ? ` OR ${tableAlias}.name ILIKE $${paramIndex.value}` : ''}
        )`);
        params.push(`%${filters.search}%`);
        paramIndex.value++;
      }

      if (filters.userId) {
        conditions.push(`u.id = $${paramIndex.value}`);
        params.push(filters.userId);
        paramIndex.value++;
      }

      if (filters.startDate) {
        conditions.push(`${tableAlias}.created_at >= $${paramIndex.value}`);
        params.push(filters.startDate + ' 00:00:00');
        paramIndex.value++;
      }

      if (filters.endDate) {
        conditions.push(`${tableAlias}.created_at <= $${paramIndex.value}`);
        params.push(filters.endDate + ' 23:59:59');
        paramIndex.value++;
      }

      if (filters.minAmount && (tableAlias === 'e' || tableAlias === 'i')) {
        conditions.push(`${tableAlias}.amount >= $${paramIndex.value}`);
        params.push(filters.minAmount);
        paramIndex.value++;
      }

      if (filters.maxAmount && (tableAlias === 'e' || tableAlias === 'i')) {
        conditions.push(`${tableAlias}.amount <= $${paramIndex.value}`);
        params.push(filters.maxAmount);
        paramIndex.value++;
      }

      return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    };

    // Build category conditions
    const buildCategoryCondition = (categoryField: string, params: any[], paramIndex: { value: number }) => {
      if (filters.category) {
        const condition = `${categoryField} = $${paramIndex.value}`;
        params.push(filters.category);
        paramIndex.value++;
        return condition;
      }
      return '';
    };

    // Separate queries for each type to avoid complex joins
    let queries: string[] = [];
    let unionParams: any[] = [];
    let paramIndex = { value: 1 };

    // Include expenses if no activity type filter or if expense is selected
    if (!filters.activityType || filters.activityType === 'expense') {
      const expenseParams: any[] = [];
      let expenseParamIndex = { value: 1 };
      const expenseConditions = buildConditions('e', expenseParams, expenseParamIndex);
      const categoryCondition = filters.category ? buildCategoryCondition('ec.name', expenseParams, expenseParamIndex) : '';
      
      queries.push(`
        SELECT 
          'expense' as type,
          e.id,
          u.id as user_id,
          u.username,
          u.email,
          e.amount,
          e.description,
          e.merchant,
          COALESCE(ec.name, 'Uncategorized') as category,
          e.created_at,
          NULL as resource_type,
          NULL as action_type
        FROM expenses e
        JOIN users u ON e.user_id = u.id
        LEFT JOIN expense_categories ec ON e.category_id = ec.id
        ${expenseConditions}
        ${categoryCondition ? `${expenseConditions ? 'AND' : 'WHERE'} ${categoryCondition}` : ''}
      `);
      unionParams.push(...expenseParams);
    }

    // Include incomes if no activity type filter or if income is selected
    if (!filters.activityType || filters.activityType === 'income') {
      const incomeParams: any[] = [];
      let incomeParamIndex = { value: unionParams.length + 1 };
      const incomeConditions = buildConditions('i', incomeParams, incomeParamIndex);
      const categoryCondition = filters.category ? buildCategoryCondition('ic.name', incomeParams, incomeParamIndex) : '';
      
      queries.push(`
        SELECT 
          'income' as type,
          i.id,
          u.id as user_id,
          u.username,
          u.email,
          i.amount,
          i.description,
          NULL as merchant,
          COALESCE(ic.name, 'Uncategorized') as category,
          i.created_at,
          NULL as resource_type,
          NULL as action_type
        FROM incomes i
        JOIN users u ON i.user_id = u.id
        LEFT JOIN income_categories ic ON i.category_id = ic.id
        ${incomeConditions}
        ${categoryCondition ? `${incomeConditions ? 'AND' : 'WHERE'} ${categoryCondition}` : ''}
      `);
      unionParams.push(...incomeParams);
    }

    // Include budgets if no activity type filter or if budget is selected
    if (!filters.activityType || filters.activityType === 'budget') {
      const budgetParams: any[] = [];
      let budgetParamIndex = { value: unionParams.length + 1 };
      const budgetConditions = buildConditions('b', budgetParams, budgetParamIndex);
      const categoryCondition = filters.category && filters.category === 'Budget' ? '1=1' : (filters.category ? '1=0' : '');
      
      queries.push(`
        SELECT 
          'budget' as type,
          b.id,
          u.id as user_id,
          u.username,
          u.email,
          b.amount as amount,
          b.name as description,
          NULL as merchant,
          'Budget' as category,
          b.created_at,
          NULL as resource_type,
          NULL as action_type
        FROM budgets b
        JOIN users u ON b.user_id = u.id
        ${budgetConditions}
        ${categoryCondition && categoryCondition !== '1=1' ? `${budgetConditions ? 'AND' : 'WHERE'} ${categoryCondition}` : ''}
      `);
      unionParams.push(...budgetParams);
    }

    // Include activities if no activity type filter or if activity is selected
    if (!filters.activityType || filters.activityType === 'activity') {
      const activityParams: any[] = [];
      let activityParamIndex = { value: unionParams.length + 1 };
      const activityConditions = buildConditions('al', activityParams, activityParamIndex);
      const categoryCondition = filters.category ? buildCategoryCondition('al.resource_type', activityParams, activityParamIndex) : '';
      
      queries.push(`
        SELECT 
          'activity' as type,
          al.id,
          u.id as user_id,
          u.username,
          u.email,
          NULL as amount,
          al.description,
          NULL as merchant,
          COALESCE(al.resource_type, 'System') as category,
          al.created_at,
          al.resource_type,
          al.action_type
        FROM activity_logs al
        JOIN users u ON al.user_id = u.id
        ${activityConditions}
        ${categoryCondition ? `${activityConditions ? 'AND' : 'WHERE'} ${categoryCondition}` : ''}
      `);
      unionParams.push(...activityParams);
    }

    if (queries.length === 0) {
      return {
        data: [],
        totalCount: 0,
        totalPages: 0,
        currentPage: filters.page
      };
    }

    // Combine all queries with UNION
    const dataQuery = `
      WITH unified_history AS (
        ${queries.join(' UNION ALL ')}
      )
      SELECT *
      FROM unified_history
      ORDER BY created_at DESC
      LIMIT $${unionParams.length + 1} OFFSET $${unionParams.length + 2}
    `;

    const countQuery = `
      WITH unified_history AS (
        ${queries.join(' UNION ALL ')}
      )
      SELECT COUNT(*) as total
      FROM unified_history
    `;

    try {
      const [dataResult, countResult] = await Promise.all([
        pool.query(dataQuery, [...unionParams, filters.limit, offset]),
        pool.query(countQuery, unionParams)
      ]);

      const totalCount = parseInt(countResult.rows[0]?.total || '0');
      const totalPages = Math.ceil(totalCount / filters.limit);

      return {
        data: dataResult.rows,
        totalCount,
        totalPages,
        currentPage: filters.page
      };
    } catch (error) {
      console.error('Error in getAdminHistory:', error);
      throw error;
    }
  }

  async getHistoryFilterOptions(): Promise<{
    users: { id: number; username: string; email: string }[];
    categories: string[];
    activityTypes: string[];
  }> {
    const [usersResult, categoriesResult] = await Promise.all([
      pool.query(`
        SELECT id, username, email 
        FROM users 
        WHERE status = 'active'
        ORDER BY username
      `),
      pool.query(`
        SELECT DISTINCT name FROM expense_categories WHERE is_system = true
        UNION
        SELECT DISTINCT name FROM income_categories WHERE is_system = true
        UNION
        SELECT DISTINCT 'Budget' as name
        UNION
        SELECT DISTINCT resource_type as name FROM activity_logs
        ORDER BY name
      `)
    ]);

    return {
      users: usersResult.rows,
      categories: categoriesResult.rows.map(row => row.name),
      activityTypes: ['expense', 'income', 'budget', 'activity']
    };
  }

  async exportAdminHistory(filters: {
    search?: string;
    userId?: number;
    category?: string;
    activityType?: string;
    startDate?: string;
    endDate?: string;
    minAmount?: number;
    maxAmount?: number;
  }): Promise<string> {
    // Get all history data (no pagination for export)
    const allFilters = { ...filters, page: 1, limit: 10000 };
    const history = await this.getAdminHistory(allFilters);

    const headers = ['Type', 'User', 'Email', 'Amount', 'Description', 'Category', 'Merchant', 'Date'];
    const csvHeaders = headers.join(',');
    
    const csvRows = history.data.map(row => [
      row.type || '',
      row.username || '',
      row.email || '',
      row.amount ? row.amount.toString() : '',
      `"${(row.description || '').replace(/"/g, '""')}"`,
      row.category || '',
      row.merchant || '',
      row.created_at ? new Date(row.created_at).toISOString().split('T')[0] : ''
    ].join(','));

    return [csvHeaders, ...csvRows].join('\n');
  }

  async getHistoryStats(filters: {
    search?: string;
    userId?: number;
    category?: string;
    activityType?: string;
    startDate?: string;
    endDate?: string;
    minAmount?: number;
    maxAmount?: number;
  }): Promise<{
    totalRecords: number;
    totalExpenses: number;
    totalIncomes: number;
    totalBudgets: number;
    totalActivities: number;
    totalAmount: number;
    dateRange: { start: string; end: string };
  }> {
    const allFilters = { ...filters, page: 1, limit: 1 };
    const history = await this.getAdminHistory(allFilters);

    // Get detailed stats
    const statsQuery = `
      WITH unified_history AS (
        SELECT 'expense' as type, amount, created_at FROM expenses
        UNION ALL
        SELECT 'income' as type, amount, created_at FROM incomes
        UNION ALL
        SELECT 'budget' as type, amount, created_at FROM budgets
        UNION ALL
        SELECT 'activity' as type, NULL as amount, created_at FROM activity_logs
      )
      SELECT 
        COUNT(*) as total_records,
        COUNT(CASE WHEN type = 'expense' THEN 1 END) as total_expenses,
        COUNT(CASE WHEN type = 'income' THEN 1 END) as total_incomes,
        COUNT(CASE WHEN type = 'budget' THEN 1 END) as total_budgets,
        COUNT(CASE WHEN type = 'activity' THEN 1 END) as total_activities,
        COALESCE(SUM(CASE WHEN type IN ('expense', 'income') THEN amount END), 0) as total_amount,
        MIN(created_at) as earliest_date,
        MAX(created_at) as latest_date
      FROM unified_history
    `;

    const statsResult = await pool.query(statsQuery);
    const stats = statsResult.rows[0];

    return {
      totalRecords: parseInt(stats.total_records),
      totalExpenses: parseInt(stats.total_expenses),
      totalIncomes: parseInt(stats.total_incomes),
      totalBudgets: parseInt(stats.total_budgets),
      totalActivities: parseInt(stats.total_activities),
      totalAmount: parseFloat(stats.total_amount || '0'),
      dateRange: {
        start: stats.earliest_date ? stats.earliest_date.toISOString().split('T')[0] : '',
        end: stats.latest_date ? stats.latest_date.toISOString().split('T')[0] : ''
      }
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

  // System Settings Methods
  async getSystemSettings(): Promise<SystemSetting[]> {
    const result = await pool.query(`
      SELECT 
        id,
        setting_key,
        setting_value,
        setting_type,
        category,
        description,
        is_public,
        created_at,
        updated_at
      FROM system_settings
      ORDER BY category, setting_key
    `);
    
    return result.rows.map(row => ({
      id: row.id,
      settingKey: row.setting_key,
      settingValue: row.setting_value,
      settingType: row.setting_type,
      category: row.category,
      description: row.description,
      isPublic: row.is_public,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  async getSystemSettingsByCategory(): Promise<SystemSettingsByCategory> {
    const settings = await this.getSystemSettings();
    
    const grouped: SystemSettingsByCategory = {
      site: [],
      branding: [],
      localization: [],
      email: [],
      security: [],
      features: []
    };

    settings.forEach(setting => {
      if (grouped[setting.category as keyof SystemSettingsByCategory]) {
        grouped[setting.category as keyof SystemSettingsByCategory].push(setting);
      }
    });

    return grouped;
  }

  async getPublicSystemSettings(): Promise<PublicSystemSettings> {
    const result = await pool.query(`
      SELECT setting_key, setting_value, setting_type
      FROM system_settings
      WHERE is_public = true
    `);
    
    const settings: Record<string, any> = {};
    result.rows.forEach(row => {
      let value = row.setting_value;
      
      // Convert values based on type
      switch (row.setting_type) {
        case 'boolean':
          value = value === 'true';
          break;
        case 'number':
          value = parseFloat(value) || 0;
          break;
        case 'json':
          try {
            value = JSON.parse(value);
          } catch {
            value = {};
          }
          break;
      }
      
      // Convert snake_case to camelCase for frontend
      const camelKey = row.setting_key.replace(/_([a-z])/g, (g: string) => g[1].toUpperCase());
      settings[camelKey] = value;
    });

    return settings as PublicSystemSettings;
  }

  async getSystemSetting(key: string): Promise<SystemSetting | null> {
    const result = await pool.query(`
      SELECT 
        id,
        setting_key,
        setting_value,
        setting_type,
        category,
        description,
        is_public,
        created_at,
        updated_at
      FROM system_settings
      WHERE setting_key = $1
    `, [key]);
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    return {
      id: row.id,
      settingKey: row.setting_key,
      settingValue: row.setting_value,
      settingType: row.setting_type,
      category: row.category,
      description: row.description,
      isPublic: row.is_public,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async updateSystemSetting(key: string, value: string, description?: string): Promise<SystemSetting | null> {
    const updateFields = ['setting_value = $2', 'updated_at = NOW()'];
    const params = [key, value];
    
    if (description !== undefined) {
      updateFields.push('description = $3');
      params.push(description);
    }
    
    const result = await pool.query(`
      UPDATE system_settings 
      SET ${updateFields.join(', ')}
      WHERE setting_key = $1
      RETURNING 
        id,
        setting_key,
        setting_value,
        setting_type,
        category,
        description,
        is_public,
        created_at,
        updated_at
    `, params);
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    return {
      id: row.id,
      settingKey: row.setting_key,
      settingValue: row.setting_value,
      settingType: row.setting_type,
      category: row.category,
      description: row.description,
      isPublic: row.is_public,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async updateMultipleSystemSettings(updates: Array<{ key: string; value: string; description?: string }>): Promise<SystemSetting[]> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const results: SystemSetting[] = [];
      
      for (const update of updates) {
        const updateFields = ['setting_value = $2', 'updated_at = NOW()'];
        const params = [update.key, update.value];
        
        if (update.description !== undefined) {
          updateFields.push('description = $3');
          params.push(update.description);
        }
        
        const result = await client.query(`
          UPDATE system_settings 
          SET ${updateFields.join(', ')}
          WHERE setting_key = $1
          RETURNING 
            id,
            setting_key,
            setting_value,
            setting_type,
            category,
            description,
            is_public,
            created_at,
            updated_at
        `, params);
        
        if (result.rows.length > 0) {
          const row = result.rows[0];
          results.push({
            id: row.id,
            settingKey: row.setting_key,
            settingValue: row.setting_value,
            settingType: row.setting_type,
            category: row.category,
            description: row.description,
            isPublic: row.is_public,
            createdAt: row.created_at,
            updatedAt: row.updated_at
          });
        }
      }
      
      await client.query('COMMIT');
      return results;
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async createSystemSetting(setting: InsertSystemSetting): Promise<SystemSetting> {
    const result = await pool.query(`
      INSERT INTO system_settings (
        setting_key,
        setting_value,
        setting_type,
        category,
        description,
        is_public
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING 
        id,
        setting_key,
        setting_value,
        setting_type,
        category,
        description,
        is_public,
        created_at,
        updated_at
    `, [
      setting.settingKey,
      setting.settingValue,
      setting.settingType,
      setting.category,
      setting.description,
      setting.isPublic
    ]);
    
    const row = result.rows[0];
    return {
      id: row.id,
      settingKey: row.setting_key,
      settingValue: row.setting_value,
      settingType: row.setting_type,
      category: row.category,
      description: row.description,
      isPublic: row.is_public,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async deleteSystemSetting(key: string): Promise<boolean> {
    const result = await pool.query(`
      DELETE FROM system_settings
      WHERE setting_key = $1
    `, [key]);
    
    return (result.rowCount || 0) > 0;
  }

  // Helper method to validate setting values based on type
  validateSettingValue(value: string, type: string): boolean {
    switch (type) {
      case 'boolean':
        return value === 'true' || value === 'false';
      case 'number':
        return !isNaN(parseFloat(value));
      case 'json':
        try {
          JSON.parse(value);
          return true;
        } catch {
          return false;
        }
      case 'text':
      case 'file':
      default:
        return true;
    }
  }

  /**
   * Ensures that all admin users have full permissions automatically
   * This method should be called when a user logs in or when roles are updated
   */
  async ensureAdminPermissions(userId: number): Promise<void> {
    try {
      // Get user details
      const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
      if (userResult.rows.length === 0) return;
      
      const user = userResult.rows[0];
      if (user.role !== 'admin') return;
      
      // Get admin role
      const roles = await this.getAllRoles();
      const adminRole = roles.find(r => r.name === 'admin');
      if (!adminRole) {
        console.warn('Admin role not found in RBAC system');
        return;
      }
      
      // Get all permissions
      const allPermissions = await this.getAllPermissions();
      const allPermissionIds = allPermissions.map(p => p.id);
      
      // Ensure admin role has all permissions
      await this.setRolePermissions(adminRole.id, allPermissionIds);
      
      // Ensure this admin user has the admin role in RBAC
      try {
        await this.assignRoleToUser(userId, adminRole.id);
      } catch (error) {
        // User might already have the role, ignore duplicate error
        if (error instanceof Error && !error.message?.includes('duplicate')) {
          console.error('Error assigning admin role:', error);
        }
      }
      
      console.log(`✅ Admin permissions ensured for user ${userId}`);
    } catch (error) {
      console.error('Error ensuring admin permissions:', error);
    }
  }

  /**
   * Ensures all existing admin users have full permissions
   * Useful for system initialization or maintenance
   */
  async ensureAllAdminPermissions(): Promise<void> {
    try {
      // Get all admin users
      const adminUsersResult = await pool.query(`
        SELECT id, username FROM users WHERE role = 'admin' AND status = 'active'
      `);
      
      console.log(`🔧 Ensuring permissions for ${adminUsersResult.rows.length} admin users...`);
      
      // Update permissions for each admin user
      for (const admin of adminUsersResult.rows) {
        await this.ensureAdminPermissions(admin.id);
      }
      
      console.log('✅ All admin permissions ensured!');
    } catch (error) {
      console.error('Error ensuring all admin permissions:', error);
    }
  }
}
