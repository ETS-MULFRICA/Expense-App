import { pool } from "./db";

export interface ActivityLogEntry {
  userId: number;
  actionType: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'VIEW';
  resourceType: 'EXPENSE' | 'INCOME' | 'BUDGET' | 'BUDGET_ALLOCATION' | 'CATEGORY' | 'USER' | 'REPORT' | 'SETTINGS';
  resourceId?: number;
  description: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: any;
}

/**
 * Log user activity for security and accountability
 */
export async function logActivity(activity: ActivityLogEntry): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO activity_log (user_id, action_type, resource_type, resource_id, description, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        activity.userId,
        activity.actionType,
        activity.resourceType,
        activity.resourceId || null,
        activity.description,
        activity.ipAddress || null,
        activity.userAgent || null,
        activity.metadata ? JSON.stringify(activity.metadata) : null
      ]
    );
  } catch (error) {
    console.error('Failed to log activity:', error);
    // Don't throw error to avoid breaking the main functionality
  }
}

/**
 * Get activity logs for a user with pagination
 */
export async function getUserActivityLogs(
  userId: number, 
  limit: number = 50, 
  offset: number = 0
): Promise<any[]> {
  const result = await pool.query(
    `SELECT 
      id,
      user_id,
      action_type,
      resource_type,
      resource_id,
      description,
      ip_address,
      user_agent,
      metadata,
      created_at
     FROM activity_log 
     WHERE user_id = $1 
     ORDER BY created_at DESC 
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  
  return result.rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    actionType: row.action_type,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    description: row.description,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    metadata: row.metadata,
    createdAt: row.created_at
  }));
}

/**
 * Get activity logs for all users with pagination (admin only)
 */
export async function getAllUsersActivityLogs(
  limit: number = 50, 
  offset: number = 0
): Promise<any[]> {
  const result = await pool.query(
    `SELECT 
      al.id,
      al.user_id,
      u.username,
      u.name as user_name,
      al.action_type,
      al.resource_type,
      al.resource_id,
      al.description,
      al.ip_address,
      al.user_agent,
      al.metadata,
      al.created_at
     FROM activity_log al
     JOIN users u ON al.user_id = u.id
     ORDER BY al.created_at DESC 
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  
  return result.rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    username: row.username,
    userName: row.user_name,
    actionType: row.action_type,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    description: row.description,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    metadata: row.metadata,
    createdAt: row.created_at
  }));
}

/**
 * Get total count of activity logs for a user
 */
export async function getUserActivityLogsCount(userId: number): Promise<number> {
  const result = await pool.query(
    'SELECT COUNT(*) as count FROM activity_log WHERE user_id = $1',
    [userId]
  );
  
  return parseInt(result.rows[0].count);
}

/**
 * Get total count of activity logs for all users (admin only)
 */
export async function getAllUsersActivityLogsCount(): Promise<number> {
  const result = await pool.query(
    'SELECT COUNT(*) as count FROM activity_log'
  );
  
  return parseInt(result.rows[0].count);
}

/**
 * Helper functions to create common activity descriptions
 */
export const ActivityDescriptions = {
  // Authentication
  login: (username: string) => `User ${username} logged in successfully`,
  logout: (username: string) => `User ${username} logged out`,
  
  // Expenses
  createExpense: (description: string, amount: number, category: string) => 
    `Created expense "${description}" for ${amount} in ${category} category`,
  updateExpense: (description: string, amount: number, category: string) => 
    `Updated expense "${description}" to ${amount} in ${category} category`,
  deleteExpense: (description: string, amount: number, category: string) => 
    `Deleted expense "${description}" (${amount}) from ${category} category`,
  
  // Income
  createIncome: (description: string, amount: number, category: string) => 
    `Created income "${description}" for ${amount} in ${category} category`,
  updateIncome: (description: string, amount: number, category: string) => 
    `Updated income "${description}" to ${amount} in ${category} category`,
  deleteIncome: (description: string, amount: number, category: string) => 
    `Deleted income "${description}" (${amount}) from ${category} category`,
  
  // Budgets
  createBudget: (name: string, totalAmount: number) => 
    `Created budget "${name}" with total amount ${totalAmount}`,
  updateBudget: (name: string, oldAmount: number, newAmount: number, oldPeriod: string, newPeriod: string) => 
    `Updated budget "${name}" - Amount: ${oldAmount} → ${newAmount}, Period: ${oldPeriod} → ${newPeriod}`,
  deleteBudget: (name: string) => 
    `Deleted budget "${name}"`,
  viewBudget: (name: string, totalAmount: number, allocationsCount: number) => 
    `Viewed budget "${name}" (Total: ${totalAmount}, ${allocationsCount} allocations)`,
    
  // Budget Allocations
  createBudgetAllocation: (budgetName: string, categoryName: string, amount: number) => 
    `Added ${amount} allocation for "${categoryName}" to budget "${budgetName}"`,
  updateBudgetAllocation: (budgetName: string, categoryName: string, oldAmount: number, newAmount: number) => 
    `Updated "${categoryName}" allocation in budget "${budgetName}" from ${oldAmount} to ${newAmount}`,
  deleteBudgetAllocation: (budgetName: string, categoryName: string, amount: number) => 
    `Removed ${amount} allocation for "${categoryName}" from budget "${budgetName}"`,
  
  // Categories
  createCategory: (type: string, name: string) => 
    `Created ${type.toLowerCase()} category "${name}"`,
  deleteCategory: (type: string, name: string) => 
    `Deleted ${type.toLowerCase()} category "${name}"`,
  
  // Reports
  viewReport: (reportType: string) => 
    `Viewed ${reportType} report`,
    
  // Settings
  updateSettings: (setting: string) => 
    `Updated ${setting} settings`,
};