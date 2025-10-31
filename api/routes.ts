// Import Express types and HTTP server creation
import type { Express, Request, Response } from "express";
import cors from "cors";
import { corsOptions } from "./cors-config";
import { createServer, type Server } from "http";
// Import database storage layer
import { storage } from "./storage";
import { pool } from "./db";
// Import authentication setup
import { authMiddleware } from "./auth";
//import { setupAuth } from "./auth";
// Import Zod validation schemas for data validation
import { 
  insertExpenseSchema, legacyInsertExpenseSchema, 
  insertIncomeSchema, insertBudgetSchema, insertBudgetAllocationSchema,
  insertExpenseCategorySchema, insertExpenseSubcategorySchema,
  insertIncomeCategorySchema, insertIncomeSubcategorySchema
} from "@shared/schema";
import { z } from "zod";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { getCustomCurrencies, createCustomCurrency, deleteCustomCurrency } from "./custom-currencies";

/**
 * Authentication Middleware
 * Checks if user is logged in before allowing access to protected routes
 * Returns 401 Unauthorized if user is not authenticated
 */
const requireAuth = async (req: Request, res: Response, next: Function) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.sendStatus(401);
  }
  try {
    // Check user existence in DB on every request
    const userId = req.user.id;
    const result = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (result.rowCount === 0) {
      // User not found in DB
      req.logout?.(() => {});
      return res.sendStatus(401);
    }
    next();
  } catch (err) {
    // DB error (e.g., DB is down)
    return res.status(503).json({ message: "Authentication unavailable: database error" });
  }
};

/**
 * Admin Authorization Middleware
 * Checks if user is authenticated AND has admin role
 * Returns 401 if not authenticated, 403 if not admin
 */
const requireAdmin = async (req: Request, res: Response, next: Function) => {
  if (!req.isAuthenticated()) {
    return res.sendStatus(401);
  }
  
  const userRole = await storage.getUserRole(req.user!.id);
  if (userRole !== 'admin') {
    return res.status(403).json({ message: "Access denied" });
  }
  
  next();
};

/**
 * Permission middleware
 * Usage: requirePermission('admin:roles')
 */
const requirePermission = (permission: string) => {
  return async (req: Request, res: Response, next: Function) => {
    if (!req.isAuthenticated() || !req.user) return res.sendStatus(401);
    const perms = await storage.getPermissionsForUser(req.user.id);
    if (!perms.includes(permission)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  };
};

/**
 * Allow access if the user has ANY of the provided permissions
 */
const requireAnyPermission = (permissions: string[]) => {
  return async (req: Request, res: Response, next: Function) => {
    if (!req.isAuthenticated() || !req.user) return res.sendStatus(401);
    const perms = await storage.getPermissionsForUser(req.user.id);
    const ok = permissions.some(p => perms.includes(p));
    if (!ok) return res.status(403).json({ message: 'Forbidden' });
    next();
  };
};

/**
 * Main Route Registration Function
 * Sets up all API endpoints for the expense management system
 * Returns HTTP server instance for external configuration
 */
export async function registerRoutes(app: Express): Promise<Server> {
  // -------------------------------------------------------------------------
  // Income Deletion Route
  // -------------------------------------------------------------------------
  app.delete("/api/incomes/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      console.log("[DEBUG] DELETE /api/incomes/:id called with id:", id);
      const income = await storage.getIncomeById(id);
      const userRole = await storage.getUserRole(req.user!.id);
      if (!income) {
        console.log("[DEBUG] Income not found for id:", id);
        return res.status(404).json({ message: "Income not found" });
      }
      // Allow admins to delete any income, otherwise only allow users to delete their own
      if (income.userId !== req.user!.id && userRole !== 'admin') {
        console.log("[DEBUG] User does not have permission to delete income. userId:", req.user!.id, "income.userId:", income.userId, "userRole:", userRole);
        return res.status(403).json({ message: "You don't have permission to delete this income" });
      }
      
      // Log activity before deletion (capture data while it still exists)
      try {
        const { logActivity, ActivityDescriptions } = await import('./activity-logger');
        await logActivity({
          userId: req.user!.id,
          actionType: 'DELETE',
          resourceType: 'INCOME',
          resourceId: income.id,
          description: ActivityDescriptions.deleteIncome(income.description || 'Unnamed', income.amount, income.categoryName || 'Unknown'),
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'],
          metadata: { 
            income: { 
              description: income.description, 
              amount: income.amount, 
              category: income.categoryName || 'Unknown' 
            } 
          }
        });
      } catch (logError) {
        console.error('Failed to log income deletion activity:', logError);
      }
      
      await storage.deleteIncome(id);
      console.log("[DEBUG] Called storage.deleteIncome for id:", id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting income:", error);
      res.status(500).json({ message: "Failed to delete income" });
    }
  });
  // -------------------------------------------------------------------------
  // User Income Category Routes
  // ------------------------------------------------------------------------- 
  // Create a user-specific income category
  app.post("/api/user-income-categories", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { name } = req.body;
      if (!name || typeof name !== "string" || name.trim() === "") {
        return res.status(400).json({ message: "Category name is required" });
      }
      
      const categoryName = name.trim();
      
      // Check if it conflicts with system categories (case-insensitive)
      const systemCategories = ['Wages', 'Other', 'Deals'];
      if (systemCategories.some(sys => sys.toLowerCase() === categoryName.toLowerCase())) {
        return res.status(409).json({ message: `Category "${categoryName}" already exists as a system category` });
      }
      
      // Prevent duplicate for this user (case-insensitive)
      const exists = await pool.query(
        'SELECT 1 FROM user_income_categories WHERE user_id = $1 AND LOWER(name) = LOWER($2)', 
        [userId, categoryName]
      );
      if ((exists?.rowCount || 0) > 0) {
        return res.status(409).json({ message: "Category already exists" });
      }
      
      const result = await pool.query(
        'INSERT INTO user_income_categories (user_id, name) VALUES ($1, $2) RETURNING *',
        [userId, categoryName]
      );
      
      const createdCategory = result.rows[0];
      
      // Log activity
      try {
        const { logActivity, ActivityDescriptions } = await import('./activity-logger');
        await logActivity({
          userId,
          actionType: 'CREATE',
          resourceType: 'CATEGORY',
          resourceId: createdCategory.id,
          description: ActivityDescriptions.createCategory('income', createdCategory.name),
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'],
          metadata: { category: { name: createdCategory.name, type: 'income' } }
        });
      } catch (logError) {
        console.error('Failed to log category creation activity:', logError);
      }
      
      res.status(201).json(createdCategory);
    } catch (error) {
      console.error("Error creating user income category:", error);
      res.status(500).json({ message: "Failed to create user income category" });
    }
  });

  /**
   * Inbox - get messages for the authenticated user
   * GET /api/messages
   * Query params: ?limit=50&offset=0
   */
  app.get("/api/messages", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.sendStatus(401);

      const limit = Math.min(100, Number(req.query.limit) || 50);
      const offset = Number(req.query.offset) || 0;

      const q = await pool.query(
        `SELECT id, from_admin_id, subject, body, sent_at, is_read
         FROM messages
         WHERE to_user_id = $1 AND deleted_at IS NULL
         ORDER BY sent_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );

      res.json(q.rows);
    } catch (err) {
      console.error("Error fetching messages inbox:", err);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  // -------------------------------------------------------------------------
  // Role & Permission Management (admin)
  // -------------------------------------------------------------------------
  app.get('/api/admin/roles', requireAuth, requireAnyPermission(['admin:roles','admin:access']), async (req, res) => {
    try {
      const roles = await storage.getRoles();
      res.json(roles);
    } catch (err) {
      res.status(500).json({ message: 'Failed to fetch roles' });
    }
  });

  app.get('/api/admin/permissions', requireAuth, requireAnyPermission(['admin:roles','admin:access']), async (req, res) => {
    try {
      const perms = await storage.getPermissions();
      res.json(perms);
    } catch (err) {
      res.status(500).json({ message: 'Failed to fetch permissions' });
    }
  });

  app.post('/api/admin/roles', requireAuth, requirePermission('admin:roles'), async (req, res) => {
    try {
      const { name, description } = req.body;
      if (!name) return res.status(400).json({ message: 'Role name required' });
      const role = await storage.createRole(name, description);
      res.status(201).json(role);
    } catch (err) {
      res.status(500).json({ message: 'Failed to create role' });
    }
  });

  app.post('/api/admin/roles/:roleId/permissions/:permissionId', requireAuth, requirePermission('admin:roles'), async (req, res) => {
    try {
      const roleId = parseInt(req.params.roleId);
      const permId = parseInt(req.params.permissionId);
      await storage.assignPermissionToRole(roleId, permId);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: 'Failed to assign permission' });
    }
  });

  app.get('/api/admin/roles/:roleId/permissions', requireAuth, requirePermission('admin:roles'), async (req, res) => {
    try {
      const roleId = parseInt(req.params.roleId);
      const permissions = await storage.getPermissionsForRole(roleId);
      res.json(permissions);
    } catch (err) {
      console.error('Error fetching permissions for role:', err);
      res.status(500).json({ message: 'Failed to fetch permissions for role' });
    }
  });

  app.delete('/api/admin/roles/:roleId/permissions/:permissionId', requireAuth, requirePermission('admin:roles'), async (req, res) => {
    try {
      const roleId = parseInt(req.params.roleId);
      const permId = parseInt(req.params.permissionId);
      await storage.removePermissionFromRole(roleId, permId);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: 'Failed to remove permission' });
    }
  });

  // Assign a role to a user
  app.patch('/api/admin/users/:id/role', requireAuth, requirePermission('admin:users'), async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { role } = req.body;
      if (!role) return res.status(400).json({ message: 'Role required' });
      await storage.setUserRole(userId, role);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: 'Failed to assign role to user' });
    }
  });

  // Delete a user-specific income category
  app.delete("/api/user-income-categories/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user!.id;
      // Ensure the category belongs to the user
      const cat = await pool.query('SELECT * FROM user_income_categories WHERE id = $1 AND user_id = $2', [id, userId]);
      if (cat.rowCount === 0) {
        return res.status(404).json({ message: "Category not found" });
      }
      
      const categoryToDelete = cat.rows[0];
      
      // Log activity before deletion
      try {
        const { logActivity, ActivityDescriptions } = await import('./activity-logger');
        await logActivity({
          userId,
          actionType: 'DELETE',
          resourceType: 'CATEGORY',
          resourceId: id,
          description: ActivityDescriptions.deleteCategory('income', categoryToDelete.name),
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'],
          metadata: { category: { name: categoryToDelete.name, type: 'income' } }
        });
      } catch (logError) {
        console.error('Failed to log category deletion activity:', logError);
      }
      
      await pool.query('DELETE FROM user_income_categories WHERE id = $1', [id]);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting user income category:", error);
      res.status(500).json({ message: "Failed to delete user income category" });
    }
  });
  // Set up CORS before any routes or auth
  app.use(cors(corsOptions));
  // Authentication routes are set up in index.ts after body parser middleware

  // -------------------------------------------------------------------------
  // Expense Category Management Routes
  // -------------------------------------------------------------------------
  
  /**
   * GET /api/expense-categories
   * Retrieves all expense categories for the authenticated user
   * Includes both system categories and user-specific categories
   */
  app.get("/api/expense-categories", requireAuth, async (req, res) => {
    try {
      const categories = await storage.getExpenseCategories(req.user!.id);
      console.log("[DEBUG] /api/expense-categories for userId:", req.user!.id, "categories:", categories);
      res.json(categories);
    } catch (error) {
      console.error("Error fetching expense categories:", error);
      res.status(500).json({ message: "Failed to fetch expense categories" });
    }
  });
  
  /**
   * POST /api/expense-categories
   * Create new user-specific expense categories
   * System categories cannot be created through this endpoint
   */
  app.post("/api/expense-categories", requireAuth, async (req, res) => {
    try {
      const { name, description } = req.body;
      if (!name || typeof name !== "string" || name.trim() === "") {
        return res.status(400).json({ message: "Category name is required" });
      }

      // Check for duplicate category names for this user
      const existingCategories = await storage.getExpenseCategories(req.user!.id);
      const duplicateExists = existingCategories.some(cat => 
        cat.name.toLowerCase().trim() === name.toLowerCase().trim()
      );
      
      if (duplicateExists) {
        return res.status(409).json({ message: "Category already exists" });
      }

      const category = await storage.createExpenseCategory(req.user!.id, {
        name: name.trim(),
        description: description || `${name.trim()} expenses`
      });

      // Log activity
      try {
        const { logActivity, ActivityDescriptions } = await import('./activity-logger');
        await logActivity({
          userId: req.user!.id,
          actionType: 'CREATE',
          resourceType: 'CATEGORY',
          resourceId: category.id,
          description: ActivityDescriptions.createCategory('expense', category.name),
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'],
          metadata: { category: { name: category.name, type: 'expense' } }
        });
      } catch (logError) {
        console.error('Failed to log category creation activity:', logError);
      }

      res.status(201).json(category);
    } catch (error) {
      console.error("Error creating expense category:", error);
      res.status(500).json({ message: "Failed to create expense category" });
    }
  });
  
  /**
   * PATCH /api/expense-categories/:id
   * DISABLED: System categories are fixed and cannot be modified
   */
  app.patch("/api/expense-categories/:id", requireAuth, async (req, res) => {
    res.status(403).json({ 
      message: "System categories cannot be modified. Categories are fixed and standardized." 
    });
  });
  
  /**
   * DELETE /api/expense-categories/:id
   * Delete user-created expense categories or hide system categories for the current user
   */
  app.delete("/api/expense-categories/:id", requireAuth, async (req, res) => {
    try {
      const categoryId = parseInt(req.params.id);
      const category = await storage.getExpenseCategoryById(categoryId);
      
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }

      // If it's a system category, hide it for this user instead of deleting
      if (category.isSystem) {
        try {
          await storage.hideSystemCategory(req.user!.id, categoryId, 'expense');
          
          // Log the activity
          try {
            const { logActivity, ActivityDescriptions } = await import('./activity-logger');
            await logActivity({
              userId: req.user!.id,
              actionType: 'UPDATE',
              resourceType: 'CATEGORY',
              resourceId: categoryId,
              description: `Hidden system category "${category.name}" from personal view`,
              ipAddress: req.ip || req.connection.remoteAddress,
              userAgent: req.headers['user-agent'],
              metadata: { 
                category: { 
                  id: categoryId,
                  name: category.name,
                  action: 'hidden'
                } 
              }
            });
          } catch (logError) {
            console.error('[ERROR] Activity logging failed:', logError);
          }
          
          res.json({ 
            message: `Category "${category.name}" has been hidden from your view. You can restore it anytime from settings.`,
            type: 'hidden'
          });
          return;
        } catch (hideError) {
          // Handle the case where category is in use
          if (hideError instanceof Error && hideError.message.includes('currently in use')) {
            return res.status(400).json({ 
              message: hideError.message,
              type: 'error',
              cannotHide: true
            });
          }
          throw hideError; // Re-throw if it's a different error
        }
      }

      // For user-created categories, check ownership and delete
      if (category.userId !== req.user!.id) {
        return res.status(403).json({ message: "You don't have permission to delete this category" });
      }

      // Log activity before deletion
      try {
        const { logActivity, ActivityDescriptions } = await import('./activity-logger');
        await logActivity({
          userId: req.user!.id,
          actionType: 'DELETE',
          resourceType: 'CATEGORY',
          resourceId: categoryId,
          description: ActivityDescriptions.deleteCategory('expense', category.name),
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'],
          metadata: { category: { name: category.name, type: 'expense' } }
        });
      } catch (logError) {
        console.error('Failed to log category deletion activity:', logError);
      }

      await storage.deleteUserExpenseCategory(categoryId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting expense category:", error);
      
      // Check if it's a dependency error (category is being used)
      if (error instanceof Error && error.message.includes('Cannot delete category')) {
        return res.status(400).json({ message: error.message });
      }
      
      res.status(500).json({ message: "Failed to delete expense category" });
    }
  });
  
  // -------------------------------------------------------------------------
  // Expense Subcategory Routes
  // -------------------------------------------------------------------------
  app.get("/api/expense-categories/:categoryId/subcategories", requireAuth, async (req, res) => {
    try {
      const categoryId = parseInt(req.params.categoryId);
      const category = await storage.getExpenseCategoryById(categoryId);
      
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      
      if (category.userId !== req.user!.id) {
        if (!category.is_system) {
          return res.status(403).json({ message: "You don't have permission to access this category" });
        }
      }
      
      const subcategories = await storage.getExpenseSubcategories(categoryId);
     
    } catch (error) {
      console.error("Error fetching expense subcategories:", error);
      res.status(500).json({ message: "Failed to fetch expense subcategories" });
    }
  });
  
  app.post("/api/expense-subcategories", requireAuth, async (req, res) => {
    try {
      const subcategoryData = insertExpenseSubcategorySchema.parse(req.body);
      
      // Verify the category belongs to the user
      const category = await storage.getExpenseCategoryById(subcategoryData.categoryId);
      if (!category || category.userId !== req.user!.id) {
        if (!category || (!category.isSystem && category.userId !== req.user!.id)) {
          return res.status(403).json({ message: "Invalid category" });
        }
      }
      
      const subcategory = await storage.createExpenseSubcategory(req.user!.id, subcategoryData);
      res.status(201).json(subcategory);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error("Error creating expense subcategory:", error);
        res.status(500).json({ message: "Failed to create expense subcategory" });
      }
    }
  });
  
  app.patch("/api/expense-subcategories/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const subcategory = await storage.getExpenseSubcategoryById(id);
      
      if (!subcategory) {
        return res.status(404).json({ message: "Subcategory not found" });
      }
      
      if (subcategory.userId !== req.user!.id) {
        return res.status(403).json({ message: "You don't have permission to update this subcategory" });
      }
      
      const subcategoryData = insertExpenseSubcategorySchema.parse(req.body);
      
      // Verify the category belongs to the user
      const category = await storage.getExpenseCategoryById(subcategoryData.categoryId);
      if (!category || category.userId !== req.user!.id) {
        if (!category || (!category.isSystem && category.userId !== req.user!.id)) {
          return res.status(403).json({ message: "Invalid category" });
        }
      }
      
      const updatedSubcategory = await storage.updateExpenseSubcategory(id, subcategoryData);
      
      res.json(updatedSubcategory);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error("Error updating expense subcategory:", error);
        res.status(500).json({ message: "Failed to update expense subcategory" });
      }
    }
  });
  
  app.delete("/api/expense-subcategories/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const subcategory = await storage.getExpenseSubcategoryById(id);
      
      if (!subcategory) {
        return res.status(404).json({ message: "Subcategory not found" });
      }
      
      if (subcategory.userId !== req.user!.id) {
        return res.status(403).json({ message: "You don't have permission to delete this subcategory" });
      }
      
      await storage.deleteExpenseSubcategory(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting expense subcategory:", error);
      res.status(500).json({ message: "Failed to delete expense subcategory", error: (error as Error).message });
    }
  });
  
  /**
   * GET /api/expense-categories/:id/usage
   * Check if a category is currently in use
   */
  app.get("/api/expense-categories/:id/usage", requireAuth, async (req, res) => {
    try {
      const categoryId = parseInt(req.params.id);
      const category = await storage.getExpenseCategoryById(categoryId);
      
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      
      // Check if user has access to this category
      if (!category.isSystem && category.userId !== req.user!.id) {
        return res.status(403).json({ message: "You don't have permission to access this category" });
      }
      
      const usageInfo = await storage.isCategoryInUse(req.user!.id, categoryId, 'expense');
      
      res.json({
        categoryId,
        categoryName: category.name,
        isSystem: category.isSystem,
        ...usageInfo
      });
    } catch (error) {
      console.error("Error checking category usage:", error);
      res.status(500).json({ message: "Failed to check category usage" });
    }
  });
  
  // -------------------------------------------------------------------------
  // Hidden Categories Management Routes
  // -------------------------------------------------------------------------  
  /**
   * GET /api/hidden-categories
   * Get list of categories hidden by the current user
   */
  app.get("/api/hidden-categories", requireAuth, async (req, res) => {
    try {
      const categoryType = req.query.type as 'expense' | 'budget' | undefined;
      const hiddenCategories = await storage.getHiddenCategories(req.user!.id, categoryType);
      res.json(hiddenCategories);
    } catch (error) {
      console.error("Error fetching hidden categories:", error);
      res.status(500).json({ message: "Failed to fetch hidden categories" });
    }
  });

  /**
   * POST /api/hidden-categories/:categoryId/restore
   * Restore a previously hidden system category
   */
  app.post("/api/hidden-categories/:categoryId/restore", requireAuth, async (req, res) => {
    try {
      const categoryId = parseInt(req.params.categoryId);
      const { categoryType = 'expense' } = req.body;
      
      if (!['expense', 'budget'].includes(categoryType)) {
        return res.status(400).json({ message: "Invalid category type. Must be 'expense' or 'budget'" });
      }
      
      // Verify the category exists and is a system category
      const category = await storage.getExpenseCategoryById(categoryId);
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      
      if (!category.isSystem) {
        return res.status(400).json({ message: "Only system categories can be restored from hidden state" });
      }
      
      await storage.unhideSystemCategory(req.user!.id, categoryId, categoryType);
      
      // Log the activity
      try {
        const { logActivity, ActivityDescriptions } = await import('./activity-logger');
        await logActivity({
          userId: req.user!.id,
          actionType: 'UPDATE',
          resourceType: 'CATEGORY',
          resourceId: categoryId,
          description: `Restored system category "${category.name}" to personal view`,
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'],
          metadata: { 
            category: { 
              id: categoryId,
              name: category.name,
              action: 'restored'
            } 
          }
        });
      } catch (logError) {
        console.error('[ERROR] Activity logging failed:', logError);
      }
      
      res.json({ 
        message: `Category "${category.name}" has been restored to your view.`,
        type: 'restored'
      });
    } catch (error) {
      console.error("Error restoring hidden category:", error);
      res.status(500).json({ message: "Failed to restore category" });
    }
  });
  
  // -------------------------------------------------------------------------
  // Income Category Routes
  // -------------------------------------------------------------------------
  app.get("/api/income-categories", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      // Fetch system (default) categories from income_categories
      const systemResult = await pool.query(
        'SELECT id, name FROM income_categories WHERE is_system = true ORDER BY name'
      );
      const systemCategories = systemResult.rows.map(row => ({
        id: row.id,
        name: row.name,
        isDefault: true
      }));

      // Fetch user-owned categories stored in income_categories (if any)
      const incomeUserResult = await pool.query(
        'SELECT id, name FROM income_categories WHERE user_id = $1 ORDER BY name',
        [userId]
      );
      const incomeUserCategories = incomeUserResult.rows.map(row => ({
        id: row.id,
        name: row.name,
        isDefault: false
      }));

      // Also include categories stored in user_income_categories (this app uses that table for user-created income categories)
      const userIncomeResult = await pool.query(
        'SELECT id, name FROM user_income_categories WHERE user_id = $1 ORDER BY name',
        [userId]
      );
      const userIncomeCategories = userIncomeResult.rows.map(row => ({
        id: row.id,
        name: row.name,
        isDefault: false
      }));

      // Combine and return: system categories first, then user categories
      res.json([...systemCategories, ...incomeUserCategories, ...userIncomeCategories]);
    } catch (error) {
      console.error("Error fetching income categories:", error);
      res.status(500).json({ message: "Failed to fetch income categories" });
    }
  });
  
  // Disable POST /api/income-categories to prevent user-created categories
  // Enable POST /api/income-categories to allow user-created categories
  app.post("/api/income-categories", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { name, description = "" } = req.body;
      if (!name || typeof name !== "string" || name.trim() === "") {
        return res.status(400).json({ message: "Category name is required" });
      }
      // Prevent duplicate category names for this user
      const exists = await pool.query('SELECT 1 FROM income_categories WHERE user_id = $1 AND LOWER(name) = LOWER($2)', [userId, name]);
      if ((exists?.rowCount || 0) > 0) {
        return res.status(409).json({ message: "Category already exists" });
      }
      const result = await pool.query(
        'INSERT INTO income_categories (user_id, name, description) VALUES ($1, $2, $3) RETURNING *',
        [userId, name, description]
      );
      const row = result.rows[0];
      const newCategory = {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        description: row.description,
        isSystem: row.is_system,
        createdAt: row.created_at
      };
      res.status(201).json(newCategory);
    } catch (error) {
      console.error("Error creating income category:", error);
      res.status(500).json({ message: "Failed to create income category" });
    }
  });
  
  app.patch("/api/income-categories/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const category = await storage.getIncomeCategoryById(id);
      
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      
      if (category.userId !== req.user!.id) {
        return res.status(403).json({ message: "You don't have permission to update this category" });
      }
      
      const categoryData = insertIncomeCategorySchema.parse(req.body);
      const updatedCategory = await storage.updateIncomeCategory(id, categoryData);
      
      res.json(updatedCategory);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error("Error updating income category:", error);
        res.status(500).json({ message: "Failed to update income category" });
      }
    }
  });
  
  app.delete("/api/income-categories/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const category = await storage.getIncomeCategoryById(id);
      
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      
      if (category.userId !== req.user!.id) {
        return res.status(403).json({ message: "You don't have permission to delete this category" });
      }
      
      await storage.deleteIncomeCategory(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting income category:", error);
      res.status(500).json({ message: "Failed to delete income category", error: (error as Error).message });
    }
  });
  
  // -------------------------------------------------------------------------
  // Income Subcategory Routes
  // -------------------------------------------------------------------------
  app.get("/api/income-categories/:categoryId/subcategories", requireAuth, async (req, res) => {
    try {
      const categoryId = parseInt(req.params.categoryId);
      const category = await storage.getIncomeCategoryById(categoryId);
      
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      
      if (category.userId !== req.user!.id) {
        return res.status(403).json({ message: "You don't have permission to access this category" });
      }
      
      const subcategories = await storage.getIncomeSubcategories(categoryId);
      res.json(subcategories);
    } catch (error) {
      console.error("Error fetching income subcategories:", error);
      res.status(500).json({ message: "Failed to fetch income subcategories" });
    }
  });
  
  app.post("/api/income-subcategories", requireAuth, async (req, res) => {
    try {
      const subcategoryData = insertIncomeSubcategorySchema.parse(req.body);
      
      // Verify the category belongs to the user
      const category = await storage.getIncomeCategoryById(subcategoryData.categoryId);
      if (!category || category.userId !== req.user!.id) {
        return res.status(403).json({ message: "Invalid category" });
      }
      
      const subcategory = await storage.createIncomeSubcategory(req.user!.id, subcategoryData);
      res.status(201).json(subcategory);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error("Error creating income subcategory:", error);
        res.status(500).json({ message: "Failed to create income subcategory" });
      }
    }
  });
  
  app.patch("/api/income-subcategories/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const subcategory = await storage.getIncomeSubcategoryById(id);
      
      if (!subcategory) {
        return res.status(404).json({ message: "Subcategory not found" });
      }
      
      if (subcategory.userId !== req.user!.id) {
        return res.status(403).json({ message: "You don't have permission to update this subcategory" });
      }
      
      const subcategoryData = insertIncomeSubcategorySchema.parse(req.body);
      
      // Verify the category belongs to the user
      const category = await storage.getIncomeCategoryById(subcategoryData.categoryId);
      if (!category || category.userId !== req.user!.id) {
        return res.status(403).json({ message: "Invalid category" });
      }
      
      const updatedSubcategory = await storage.updateIncomeSubcategory(id, subcategoryData);
      
      res.json(updatedSubcategory);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error("Error updating income subcategory:", error);
        res.status(500).json({ message: "Failed to update income subcategory" });
      }
    }
  });
  
  app.delete("/api/income-subcategories/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const subcategory = await storage.getIncomeSubcategoryById(id);
      
      if (!subcategory) {
        return res.status(404).json({ message: "Subcategory not found" });
      }
      
      if (subcategory.userId !== req.user!.id) {
        return res.status(403).json({ message: "You don't have permission to delete this subcategory" });
      }
      
      await storage.deleteIncomeSubcategory(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting income subcategory:", error);
      res.status(500).json({ message: "Failed to delete income subcategory", error: (error as Error).message });
    }
  });
  
  // -------------------------------------------------------------------------
  // Budgets (user)
  // -------------------------------------------------------------------------
  // Add missing /api/budgets endpoint so the client receives JSON instead of the frontend HTML
  app.get("/api/budgets", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const budgets = await storage.getBudgetsByUserId(userId);
      res.json(budgets);
    } catch (err) {
      console.error("Error fetching budgets:", err);
      res.status(500).json({ message: "Failed to fetch budgets" });
    }
  });
  
  /**
   * GET /api/budgets/:id
   * Get a specific budget by ID
   */
  app.get("/api/budgets/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user!.id;
      const budget = await storage.getBudgetById(id, userId);
      
      if (!budget) {
        return res.status(404).json({ message: "Budget not found" });
      }
      
      res.json(budget);
    } catch (error) {
      console.error("Error fetching budget:", error);
      res.status(500).json({ message: "Failed to fetch budget" });
    }
  });
  
  /**
   * POST /api/budgets
   * Create a new budget
   */
  app.post("/api/budgets", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { name, amount, period, startDate, endDate, notes } = req.body;
      
      if (!name || !amount || !period || !startDate || !endDate) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      const budget = await storage.createBudget({
        userId,
        name,
        amount,
        period,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        notes
      });
      
      // Log activity
      try {
        const { logActivity, ActivityDescriptions } = await import('./activity-logger');
        await logActivity({
          userId,
          actionType: 'CREATE',
          resourceType: 'BUDGET',
          resourceId: budget.id,
          description: ActivityDescriptions.createBudget(budget.name, budget.amount, budget.period),
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'],
          metadata: { budget: { name: budget.name, amount: budget.amount, period: budget.period } }
        });
      } catch (logError) {
        console.error('Failed to log budget creation activity:', logError);
      }
      
      res.status(201).json(budget);
    } catch (error) {
      console.error("Error creating budget:", error);
      res.status(500).json({ message: "Failed to create budget" });
    }
  });
  
  /**
   * PATCH /api/budgets/:id
   * Update a budget by ID
   */
  app.patch("/api/budgets/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user!.id;
      const { name, amount, period, startDate, endDate, notes } = req.body;
      
      // Validate and sanitize input
      if (!name && !amount && !period && !startDate && !endDate && !notes) {
        return res.status(400).json({ message: "No fields to update" });
      }
      
      // Only allow updating fields that are provided
      const updates: any = {};
      if (name) updates.name = name;
      if (amount !== undefined) updates.amount = amount;
      if (period) updates.period = period;
      if (startDate) updates.startDate = new Date(startDate);
      if (endDate) updates.endDate = new Date(endDate);
      if (notes) updates.notes = notes;
      
      const budget = await storage.updateBudget(id, updates, userId);
      
      // Log activity
      try {
        const { logActivity, ActivityDescriptions } = await import('./activity-logger');
        await logActivity({
          userId,
          actionType: 'UPDATE',
          resourceType: 'BUDGET',
          resourceId: id,
          description: `Updated budget "${name || ''}"`,
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'],
          metadata: { budget: updates }
        });
      } catch (logError) {
        console.error('Failed to log budget update activity:', logError);
      }
      
      res.json(budget);
    } catch (error) {
      console.error("Error updating budget:", error);
      res.status(500).json({ message: "Failed to update budget" });
    }
  });
  
  /**
   * DELETE /api/budgets/:id
   * Delete a budget by ID
   */
  app.delete("/api/budgets/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user!.id;
      
      // Log activity: fetch budget first to get name for logging
      let budgetName = "Unknown Budget";
      try {
        const budget = await storage.getBudgetById(id, userId);
        if (budget) {
          budgetName = budget.name;
        }
      } catch (logError) {
        console.error('Failed to fetch budget for logging:', logError);
      }
      
      await storage.deleteBudget(id, userId);
      
      // Log activity
      try {
        const { logActivity, ActivityDescriptions } = await import('./activity-logger');
        await logActivity({
          userId,
          actionType: 'DELETE',
          resourceType: 'BUDGET',
          resourceId: id,
          description: ActivityDescriptions.deleteBudget(budgetName),
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'],
          metadata: { budget: { name: budgetName } }
        });
      } catch (logError) {
        console.error('Failed to log budget deletion activity:', logError);
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting budget:", error);
      res.status(500).json({ message: "Failed to delete budget" });
    }
  });
  
  // -------------------------------------------------------------------------
  // Budget Allocation Routes
  // -------------------------------------------------------------------------
  /**
   * POST /api/budgets/:budgetId/allocations
   * Create a new allocation for a budget
   */
  app.post("/api/budgets/:budgetId/allocations", requireAuth, async (req, res) => {
    try {
      const budgetId = parseInt(req.params.budgetId);
      const userId = req.user!.id;
      const { categoryId, amount, startDate, endDate } = req.body;
      
      if (!categoryId || !amount || !startDate || !endDate) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      const allocation = await storage.createBudgetAllocation({
        budgetId,
        userId,
        categoryId,
        amount,
        startDate: new Date(startDate),
        endDate: new Date(endDate)
      });
      
      // Log activity
      try {
        const { logActivity, ActivityDescriptions } = await import('./activity-logger');
        await logActivity({
          userId,
          actionType: 'CREATE',
          resourceType: 'BUDGET_ALLOCATION',
          resourceId: allocation.id,
          description: `Allocated ${amount} to category ID ${categoryId} for budget ID ${budgetId}`,
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'],
          metadata: { allocation }
        });
      } catch (logError) {
        console.error('Failed to log budget allocation creation activity:', logError);
      }
      
      res.status(201).json(allocation);
    } catch (error) {
      console.error("Error creating budget allocation:", error);
      res.status(500).json({ message: "Failed to create budget allocation" });
    }
  });
  
  /**
   * PATCH /api/budgets/:budgetId/allocations/:id
   * Update a budget allocation
   */
  app.patch("/api/budgets/:budgetId/allocations/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const budgetId = parseInt(req.params.budgetId);
      const userId = req.user!.id;
      const { amount, startDate, endDate } = req.body;
      
      // Only allow updating fields that are provided
      const updates: any = {};
      if (amount !== undefined) updates.amount = amount;
      if (startDate) updates.startDate = new Date(startDate);
      if (endDate) updates.endDate = new Date(endDate);
      
      const allocation = await storage.updateBudgetAllocation(id, updates, userId);
      
      // Log activity
      try {
        const { logActivity, ActivityDescriptions } = await import('./activity-logger');
        await logActivity({
          userId,
          actionType: 'UPDATE',
          resourceType: 'BUDGET_ALLOCATION',
          resourceId: id,
          description: `Updated allocation ID ${id} for budget ID ${budgetId}`,
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'],
          metadata: { allocation: updates }
        });
      } catch (logError) {
        console.error('Failed to log budget allocation update activity:', logError);
      }
      
      res.json(allocation);
    } catch (error) {
      console.error("Error updating budget allocation:", error);
      res.status(500).json({ message: "Failed to update budget allocation" });
    }
  });
  
  /**
   * DELETE /api/budgets/:budgetId/allocations/:id
   * Delete a budget allocation
   */
  app.delete("/api/budgets/:budgetId/allocations/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const budgetId = parseInt(req.params.budgetId);
      const userId = req.user!.id;
      
      // Log activity: fetch allocation first to get details for logging
      let allocationDetails = null;
      try {
        allocationDetails = await storage.getBudgetAllocationById(id, userId);
      } catch (logError) {
        console.error('Failed to fetch allocation for logging:', logError);
      }
      
      await storage.deleteBudgetAllocation(id, userId);
      
      // Log activity
      try {
        const { logActivity, ActivityDescriptions } = await import('./activity-logger');
        await logActivity({
          userId,
          actionType: 'DELETE',
          resourceType: 'BUDGET_ALLOCATION',
          resourceId: id,
          description: `Deleted allocation for budget ID ${budgetId}`,
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'],
          metadata: { allocation: allocationDetails }
        });
      } catch (logError) {
        console.error('Failed to log budget allocation deletion activity:', logError);
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting budget allocation:", error);
      res.status(500).json({ message: "Failed to delete budget allocation" });
    }
  });
  
  // -------------------------------------------------------------------------
  // System Settings
  // -------------------------------------------------------------------------
  // Admin: read/write settings
  app.get('/api/admin/settings', requireAuth, requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings);
    } catch (err) {
      console.error('Failed to get settings', err);
      res.status(500).json({ message: 'Failed to fetch settings' });
    }
  });

  app.put('/api/admin/settings', requireAuth, requireAdmin, async (req, res) => {
    try {
      const payload = req.body || {};
      // basic validation: limit logo size if provided
      if (payload.logoDataUrl && typeof payload.logoDataUrl === 'string' && payload.logoDataUrl.length > 500000) {
        return res.status(400).json({ message: 'Logo too large' });
      }
      const updated = await storage.upsertSettings(payload);
      res.json(updated);
    } catch (err) {
      console.error('Failed to upsert settings', err);
      res.status(500).json({ message: 'Failed to save settings' });
    }
  });

  // Public: get published settings used by the client (safe subset)
  app.get('/api/settings', async (req, res) => {
    try {
      const s = await storage.getSettings();
      const safe = {
        siteName: s.siteName || null,
        logoDataUrl: s.logoDataUrl || null,
        defaultCurrency: s.defaultCurrency || null,
        language: s.language || null
      };
      res.json(safe);
    } catch (err) {
      console.error('Failed to fetch public settings', err);
      res.status(500).json({ message: 'Failed to fetch settings' });
    }
  });

  // -------------------------------------------------------------------------
  // Test helpers: render an email template and format an amount using settings
  // -------------------------------------------------------------------------
  app.post('/api/test/render-welcome', requireAuth, requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getSettings();
      const siteName = settings.siteName || 'Expense App';
      const userName = req.body?.name || 'User';
      // simple template render
      const html = `<div><h1>Welcome to ${siteName}</h1><p>Hi ${userName}, welcome!</p></div>`;
      res.json({ html });
    } catch (err) {
      console.error('render-welcome failed', err);
      res.status(500).json({ message: 'Failed to render' });
    }
  });

  app.post('/api/test/format-amount', async (req, res) => {
    try {
      const settings = await storage.getSettings();
      const currency = settings.defaultCurrency || 'USD';
      const amount = Number(req.body?.amount || 0);
      const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
      res.json({ formatted, currency });
    } catch (err) {
      console.error('format-amount failed', err);
      res.status(500).json({ message: 'Failed to format' });
    }
  });

  // -------------------------------------------------------------------------
  // Announcements
  // -------------------------------------------------------------------------
  // Create announcement (admin only)
  app.post('/api/admin/announcements', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { title, body, targetRoles, sendAt, sendEmail } = req.body || {};
      if (!title || !body) return res.status(400).json({ message: 'title and body are required' });
      const created = await storage.createAnnouncement({ title, body, createdBy: req.user!.id, targetRoles: targetRoles || [], sendAt: sendAt || null, sendEmail: !!sendEmail });

      // If immediate send requested and sendEmail true, collect user emails and send
      if (sendEmail) {
        try {
          // minimal: fetch users matching roles (or all users if none)
          let usersRes;
          if (Array.isArray(targetRoles) && targetRoles.length > 0) {
            // naive query: users with role IN (...)
            usersRes = await pool.query('SELECT email FROM users WHERE role = ANY($1)', [targetRoles]);
          } else {
            usersRes = await pool.query('SELECT email FROM users');
          }
          const emails = (usersRes.rows || []).map((r: any) => r.email).filter(Boolean);
          if (emails.length > 0) {
            const { sendAnnouncementEmail } = await import('./email');
            const html = `<h1>${title}</h1><div>${body}</div>`;
            await sendAnnouncementEmail(emails, title, html);
          }
        } catch (e) {
          console.error('announcement email send failed', e);
        }
      }

      res.status(201).json(created);
    } catch (err) {
      console.error('create announcement failed', err);
      res.status(500).json({ message: 'Failed to create announcement' });
    }
  });

  // List announcements (admin)
  app.get('/api/admin/announcements', requireAuth, requireAdmin, async (req, res) => {
    try {
      const list = await storage.getAnnouncements(200);
      res.json(list);
    } catch (err) {
      console.error('list announcements failed', err);
      res.status(500).json({ message: 'Failed to list announcements' });
    }
  });

  // Public: fetch latest announcements for display
  app.get('/api/announcements', async (req, res) => {
    try {
      if (req.isAuthenticated && req.isAuthenticated() && req.user) {
  const list = await storage.getAnnouncements(100, { id: req.user.id, role: req.user.role || undefined });
        const mapped = list.map(a => {
          const out: any = { id: a.id, title: a.title, body: a.body, createdAt: a.created_at || a.createdAt };
          if (a.readAt) out.readAt = a.readAt;
          return out;
        });
        res.json(mapped);
      } else {
        const list = await storage.getAnnouncements(20);
        res.json(list.map(a => ({ id: a.id, title: a.title, body: a.body, createdAt: a.created_at || a.createdAt })));
      }
    } catch (err) {
      console.error('public announcements fetch failed', err);
      res.status(500).json({ message: 'Failed to fetch announcements' });
    }
  });

  // Mark announcement as read for the authenticated user
  app.post('/api/announcements/:id/read', requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      await storage.markAnnouncementRead(req.user!.id, id);
      res.json({ ok: true });
    } catch (err) {
      console.error('mark read failed', err);
      res.status(500).json({ message: 'Failed to mark read' });
    }
  });

  // -------------------------------------------------------------------------
  // Activity Log Routes
  // -------------------------------------------------------------------------
  
  // Create activity log entry (for client-side logging)
  app.post("/api/activity-logs", requireAuth, async (req, res) => {
    try {
      const { actionType, resourceType, resourceId, description, metadata } = req.body;
      
      const { logActivity } = await import('./activity-logger');
      await logActivity({
        userId: req.user!.id,
        actionType,
        resourceType,
        resourceId,
        description,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        metadata
      });
      
      res.status(201).json({ message: 'Activity logged successfully' });
    } catch (error) {
      console.error('Error creating activity log:', error);
      res.status(500).json({ message: 'Failed to create activity log' });
    }
  });
  
  app.get("/api/activity-logs", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100); // Max 100 per request
      const offset = (page - 1) * limit;
      
      // Search/filter parameters
      const searchQuery = req.query.search as string || '';
      const actionType = req.query.actionType as string || '';
      const resourceType = req.query.resourceType as string || '';
      const categoryFilter = req.query.categoryFilter as string || '';
      const fromDate = req.query.fromDate as string || '';
      const toDate = req.query.toDate as string || '';
      
      // Debug logging
      console.log(`[DEBUG] Activity logs search - userId: ${userId}, searchQuery: "${searchQuery}", actionType: "${actionType}", resourceType: "${resourceType}", categoryFilter: "${categoryFilter}"`);
      
  // Determine if user is admin by role lookup
  const userRole = await storage.getUserRole(req.user!.id);
  const isAdmin = userRole === 'admin';
  const targetUserId = isAdmin ? (req.query.userId ? parseInt(req.query.userId as string) : null) : userId;

      const { getUserActivityLogs, getUserActivityLogsCount, getAllUsersActivityLogs, getAllUsersActivityLogsCount } = await import('./activity-logger');
      
      let logs, totalCount;
      
      const filterOptions = {
        searchQuery,
        actionType,
        resourceType,
        categoryFilter,
        fromDate,
        toDate
      };
      
      if (isAdmin && !targetUserId) {
        // Admin viewing all users' activities
        [logs, totalCount] = await Promise.all([
          getAllUsersActivityLogs(limit, offset, filterOptions),
          getAllUsersActivityLogsCount(filterOptions)
        ]);
      } else {
        // Regular user viewing their own activities, or admin viewing specific user
        const userIdToQuery = targetUserId || userId;
        [logs, totalCount] = await Promise.all([
          getUserActivityLogs(userIdToQuery, limit, offset, filterOptions),
          getUserActivityLogsCount(userIdToQuery, filterOptions)
        ]);
      }

      res.json({
        logs,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit)
        },
        isAdmin,
        currentUserId: userId
      });
    } catch (error) {
      console.error("Error fetching activity logs:", error);
      res.status(500).json({ message: "Failed to fetch activity logs" });
    }
  });

  // Delete a specific activity log entry - DISABLED FOR SECURITY
  // Activity logs are immutable for audit purposes and cannot be deleted by users
  app.delete("/api/activity-logs/:id", requireAuth, async (req, res) => {
    res.status(403).json({ 
      message: "Activity logs cannot be deleted. They are maintained for security and audit purposes.",
      reason: "IMMUTABLE_AUDIT_LOG"
    });
  });

  // Clear all activity logs for the current user - DISABLED FOR SECURITY  
  // Activity logs are immutable for audit purposes and cannot be deleted by users
  app.delete("/api/activity-logs", requireAuth, async (req, res) => {
    res.status(403).json({ 
      message: "Activity logs cannot be deleted. They are maintained for security and audit purposes.",
      reason: "IMMUTABLE_AUDIT_LOG"
    });
  });

  // ========== CUSTOM CURRENCIES ROUTES ==========
  
  // Get all custom currencies for the current user
  app.get("/api/custom-currencies", requireAuth, getCustomCurrencies);
  
  // Create a new custom currency
  app.post("/api/custom-currencies", requireAuth, createCustomCurrency);
  
  // Delete a custom currency
  app.delete("/api/custom-currencies/:currencyCode", requireAuth, deleteCustomCurrency);

  const httpServer = createServer(app);

  return httpServer;
}
