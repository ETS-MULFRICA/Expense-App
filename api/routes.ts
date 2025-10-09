// Import Express types and HTTP server creation
import type { Express, Request, Response } from "express";
import cors from "cors";
import { corsOptions } from "./cors-config";
import { createServer, type Server } from "http";
// Import database storage layer
import { storage } from "./storage";
import { pool } from "./db";
// Import authentication setup
import { setupAuth } from "./auth";
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
 * Permission-Based Authorization Middleware
 * Checks if user is authenticated AND has specific permission
 * Returns 401 if not authenticated, 403 if permission denied
 */
const requirePermission = (permission: string) => {
  return async (req: Request, res: Response, next: Function) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    try {
      const hasAccess = await storage.hasPermission(req.user.id, permission);
      if (!hasAccess) {
        return res.status(403).json({ 
          message: "Insufficient permissions", 
          required: permission 
        });
      }
      next();
    } catch (error) {
      console.error("Permission check error:", error);
      return res.status(503).json({ message: "Permission check unavailable" });
    }
  };
};

/**
 * Multiple Permissions Authorization Middleware
 * Checks if user has ANY of the specified permissions (OR logic)
 * Returns 401 if not authenticated, 403 if no permissions match
 */
const requireAnyPermission = (permissions: string[]) => {
  return async (req: Request, res: Response, next: Function) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    try {
      const hasAccess = await storage.hasAnyPermission(req.user.id, permissions);
      if (!hasAccess) {
        return res.status(403).json({ 
          message: "Insufficient permissions", 
          required_any: permissions 
        });
      }
      next();
    } catch (error) {
      console.error("Permission check error:", error);
      return res.status(503).json({ message: "Permission check unavailable" });
    }
  };
};

/**
 * Role-Based Authorization Middleware
 * Checks if user is authenticated AND has specific role
 * Returns 401 if not authenticated, 403 if role not assigned
 */
const requireRole = (roleName: string) => {
  return async (req: Request, res: Response, next: Function) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    try {
      const hasRole = await storage.hasRole(req.user.id, roleName);
      if (!hasRole) {
        return res.status(403).json({ 
          message: "Insufficient role", 
          required: roleName 
        });
      }
      next();
    } catch (error) {
      console.error("Role check error:", error);
      return res.status(503).json({ message: "Role check unavailable" });
    }
  };
};

/**
 * Resource Owner Authorization Middleware
 * Checks if user owns the resource OR has admin permissions
 * Used for endpoints where users can access their own data
 */
const requireOwnershipOrPermission = (permission: string, ownerIdParam: string = 'userId') => {
  return async (req: Request, res: Response, next: Function) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    try {
      const currentUserId = req.user.id;
      const resourceOwnerId = parseInt(req.params[ownerIdParam]) || parseInt(req.body[ownerIdParam]);

      // If user owns the resource, allow access
      if (resourceOwnerId === currentUserId) {
        return next();
      }

      // Otherwise, check if user has the required permission
      const hasPermission = await storage.hasPermission(currentUserId, permission);
      if (!hasPermission) {
        return res.status(403).json({ 
          message: "Access denied: not resource owner and insufficient permissions",
          required: permission 
        });
      }

      next();
    } catch (error) {
      console.error("Ownership/permission check error:", error);
      return res.status(503).json({ message: "Authorization check unavailable" });
    }
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
      res.json(subcategories);
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
      // Fetch the three default categories
      const defaultCategoriesResult = await pool.query(
        'SELECT id, name FROM income_categories WHERE name IN (\'Wages\', \'Other\', \'Deals\') ORDER BY name'
      );
      const defaultCategories = defaultCategoriesResult.rows.map(row => ({
        id: row.id,
        name: row.name,
        isDefault: true
      }));

      // Fetch user-specific categories
      const userCategoriesResult = await pool.query(
        'SELECT id, name FROM user_income_categories WHERE user_id = $1 ORDER BY name',
        [userId]
      );
      const userCategories = userCategoriesResult.rows.map(row => ({
        id: row.id,
        name: row.name,
        isDefault: false
      }));

      // Combine and return
      res.json([...defaultCategories, ...userCategories]);
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
  // Expense Routes
  // -------------------------------------------------------------------------
  app.get("/api/expenses", requireAuth, async (req, res) => {
    try {
      const expenses = await storage.getExpensesByUserId(req.user!.id);
      
      // Augment each expense with category and subcategory names
      const augmentedExpenses = await Promise.all(expenses.map(async (expense) => {
        const category = await storage.getExpenseCategoryById(expense.categoryId);
        
        let subcategory = null;
        if (expense.subcategoryId) {
          subcategory = await storage.getExpenseSubcategoryById(expense.subcategoryId);
        }
        
        return {
          ...expense,
          categoryName: category?.name || 'Unknown',
          subcategoryName: subcategory?.name || null
        };
      }));
      
  console.log("[DEBUG] /api/expenses for userId:", req.user!.id, "expenses:", augmentedExpenses);
  res.json(augmentedExpenses);
    } catch (error) {
      console.error("Error fetching expenses:", error);
      res.status(500).json({ message: "Failed to fetch expenses" });
    }
  });

  app.post("/api/expenses", requireAuth, async (req, res) => {
    try {
      // Ensure date is properly parsed, especially if it came as an ISO string
      const data = req.body;
      if (data.date && typeof data.date === 'string') {
        data.date = new Date(data.date);
      }
      
      // Check if we're using legacy or new schema
      let expense;
      
      if ('category' in data) {
        // Legacy mode (string category)
        const expenseData = legacyInsertExpenseSchema.parse(data);
        expense = await storage.createLegacyExpense({
          ...expenseData,
          userId: req.user!.id
        });
      } else {
        // New mode (category ID)
        const expenseData = insertExpenseSchema.parse(data);

      // Only check that the category exists
      const categoryResult = await pool.query('SELECT * FROM expense_categories WHERE id = $1', [expenseData.categoryId]);
      const category = categoryResult.rows[0];
      if (!category) {
        return res.status(403).json({ message: "Invalid category" });
      }
        
        expense = await storage.createExpense({
          ...expenseData,
          userId: req.user!.id
        });
      }
      
      // Log activity
      try {
        const { logActivity, ActivityDescriptions } = await import('./activity-logger');
        const categoryName = expense.category_name || 'Unknown';
        await logActivity({
          userId: req.user!.id,
          actionType: 'CREATE',
          resourceType: 'EXPENSE',
          resourceId: expense.id,
          description: ActivityDescriptions.createExpense(expense.description, expense.amount, categoryName),
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'],
          metadata: { expense: { description: expense.description, amount: expense.amount, category: categoryName } }
        });
      } catch (logError) {
        console.error('Failed to log expense creation activity:', logError);
      }
      
      res.status(201).json(expense);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error("Error creating expense:", error);
        res.status(500).json({ message: "Failed to create expense" });
      }
    }
  });

  app.get("/api/expenses/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const expense = await storage.getExpenseById(id);
      
      if (!expense) {
        return res.status(404).json({ message: "Expense not found" });
      }
      
      if (expense.userId !== req.user!.id) {
        return res.status(403).json({ message: "You don't have permission to access this expense" });
      }
      
      res.json(expense);
    } catch (error) {
      console.error("Error fetching expense:", error);
      res.status(500).json({ message: "Failed to fetch expense" });
    }
  });

  app.patch("/api/expenses/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const expense = await storage.getExpenseById(id);
      
      if (!expense) {
        return res.status(404).json({ message: "Expense not found" });
      }
      
      const userRole = await storage.getUserRole(req.user!.id);
      if (expense.user_id !== req.user!.id && userRole !== "admin") {
        return res.status(403).json({ message: "You don't have permission to update this expense" });
      }
      
      // Ensure date is properly parsed, especially if it came as an ISO string
      const data = req.body;
      if (data.date && typeof data.date === 'string') {
        data.date = new Date(data.date);
      }
      
      // Check if we're using legacy or new schema
      let updatedExpense;
      
      if ('category' in data) {
        // Legacy mode (string category)
        const expenseData = legacyInsertExpenseSchema.parse(data);
        updatedExpense = await storage.updateLegacyExpense(id, {
          ...expenseData,
          userId: req.user!.id
        });
      } else {
        // New mode (category ID)
        const expenseData = insertExpenseSchema.parse(data);
        
        // Verify the category exists and belongs to the user or is system category
        const categoryUserRole = await storage.getUserRole(req.user!.id);
        const category = await storage.getExpenseCategoryById(expenseData.categoryId);
        if (!category) {
          return res.status(403).json({ message: "Invalid category" });
        }
        
        // Allow if: user owns category, user is admin, or it's a system category
        const isOwner = category.userId === req.user!.id;
        const isAdmin = categoryUserRole === "admin";
        const isSystemCategory = category.isSystem;
        
        if (!isOwner && !isAdmin && !isSystemCategory) {
          return res.status(403).json({ message: "Invalid category" });
        }
        
        // If subcategory is provided, verify it belongs to the category
        if (expenseData.subcategoryId) {
          const subcategory = await storage.getExpenseSubcategoryById(expenseData.subcategoryId);
          if (!subcategory || subcategory.categoryId !== expenseData.categoryId) {
            return res.status(403).json({ message: "Invalid subcategory" });
          }
        }
        
        updatedExpense = await storage.updateExpense(id, {
          ...expenseData,
          userId: req.user!.id
        });
      }
      
      // Log activity for expense update
      try {
        const { logActivity, ActivityDescriptions } = await import('./activity-logger');
        const categoryName = updatedExpense.category_name || 'Unknown';
        await logActivity({
          userId: req.user!.id,
          actionType: 'UPDATE',
          resourceType: 'EXPENSE',
          resourceId: updatedExpense.id,
          description: ActivityDescriptions.updateExpense(updatedExpense.description, updatedExpense.amount, categoryName),
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'],
          metadata: { expense: { description: updatedExpense.description, amount: updatedExpense.amount, category: categoryName } }
        });
      } catch (logError) {
        console.error('Failed to log expense update activity:', logError);
      }
      
      res.json(updatedExpense);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error("Error updating expense:", error);
        res.status(500).json({ message: "Failed to update expense" });
      }
    }
  });

  app.delete("/api/expenses/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const expense = await storage.getExpenseById(id);
      const userRole = await storage.getUserRole(req.user!.id);
      
      if (!expense) {
        return res.status(404).json({ message: "Expense not found" });
      }
      console.log({expense,userRole,reqUserId:req.user!.id});
      
      // Allow admins to delete any expense, otherwise only allow users to delete their own
      if (expense.user_id !== req.user!.id && userRole !== 'admin') {
        return res.status(403).json({ message: "You don't have permission to delete this expense" });
      }
      
      // Log activity before deletion (capture data while it still exists)
      try {
        const { logActivity, ActivityDescriptions } = await import('./activity-logger');
        const categoryName = expense.category_name || 'Unknown';
        await logActivity({
          userId: req.user!.id,
          actionType: 'DELETE',
          resourceType: 'EXPENSE',
          resourceId: expense.id,
          description: ActivityDescriptions.deleteExpense(expense.description || 'Unnamed', expense.amount, categoryName),
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'],
          metadata: { 
            expense: { 
              description: expense.description, 
              amount: expense.amount, 
              category: categoryName 
            } 
          }
        });
      } catch (logError) {
        console.error('Failed to log expense deletion activity:', logError);
      }
      
      await storage.deleteExpense(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting expense:", error);
      res.status(500).json({ message: "Failed to delete expense" });
    }
  });
  
  // -------------------------------------------------------------------------
  // Income Routes
  // -------------------------------------------------------------------------
  app.get("/api/incomes", requireAuth, async (req, res) => {
    try {
      const incomes = await storage.getIncomesByUserId(req.user!.id);
      
      // Augment each income with category and subcategory names
      const augmentedIncomes = await Promise.all(incomes.map(async (income) => {
        let categoryName = '';
        
        // Prioritize the category_name field stored in the database
        if (income.categoryName && income.categoryName.trim() !== '') {
          categoryName = income.categoryName;
        } else if (income.categoryId) {
          // Only look up by ID if no category name is stored
          // Try to find category in system income_categories first
          const systemCategory = await storage.getIncomeCategoryById(income.categoryId);
          if (systemCategory) {
            categoryName = systemCategory.name;
          } else {
            // If not found in system categories, check user_income_categories
            const userCategoryResult = await pool.query(
              'SELECT name FROM user_income_categories WHERE id = $1 AND user_id = $2',
              [income.categoryId, req.user!.id]
            );
            if (userCategoryResult.rows.length > 0) {
              categoryName = userCategoryResult.rows[0].name;
            } else {
              categoryName = 'Unknown';
            }
          }
        } else {
          // Fallback
          categoryName = 'Uncategorized';
        }
        
        let subcategory = null;
        if (income.subcategoryId) {
          subcategory = await storage.getIncomeSubcategoryById(income.subcategoryId);
        }
        
        return {
          ...income,
          categoryName: categoryName,
          subcategoryName: subcategory?.name || null
        };
      }));
      
  console.log("[DEBUG] /api/incomes for userId:", req.user!.id, "incomes:", augmentedIncomes);
  res.json(augmentedIncomes);
    } catch (error) {
      console.error("Error fetching incomes:", error);
      res.status(500).json({ message: "Failed to fetch incomes" });
    }
  });

  app.post("/api/incomes", requireAuth, async (req, res) => {
  console.log('[DEBUG] POST /api/incomes received body:', req.body);
    try {
      // Debug log for troubleshooting category issues
      console.log('[DEBUG] POST /api/incomes - request body:', req.body);
      // Ensure date is properly parsed, especially if it came as an ISO string
      const data = req.body;
      if (data.date && typeof data.date === 'string') {
        data.date = new Date(data.date);
      }

      let categoryId = data.categoryId;
      let categoryName = data.categoryName;
      let catName = categoryName;

      // Debug: print what will be inserted (after variables are defined)
      console.log('[DEBUG] Will insert income with:', {
        user_id: req.user!.id,
        amount: data.amount,
        description: data.description,
        date: data.date,
        categoryId: categoryId,
        catName: catName,
        source: data.source,
        notes: data.notes
      });

      // Handle different category scenarios
      let finalCategoryId = null;
      let finalCategoryName = "";

      // Define system categories for validation
      const systemCategories = [
        { id: 1, name: 'Wages' },
        { id: 2, name: 'Deals' },
        { id: 3, name: 'Other' }
      ];

      if (categoryId && [1,2,3].includes(Number(categoryId))) {
        // System categories (id 1,2,3) - always keep their IDs
        finalCategoryId = categoryId;
        finalCategoryName = categoryName || "";
      } else if (categoryName && categoryName.trim() !== "") {
        // Check if the categoryName matches a system category
        const systemCategory = systemCategories.find(cat => 
          cat.name.trim().toLowerCase() === categoryName.trim().toLowerCase()
        );
        
        if (systemCategory) {
          // It's a system category, use the proper ID
          finalCategoryId = systemCategory.id;
          finalCategoryName = systemCategory.name;
        } else {
          // It's a custom category, use null ID
          finalCategoryId = null;
          finalCategoryName = categoryName.trim();
        }
      } else {
        return res.status(400).json({ message: "Please provide a category name." });
      }

      // Save with category_id (can be null) and category_name
      const result = await pool.query(
        'INSERT INTO incomes (user_id, amount, description, date, category_id, category_name, source, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
        [req.user!.id, data.amount, data.description, data.date, finalCategoryId, finalCategoryName, data.source, data.notes]
      );
      console.log('[DEBUG] Inserted income result:', result.rows[0]);
      
      const createdIncome = result.rows[0];
      
      // Log activity
      try {
        const { logActivity, ActivityDescriptions } = await import('./activity-logger');
        await logActivity({
          userId: req.user!.id,
          actionType: 'CREATE',
          resourceType: 'INCOME',
          resourceId: createdIncome.id,
          description: ActivityDescriptions.createIncome(createdIncome.description, createdIncome.amount, finalCategoryName || 'Unknown'),
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'],
          metadata: { income: { description: createdIncome.description, amount: createdIncome.amount, category: finalCategoryName } }
        });
      } catch (logError) {
        console.error('Failed to log income creation activity:', logError);
      }
      
      res.status(201).json(createdIncome);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error("Error creating income:", error);
        res.status(500).json({ message: "Failed to create income" });
      }
    }
  });

  app.patch("/api/incomes/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const income = await storage.getIncomeById(id);
      
      if (!income) {
        return res.status(404).json({ message: "Income not found" });
      }
      
      if (income.userId !== req.user!.id) {
        return res.status(403).json({ message: "You don't have permission to update this income" });
      }
      
      // Ensure date is properly parsed, especially if it came as an ISO string
      const data = req.body;
      if (data.date && typeof data.date === 'string') {
        data.date = new Date(data.date);
      }
      
      const incomeData = insertIncomeSchema.parse(data);
      
      // Handle different category scenarios for update
      let finalCategoryId = null;
      let finalCategoryName = "";

      // Define system categories for validation
      const systemCategories = [
        { id: 1, name: 'Wages' },
        { id: 2, name: 'Deals' },
        { id: 3, name: 'Other' }
      ];

      if (incomeData.categoryId && [1,2,3].includes(Number(incomeData.categoryId))) {
        // System categories (id 1,2,3) - always keep their IDs
        finalCategoryId = incomeData.categoryId;
        finalCategoryName = data.categoryName || "";
      } else if (data.categoryName && data.categoryName.trim() !== "") {
        // Check if the categoryName matches a system category
        const systemCategory = systemCategories.find(cat => 
          cat.name.trim().toLowerCase() === data.categoryName.trim().toLowerCase()
        );
        
        if (systemCategory) {
          // It's a system category, use the proper ID
          finalCategoryId = systemCategory.id;
          finalCategoryName = systemCategory.name;
        } else {
          // It's a custom category, use null ID
          finalCategoryId = null;
          finalCategoryName = data.categoryName.trim();
        }
      } else {
        return res.status(400).json({ message: "Please provide a category name." });
      }
      
      // If subcategory is provided, verify it belongs to the category (only for valid category IDs)
      if (incomeData.subcategoryId && finalCategoryId) {
        const subcategory = await storage.getIncomeSubcategoryById(incomeData.subcategoryId);
        if (!subcategory || subcategory.categoryId !== finalCategoryId) {
          return res.status(403).json({ message: "Invalid subcategory" });
        }
      }
      
      // Update income with category_id (can be null) and category_name
      const result = await pool.query(
        'UPDATE incomes SET amount = $1, description = $2, date = $3, category_id = $4, category_name = $5, subcategory_id = $6, source = $7, notes = $8 WHERE id = $9 RETURNING *',
        [incomeData.amount, incomeData.description, incomeData.date, finalCategoryId, finalCategoryName, incomeData.subcategoryId, incomeData.source, incomeData.notes, id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Income not found" });
      }

      const updatedIncome = result.rows[0];
      
      // Log activity
      try {
        const { logActivity, ActivityDescriptions } = await import('./activity-logger');
        await logActivity({
          userId: req.user!.id,
          actionType: 'UPDATE',
          resourceType: 'INCOME',
          resourceId: updatedIncome.id,
          description: ActivityDescriptions.updateIncome(updatedIncome.description, updatedIncome.amount, finalCategoryName || 'Unknown'),
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'],
          metadata: { 
            income: { 
              description: updatedIncome.description, 
              amount: updatedIncome.amount, 
              category: finalCategoryName 
            } 
          }
        });
      } catch (logError) {
        console.error('Failed to log income update activity:', logError);
      }
      
      res.json(updatedIncome);
    } catch (error) {
      console.error("Error updating income:", error);
      res.status(500).json({ message: "Failed to update income" });
    }
  });

  // Budget Routes
  app.get("/api/budgets", requireAuth, async (req, res) => {
    try {
      console.log(`[DEBUG] Budgets request:`, {
        userId: req.user!.id,
        username: req.user!.username,
        userCurrency: req.user!.currency,
        timestamp: new Date().toISOString(),
        headers: {
          'user-agent': req.headers['user-agent']?.substring(0, 50) + '...',
          'referer': req.headers.referer
        }
      });
      
      const budgets = await storage.getBudgetsByUserId(req.user!.id);
      
      console.log(`[DEBUG] Raw budgets from DB:`, {
        userId: req.user!.id,
        budgetCount: budgets.length,
        budgetIds: budgets.map(b => b.id),
        budgetAmounts: budgets.map(b => ({ id: b.id, name: b.name, amount: b.amount }))
      });
      
      // Add performance data and category names to each budget
      const budgetsWithPerformance = await Promise.all(
        budgets.map(async (budget) => {
          const performance = await storage.getBudgetPerformance(budget.id);
          const allocations = await storage.getBudgetAllocations(budget.id);
          const categoryNames = allocations.map((allocation: any) => allocation.categoryName).filter(Boolean);
          
          console.log('[DEBUG] Budget ID:', budget.id, 'allocations:', allocations.length, 'categoryNames:', categoryNames);
          
          return {
            ...budget,
            allocatedAmount: performance.allocated,
            spentAmount: performance.spent,
            remainingAmount: performance.remaining,
            categoryNames: categoryNames
          };
        })
      );
      
      console.log('[DEBUG] Final budgets response:', JSON.stringify(budgetsWithPerformance, null, 2));
      res.json(budgetsWithPerformance);
    } catch (error) {
      console.error("Error fetching budgets:", error);
      res.status(500).json({ message: "Failed to fetch budgets" });
    }
  });

  app.post("/api/budgets", requireAuth, async (req, res) => {
    try {
      // Ensure dates are properly parsed, especially if they came as ISO strings
      const data = req.body;
      if (data.startDate && typeof data.startDate === 'string') {
        data.startDate = new Date(data.startDate);
      }
      if (data.endDate && typeof data.endDate === 'string') {
        data.endDate = new Date(data.endDate);
      }
      
      // Extract categoryIds before validation
      const categoryIds = data.categoryIds;
      console.log('[DEBUG] Budget creation - received categoryIds:', categoryIds);
      delete data.categoryIds;
      
      const budgetData = insertBudgetSchema.parse(data);
      const budget = await storage.createBudget({
        ...budgetData,
        userId: req.user!.id
      });
      
      // If categories are provided, create budget allocations for them
      if (categoryIds && Array.isArray(categoryIds) && categoryIds.length > 0) {
        const budgetId = budget.id;
        console.log('[DEBUG] Creating budget allocations for budget:', budgetId, 'categories:', categoryIds);
        
        // Verify all categories exist and are accessible to the user
        for (const categoryId of categoryIds) {
          const category = await storage.getExpenseCategoryById(categoryId);
          console.log('[DEBUG] Category check - ID:', categoryId, 'found:', !!category, 'isSystem:', category?.isSystem, 'userId:', category?.userId);
          // Allow system categories or user's own categories
          if (category && (category.isSystem || category.userId === req.user!.id)) {
            console.log('[DEBUG] Creating budget allocation for category:', categoryId, category.name);
            // Create an initial allocation with zero amount that can be updated later
            await storage.createBudgetAllocation({
              budgetId,
              categoryId,
              subcategoryId: null,
              amount: 0
            });
          } else {
            console.log('[DEBUG] Skipping category:', categoryId, 'not accessible to user');
          }
        }
      }
      
      // Log activity for budget creation
      try {
        const { logActivity, ActivityDescriptions } = await import('./activity-logger');
        await logActivity({
          userId: req.user!.id,
          actionType: 'CREATE',
          resourceType: 'BUDGET',
          resourceId: budget.id,
          description: ActivityDescriptions.createBudget(budget.name, budget.amount),
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'],
          metadata: { 
            budget: { 
              name: budget.name, 
              totalAmount: budget.amount,
              period: budget.period,
              categoriesCount: categoryIds ? categoryIds.length : 0
            } 
          }
        });
      } catch (logError) {
        console.error('Failed to log budget creation activity:', logError);
      }
      
      res.status(201).json(budget);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error("Error creating budget:", error);
        res.status(500).json({ message: "Failed to create budget" });
      }
    }
  });

  app.get("/api/budgets/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const budget = await storage.getBudgetById(id);
      
      if (!budget) {
        return res.status(404).json({ message: "Budget not found" });
      }
      
      if (budget.userId !== req.user!.id) {
        return res.status(403).json({ message: "You don't have permission to access this budget" });
      }
      
      // Get all budget allocations as well
      const allocations = await storage.getBudgetAllocations(id);
      
      // Get budget performance
      const performance = await storage.getBudgetPerformance(id);
      
      // Log the budget view activity
      try {
        const { logActivity, ActivityDescriptions } = await import('./activity-logger');
        await logActivity({
          userId: req.user!.id,
          actionType: 'VIEW',
          resourceType: 'BUDGET',
          resourceId: id,
          description: ActivityDescriptions.viewBudget(budget.name, budget.amount, allocations.length),
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'],
          metadata: { 
            budget: { 
              name: budget.name, 
              amount: budget.amount,
              period: budget.period,
              allocationsCount: allocations.length
            }
          }
        });
      } catch (logError) {
        console.error('Failed to log budget view activity:', logError);
      }
      
      res.json({
        budget,
        allocations,
        performance
      });
    } catch (error) {
      console.error("Error fetching budget:", error);
      res.status(500).json({ message: "Failed to fetch budget" });
    }
  });

  app.patch("/api/budgets/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const budget = await storage.getBudgetById(id);
      
      if (!budget) {
        return res.status(404).json({ message: "Budget not found" });
      }
      
      if (budget.userId !== req.user!.id) {
        return res.status(403).json({ message: "You don't have permission to update this budget" });
      }
      
      // Ensure dates are properly parsed, especially if they came as ISO strings
      const data = req.body;
      if (data.startDate && typeof data.startDate === 'string') {
        data.startDate = new Date(data.startDate);
      }
      if (data.endDate && typeof data.endDate === 'string') {
        data.endDate = new Date(data.endDate);
      }
      
      const budgetData = insertBudgetSchema.parse(data);
      const updatedBudget = await storage.updateBudget(id, budgetData);
      
      // Log the budget update activity
      try {
        const { logActivity, ActivityDescriptions } = await import('./activity-logger');
        await logActivity({
          userId: req.user!.id,
          actionType: 'UPDATE',
          resourceType: 'BUDGET',
          resourceId: id,
          description: ActivityDescriptions.updateBudget(
            updatedBudget.name, 
            budget.amount, 
            updatedBudget.amount, 
            budget.period, 
            updatedBudget.period
          ),
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'],
          metadata: { 
            oldBudget: { 
              name: budget.name, 
              amount: budget.amount,
              period: budget.period 
            },
            newBudget: { 
              name: updatedBudget.name, 
              amount: updatedBudget.amount,
              period: updatedBudget.period 
            }
          }
        });
      } catch (logError) {
        console.error('Failed to log budget update activity:', logError);
      }
      
      res.json(updatedBudget);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error("Error updating budget:", error);
        res.status(500).json({ message: "Failed to update budget" });
      }
    }
  });

  // PUT route for budget updates (same as PATCH)
  app.put("/api/budgets/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const budget = await storage.getBudgetById(id);
      
      if (!budget) {
        return res.status(404).json({ message: "Budget not found" });
      }
      
      if (budget.userId !== req.user!.id) {
        return res.status(403).json({ message: "You don't have permission to update this budget" });
      }
      
      // Ensure dates are properly parsed, especially if they came as ISO strings
      const data = req.body;
      if (data.startDate && typeof data.startDate === 'string') {
        data.startDate = new Date(data.startDate);
      }
      if (data.endDate && typeof data.endDate === 'string') {
        data.endDate = new Date(data.endDate);
      }
      
      // Extract categoryIds before validation
      const categoryIds = data.categoryIds;
      console.log('[DEBUG] Budget update - received categoryIds:', categoryIds);
      delete data.categoryIds;
      
      const budgetData = insertBudgetSchema.parse(data);
      const updatedBudget = await storage.updateBudget(id, budgetData);
      
      // Update budget allocations if categories are provided
      if (categoryIds && Array.isArray(categoryIds)) {
        console.log('[DEBUG] Updating budget allocations for budget:', id, 'categories:', categoryIds);
        
        // Get current allocations to preserve amounts
        const currentAllocations = await storage.getBudgetAllocations(id);
        const currentAllocationMap = new Map();
        currentAllocations.forEach(allocation => {
          currentAllocationMap.set(allocation.categoryId, allocation.amount);
        });
        
        // Delete existing allocations
        await storage.deleteBudgetAllocations(id);
        
        // Create new allocations for selected categories
        for (const categoryId of categoryIds) {
          const category = await storage.getExpenseCategoryById(categoryId);
          console.log('[DEBUG] Category check - ID:', categoryId, 'found:', !!category, 'isSystem:', category?.isSystem, 'userId:', category?.userId);
          // Allow system categories or user's own categories
          if (category && (category.isSystem || category.userId === req.user!.id)) {
            console.log('[DEBUG] Creating/updating budget allocation for category:', categoryId, category.name);
            // Preserve the previous amount if it existed, otherwise use 0
            const amount = currentAllocationMap.get(categoryId) || 0;
            await storage.createBudgetAllocation({
              budgetId: id,
              categoryId,
              subcategoryId: null,
              amount: amount
            });
          } else {
            console.log('[DEBUG] Skipping category:', categoryId, 'not accessible to user');
          }
        }
      }
      
      // Log the budget update activity
      try {
        const { logActivity, ActivityDescriptions } = await import('./activity-logger');
        await logActivity({
          userId: req.user!.id,
          actionType: 'UPDATE',
          resourceType: 'BUDGET',
          resourceId: id,
          description: ActivityDescriptions.updateBudget(
            updatedBudget.name, 
            budget.amount, 
            updatedBudget.amount, 
            budget.period, 
            updatedBudget.period
          ),
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'],
          metadata: { 
            oldBudget: { 
              name: budget.name, 
              amount: budget.amount,
              period: budget.period 
            },
            newBudget: { 
              name: updatedBudget.name, 
              amount: updatedBudget.amount,
              period: updatedBudget.period 
            },
            categoriesCount: categoryIds ? categoryIds.length : 0
          }
        });
      } catch (logError) {
        console.error('Failed to log budget update activity:', logError);
      }
      
      res.json(updatedBudget);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error("Error updating budget:", error);
        res.status(500).json({ message: "Failed to update budget" });
      }
    }
  });

  app.delete("/api/budgets/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const budget = await storage.getBudgetById(id);
      
      if (!budget) {
        return res.status(404).json({ message: "Budget not found" });
      }
      
      if (budget.userId !== req.user!.id) {
        return res.status(403).json({ message: "You don't have permission to delete this budget" });
      }
      
      await storage.deleteBudget(id);
      
      // Log the budget deletion activity
      try {
        const { logActivity, ActivityDescriptions } = await import('./activity-logger');
        await logActivity({
          userId: req.user!.id,
          actionType: 'DELETE',
          resourceType: 'BUDGET',
          resourceId: id,
          description: ActivityDescriptions.deleteBudget(budget.name),
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'],
          metadata: { 
            deletedBudget: { 
              name: budget.name, 
              amount: budget.amount,
              period: budget.period,
              startDate: budget.startDate,
              endDate: budget.endDate
            }
          }
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
  app.get("/api/budgets/:budgetId/allocations", requireAuth, async (req, res) => {
    try {
      const budgetId = parseInt(req.params.budgetId);
      const budget = await storage.getBudgetById(budgetId);
      
      if (!budget) {
        return res.status(404).json({ message: "Budget not found" });
      }
      
      if (budget.userId !== req.user!.id) {
        return res.status(403).json({ message: "You don't have permission to access this budget" });
      }
      
      const allocations = await storage.getBudgetAllocations(budgetId);
      res.json(allocations);
    } catch (error) {
      console.error("Error fetching budget allocations:", error);
      res.status(500).json({ message: "Failed to fetch budget allocations" });
    }
  });
  
  app.get("/api/budgets/:budgetId/performance", requireAuth, async (req, res) => {
    try {
      const budgetId = parseInt(req.params.budgetId);
      const budget = await storage.getBudgetById(budgetId);
      
      if (!budget) {
        return res.status(404).json({ message: "Budget not found" });
      }
      
      if (budget.userId !== req.user!.id) {
        return res.status(403).json({ message: "You don't have permission to access this budget" });
      }
      
      const performance = await storage.getBudgetPerformance(budgetId);
      res.json(performance);
    } catch (error) {
      console.error("Error fetching budget performance:", error);
      res.status(500).json({ message: "Failed to fetch budget performance" });
    }
  });

  // POST route for budget allocations (nested under budget)
  app.post("/api/budgets/:budgetId/allocations", requireAuth, async (req, res) => {
    try {
      const budgetId = parseInt(req.params.budgetId);
      const allocationData = insertBudgetAllocationSchema.parse(req.body);
      
      // Verify the budget belongs to the user
      const budget = await storage.getBudgetById(budgetId);
      if (!budget || budget.userId !== req.user!.id) {
        return res.status(403).json({ message: "Invalid budget" });
      }

      // Ensure the budgetId matches
      const finalAllocationData = {
        ...allocationData,
        budgetId: budgetId
      };

      const allocation = await storage.createBudgetAllocation(finalAllocationData);
      res.status(201).json(allocation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        console.error("Error creating budget allocation:", error);
        res.status(500).json({ message: "Failed to create budget allocation" });
      }
    }
  });

  app.post("/api/budget-allocations", requireAuth, async (req, res) => {
    try {
      const allocationData = insertBudgetAllocationSchema.parse(req.body);
      
      // Verify the budget belongs to the user
      const budget = await storage.getBudgetById(allocationData.budgetId);
      if (!budget || budget.userId !== req.user!.id) {
        return res.status(403).json({ message: "Invalid budget" });
      }
      
      // Verify the category belongs to the user
      const category = await storage.getExpenseCategoryById(allocationData.categoryId);
      if (!category || category.userId !== req.user!.id) {
        return res.status(403).json({ message: "Invalid category" });
      }
      
      // If subcategory is provided, verify it belongs to the category
      if (allocationData.subcategoryId) {
        const subcategory = await storage.getExpenseSubcategoryById(allocationData.subcategoryId);
        if (!subcategory || subcategory.categoryId !== allocationData.categoryId) {
          return res.status(403).json({ message: "Invalid subcategory" });
        }
      }
      
      const allocation = await storage.createBudgetAllocation(allocationData);
      
      // Log the budget allocation creation activity
      try {
        const { logActivity, ActivityDescriptions } = await import('./activity-logger');
        await logActivity({
          userId: req.user!.id,
          actionType: 'CREATE',
          resourceType: 'BUDGET_ALLOCATION',
          resourceId: allocation.id,
          description: ActivityDescriptions.createBudgetAllocation(budget.name, category.name, allocation.amount),
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'],
          metadata: { 
            budgetName: budget.name,
            categoryName: category.name,
            amount: allocation.amount,
            budgetId: budget.id,
            categoryId: category.id
          }
        });
      } catch (logError) {
        console.error('Failed to log budget allocation creation activity:', logError);
      }
      
      res.status(201).json(allocation);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error("Error creating budget allocation:", error);
        res.status(500).json({ message: "Failed to create budget allocation" });
      }
    }
  });

  app.patch("/api/budget-allocations/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const allocationData = insertBudgetAllocationSchema.parse(req.body);
      console.log('[DEBUG] PATCH budget allocation - ID:', id, 'Data:', allocationData, 'User:', req.user!.id);
      
      // Verify the budget belongs to the user
      const budget = await storage.getBudgetById(allocationData.budgetId);
      console.log('[DEBUG] Budget check:', budget ? { id: budget.id, userId: budget.userId } : 'not found');
      if (!budget || budget.userId !== req.user!.id) {
        return res.status(403).json({ message: "Invalid budget" });
      }
      
      // Verify the category belongs to the user or is a system category
      const category = await storage.getExpenseCategoryById(allocationData.categoryId);
      console.log('[DEBUG] Category check:', category ? { id: category.id, userId: category.userId, isSystem: category.isSystem } : 'not found');
      if (!category || (!category.isSystem && category.userId !== req.user!.id)) {
        console.log('[DEBUG] Category validation failed - isSystem:', category?.isSystem, 'userId match:', category?.userId === req.user!.id);
        return res.status(403).json({ message: "Invalid category" });
      }
      
      // If subcategory is provided, verify it belongs to the category
      if (allocationData.subcategoryId) {
        const subcategory = await storage.getExpenseSubcategoryById(allocationData.subcategoryId);
        if (!subcategory || subcategory.categoryId !== allocationData.categoryId) {
          return res.status(403).json({ message: "Invalid subcategory" });
        }
      }
      
      // Get the old allocation for logging
      const oldAllocation = await storage.getBudgetAllocations(allocationData.budgetId);
      const currentAllocation = oldAllocation.find(a => a.id === id);
      
      const updatedAllocation = await storage.updateBudgetAllocation(id, allocationData);
      
      // Log the budget allocation update activity
      try {
        const { logActivity, ActivityDescriptions } = await import('./activity-logger');
        await logActivity({
          userId: req.user!.id,
          actionType: 'UPDATE',
          resourceType: 'BUDGET_ALLOCATION',
          resourceId: id,
          description: ActivityDescriptions.updateBudgetAllocation(
            budget.name, 
            category.name, 
            currentAllocation?.amount || 0, 
            allocationData.amount
          ),
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'],
          metadata: { 
            budgetName: budget.name,
            categoryName: category.name,
            oldAmount: currentAllocation?.amount || 0,
            newAmount: allocationData.amount,
            budgetId: budget.id,
            categoryId: category.id
          }
        });
      } catch (logError) {
        console.error('Failed to log budget allocation update activity:', logError);
      }
      
      res.json(updatedAllocation);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error("Error updating budget allocation:", error);
        res.status(500).json({ message: "Failed to update budget allocation" });
      }
    }
  });

  app.delete("/api/budget-allocations/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Get allocation details before deletion for logging
      const budgets = await storage.getBudgetsByUserId(req.user!.id);
      let allocationToDelete = null;
      let budgetName = '';
      let categoryName = '';
      
      for (const budget of budgets) {
        const allocations = await storage.getBudgetAllocations(budget.id);
        const allocation = allocations.find(a => a.id === id);
        if (allocation) {
          allocationToDelete = allocation;
          budgetName = budget.name;
          categoryName = allocation.categoryName || 'Unknown';
          break;
        }
      }
      
      await storage.deleteBudgetAllocation(id);
      
      // Log the budget allocation deletion activity
      if (allocationToDelete) {
        try {
          const { logActivity, ActivityDescriptions } = await import('./activity-logger');
          await logActivity({
            userId: req.user!.id,
            actionType: 'DELETE',
            resourceType: 'BUDGET_ALLOCATION',
            resourceId: id,
            description: ActivityDescriptions.deleteBudgetAllocation(budgetName, categoryName, allocationToDelete.amount),
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.headers['user-agent'],
            metadata: { 
              budgetName: budgetName,
              categoryName: categoryName,
              amount: allocationToDelete.amount,
              budgetId: allocationToDelete.budgetId,
              categoryId: allocationToDelete.categoryId
            }
          });
        } catch (logError) {
          console.error('Failed to log budget allocation deletion activity:', logError);
        }
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting budget allocation:", error);
      res.status(500).json({ message: "Failed to delete budget allocation" });
    }
  });
  
  // -------------------------------------------------------------------------
  // Reports and Analytics Routes
  // -------------------------------------------------------------------------
  app.get("/api/reports/monthly-expenses/:year", requireAuth, async (req, res) => {
    try {
      const year = parseInt(req.params.year);
      const monthlyExpenses = await storage.getMonthlyExpenseTotals(req.user!.id, year);
      
      // Log activity for viewing monthly expense report
      try {
        const { logActivity, ActivityDescriptions } = await import('./activity-logger');
        await logActivity({
          userId: req.user!.id,
          actionType: 'VIEW',
          resourceType: 'REPORT',
          description: ActivityDescriptions.viewMonthlyExpenseReport(year),
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'],
          metadata: { 
            reportType: 'monthly-expenses',
            year: year,
            recordCount: monthlyExpenses.length
          }
        });
      } catch (logError) {
        console.error('Failed to log monthly expense report activity:', logError);
      }
      
      res.json(monthlyExpenses);
    } catch (error) {
      console.error("Error fetching monthly expense report:", error);
      res.status(500).json({ message: "Failed to fetch monthly expense report" });
    }
  });
  
  app.get("/api/reports/category-expenses", requireAuth, async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "Start date and end date are required" });
      }
      
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      
      const categoryExpenses = await storage.getCategoryExpenseTotals(req.user!.id, start, end);
      
      // Log activity for viewing category expense report
      try {
        const { logActivity, ActivityDescriptions } = await import('./activity-logger');
        await logActivity({
          userId: req.user!.id,
          actionType: 'VIEW',
          resourceType: 'REPORT',
          description: ActivityDescriptions.viewCategoryExpenseReport(),
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'],
          metadata: { 
            reportType: 'category-expenses',
            startDate: start.toISOString(),
            endDate: end.toISOString(),
            categoriesCount: categoryExpenses.length
          }
        });
      } catch (logError) {
        console.error('Failed to log category expense report activity:', logError);
      }
      
      res.json(categoryExpenses);
    } catch (error) {
      console.error("Error fetching category expense report:", error);
      res.status(500).json({ message: "Failed to fetch category expense report" });
    }
  });
  
  app.get("/api/reports/monthly-incomes/:year", requireAuth, async (req, res) => {
    try {
      const year = parseInt(req.params.year);
      const monthlyIncomes = await storage.getMonthlyIncomeTotals(req.user!.id, year);
      
      // Log activity for viewing monthly income report
      try {
        const { logActivity, ActivityDescriptions } = await import('./activity-logger');
        await logActivity({
          userId: req.user!.id,
          actionType: 'VIEW',
          resourceType: 'REPORT',
          description: ActivityDescriptions.viewMonthlyIncomeReport(year),
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'],
          metadata: { 
            reportType: 'monthly-incomes',
            year: year,
            recordCount: monthlyIncomes.length
          }
        });
      } catch (logError) {
        console.error('Failed to log monthly income report activity:', logError);
      }
      
      res.json(monthlyIncomes);
    } catch (error) {
      console.error("Error fetching monthly income report:", error);
      res.status(500).json({ message: "Failed to fetch monthly income report" });
    }
  });
  
  app.get("/api/reports/category-incomes", requireAuth, async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "Start date and end date are required" });
      }
      
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      
      const categoryIncomes = await storage.getCategoryIncomeTotals(req.user!.id, start, end);
      
      // Log activity for viewing category income report
      try {
        const { logActivity, ActivityDescriptions } = await import('./activity-logger');
        await logActivity({
          userId: req.user!.id,
          actionType: 'VIEW',
          resourceType: 'REPORT',
          description: ActivityDescriptions.viewCategoryIncomeReport(),
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'],
          metadata: { 
            reportType: 'category-incomes',
            startDate: start.toISOString(),
            endDate: end.toISOString(),
            categoriesCount: categoryIncomes.length
          }
        });
      } catch (logError) {
        console.error('Failed to log category income report activity:', logError);
      }
      
      res.json(categoryIncomes);
    } catch (error) {
      console.error("Error fetching category income report:", error);
      res.status(500).json({ message: "Failed to fetch category income report" });
    }
  });
  
  app.get("/api/reports/budget-performance/:budgetId", requireAuth, async (req, res) => {
    try {
      const budgetId = parseInt(req.params.budgetId);
      
      // Verify the budget belongs to the user
      const budget = await storage.getBudgetById(budgetId);
      if (!budget || budget.userId !== req.user!.id) {
        return res.status(403).json({ message: "Invalid budget" });
      }
      
      const performance = await storage.getBudgetPerformance(budgetId);
      
      // Log activity for viewing budget performance report
      try {
        const { logActivity, ActivityDescriptions } = await import('./activity-logger');
        await logActivity({
          userId: req.user!.id,
          actionType: 'VIEW',
          resourceType: 'REPORT',
          resourceId: budgetId,
          description: ActivityDescriptions.viewBudgetPerformanceReport(budget.name),
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'],
          metadata: { 
            reportType: 'budget-performance',
            budgetId: budgetId,
            budgetName: budget.name,
            performance: performance
          }
        });
      } catch (logError) {
        console.error('Failed to log budget performance report activity:', logError);
      }
      
      res.json(performance);
    } catch (error) {
      console.error("Error fetching budget performance:", error);
      res.status(500).json({ message: "Failed to fetch budget performance" });
    }
  });
  
  // -------------------------------------------------------------------------
  // User settings routes
  // -------------------------------------------------------------------------
  app.patch("/api/user/settings", requireAuth, async (req, res) => {
    try {
      const { currency } = req.body;
      const oldCurrency = req.user!.currency;
      
      console.log(`[DEBUG] Currency update request:`, {
        userId: req.user!.id,
        username: req.user!.username,
        oldCurrency,
        newCurrency: currency,
        timestamp: new Date().toISOString()
      });
      
      const updatedUser = await storage.updateUserSettings(req.user!.id, { currency });
      
      console.log(`[DEBUG] Currency updated successfully:`, {
        userId: req.user!.id,
        updatedCurrency: updatedUser.currency,
        confirmed: updatedUser.currency === currency
      });
      
      // Log activity for updating user settings
      try {
        const { logActivity, ActivityDescriptions } = await import('./activity-logger');
        await logActivity({
          userId: req.user!.id,
          actionType: 'UPDATE',
          resourceType: 'SETTINGS',
          description: ActivityDescriptions.updateUserSettings('currency', oldCurrency, currency),
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'],
          metadata: { 
            settingType: 'currency',
            oldValue: oldCurrency,
            newValue: currency
          }
        });
      } catch (logError) {
        console.error('Failed to log user settings update activity:', logError);
      }
      
      const { password, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error updating user settings:", error);
      res.status(500).json({ message: "Failed to update user settings" });
    }
  });

  // Update user profile information
  app.patch("/api/user/profile", requireAuth, async (req, res) => {
    try {
      const { name, email } = req.body;
      const oldName = req.user!.name;
      const oldEmail = req.user!.email;
      
      // For now, we'll just log the activity without updating the database
      // In a real implementation, you would update the user in the database
      
      // Log activity for profile updates
      try {
        const { logActivity, ActivityDescriptions } = await import('./activity-logger');
        
        if (name && name !== oldName) {
          await logActivity({
            userId: req.user!.id,
            actionType: 'UPDATE',
            resourceType: 'SETTINGS',
            description: ActivityDescriptions.updateProfileInfo('name', name),
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.headers['user-agent'],
            metadata: { 
              settingType: 'profile-name',
              oldValue: oldName,
              newValue: name
            }
          });
        }
        
        if (email && email !== oldEmail) {
          await logActivity({
            userId: req.user!.id,
            actionType: 'UPDATE',
            resourceType: 'SETTINGS',
            description: ActivityDescriptions.updateProfileInfo('email', email),
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.headers['user-agent'],
            metadata: { 
              settingType: 'profile-email',
              oldValue: oldEmail,
              newValue: email
            }
          });
        }
      } catch (logError) {
        console.error('Failed to log profile update activity:', logError);
      }
      
      // Return success response
      res.json({ message: 'Profile updated successfully', name, email });
    } catch (error) {
      console.error("Error updating user profile:", error);
      res.status(500).json({ message: "Failed to update user profile" });
    }
  });

  // Update notification settings
  app.patch("/api/user/notifications", requireAuth, async (req, res) => {
    try {
      const { emailNotifications, monthlyReport, budgetAlerts } = req.body;
      
      // Log activity for each notification setting change
      try {
        const { logActivity, ActivityDescriptions } = await import('./activity-logger');
        
        const settingChanges = [
          { key: 'emailNotifications', value: emailNotifications, label: 'Email' },
          { key: 'monthlyReport', value: monthlyReport, label: 'Monthly Report' },
          { key: 'budgetAlerts', value: budgetAlerts, label: 'Budget Alerts' }
        ];
        
        for (const setting of settingChanges) {
          if (setting.value !== undefined) {
            await logActivity({
              userId: req.user!.id,
              actionType: 'UPDATE',
              resourceType: 'SETTINGS',
              description: ActivityDescriptions.updateNotificationSetting(setting.label, setting.value),
              ipAddress: req.ip || req.connection.remoteAddress,
              userAgent: req.headers['user-agent'],
              metadata: { 
                settingType: `notification-${setting.key}`,
                newValue: setting.value,
                settingName: setting.label
              }
            });
          }
        }
      } catch (logError) {
        console.error('Failed to log notification settings update activity:', logError);
      }
      
      res.json({ 
        message: 'Notification settings updated successfully',
        emailNotifications,
        monthlyReport,
        budgetAlerts
      });
    } catch (error) {
      console.error("Error updating notification settings:", error);
      res.status(500).json({ message: "Failed to update notification settings" });
    }
  });

  // Log account actions (like logout)
  app.post("/api/user/account-action", requireAuth, async (req, res) => {
    try {
      const { action, metadata } = req.body;
      
      // Log the account action
      try {
        const { logActivity, ActivityDescriptions } = await import('./activity-logger');
        await logActivity({
          userId: req.user!.id,
          actionType: 'UPDATE',
          resourceType: 'SETTINGS',
          description: ActivityDescriptions.performAccountAction(action),
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'],
          metadata: { 
            actionType: action,
            ...metadata
          }
        });
      } catch (logError) {
        console.error('Failed to log account action activity:', logError);
      }
      
      res.json({ message: `Account action "${action}" logged successfully` });
    } catch (error) {
      console.error("Error logging account action:", error);
      res.status(500).json({ message: "Failed to log account action" });
    }
  });
  
  // -------------------------------------------------------------------------
  // Admin routes - now using permission-based authorization
  // -------------------------------------------------------------------------
  app.get("/api/admin/users", requirePermission("users:read"), async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      // Remove passwords from response
      const safeUsers = users.map(({ password, ...user }) => ({
        ...user,
        role: storage.getUserRole(user.id)
      }));
      
      res.json(safeUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });
  
  // Admin expenses management
  app.get("/api/admin/expenses", requirePermission("expenses:read_all"), async (req, res) => {
    try {
      const expenses = await storage.getAllExpenses();
      
      // Apply filters on the result if needed
      let filteredExpenses = expenses;
      const { search, userId, categoryId } = req.query;
      
      if (search) {
        const searchTerm = (search as string).toLowerCase();
        filteredExpenses = filteredExpenses.filter((expense: any) => 
          expense.description.toLowerCase().includes(searchTerm) ||
          (expense.merchant && expense.merchant.toLowerCase().includes(searchTerm)) ||
          (expense.notes && expense.notes.toLowerCase().includes(searchTerm))
        );
      }
      
      if (userId) {
        const userIdNum = parseInt(userId as string);
        filteredExpenses = filteredExpenses.filter((expense: any) => expense.user_id === userIdNum);
      }
      
      if (categoryId) {
        const categoryIdNum = parseInt(categoryId as string);
        filteredExpenses = filteredExpenses.filter((expense: any) => expense.category_id === categoryIdNum);
      }
      
      res.json(filteredExpenses);
    } catch (error) {
      console.error("Error fetching all expenses:", error);
      res.status(500).json({ message: "Failed to fetch expenses" });
    }
  });

  app.post("/api/admin/expenses", requirePermission("expenses:create"), async (req, res) => {
    try {
      const { userId, amount, description, date, categoryId, merchant, notes } = req.body;
      
      if (!userId || !amount || !description || !date || !categoryId) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const expense = await storage.createExpense({
        userId,
        amount,
        description,
        date: new Date(date),
        categoryId,
        merchant: merchant || null,
        notes: notes || null
      });

      res.status(201).json(expense);
    } catch (error) {
      console.error("Error creating expense:", error);
      res.status(500).json({ message: "Failed to create expense" });
    }
  });

  app.patch("/api/admin/expenses/:id", requirePermission("expenses:update"), async (req, res) => {
    try {
      const expenseId = parseInt(req.params.id);
      const { amount, description, date, categoryId, merchant, notes } = req.body;

      // Get the existing expense to get the userId
      const existingExpense = await storage.getExpenseById(expenseId);
      if (!existingExpense) {
        return res.status(404).json({ message: "Expense not found" });
      }

      const updatedExpense = await storage.updateExpense(expenseId, {
        userId: existingExpense.user_id,
        amount,
        description,
        date: new Date(date),
        categoryId,
        merchant: merchant || null,
        notes: notes || null
      });

      res.json(updatedExpense);
    } catch (error) {
      console.error("Error updating expense:", error);
      res.status(500).json({ message: "Failed to update expense" });
    }
  });

  app.delete("/api/admin/expenses/:id", requirePermission("expenses:delete"), async (req, res) => {
    try {
      const expenseId = parseInt(req.params.id);
      
      // Check if expense exists first
      const existingExpense = await storage.getExpenseById(expenseId);
      if (!existingExpense) {
        return res.status(404).json({ message: "Expense not found" });
      }

      await storage.deleteExpense(expenseId);
      res.json({ message: "Expense deleted successfully" });
    } catch (error) {
      console.error("Error deleting expense:", error);
      res.status(500).json({ message: "Failed to delete expense" });
    }
  });

  // Admin categories endpoint  
  app.get("/api/admin/categories", requirePermission("categories:read"), async (req, res) => {
    try {
      // Get all categories from all users (we'll need to create this method)
      const result = await pool.query(`
        SELECT DISTINCT id, name, description, is_system 
        FROM expense_categories 
        WHERE is_system = true OR user_id IS NULL
        ORDER BY name
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });
  
  app.get("/api/admin/incomes", requirePermission("expenses:read_all"), async (req, res) => {
    try {
      const incomes = await storage.getAllIncomes();
      res.json(incomes);
    } catch (error) {
      console.error("Error fetching all incomes:", error);
      res.status(500).json({ message: "Failed to fetch incomes" });
    }
  });
  
  app.get("/api/admin/budgets", requirePermission("budgets:read_all"), async (req, res) => {
    try {
      const { 
        search, 
        userId, 
        period, 
        status,
        limit, 
        offset 
      } = req.query;

      // Collect all budgets from all users
      const users = await storage.getAllUsers();
      let allBudgets = [];
      
      for (const user of users) {
        const budgets = await storage.getBudgetsByUserId(user.id);
        // Add user information, budget allocations, and expense categories to each budget
        const augmentedBudgets = await Promise.all(budgets.map(async budget => {
          // Get budget allocations (planned categories)
          const allocations = await storage.getBudgetAllocations(budget.id);
          
          // Get expenses for this budget to find actual expense categories
          const userExpenses = await storage.getExpensesByUserId(user.id);
          const budgetExpenses = userExpenses.filter(expense => expense.budgetId === budget.id);
          
          // Create a map to track all categories (allocated + expense-only)
          const categoryMap = new Map();
          
          // Add allocated categories
          allocations.forEach(allocation => {
            categoryMap.set(allocation.categoryId, {
              id: allocation.categoryId,
              name: allocation.categoryName,
              allocatedAmount: allocation.amount,
              spentAmount: 0,
              isAllocated: true
            });
          });
          
          // Add expense categories and calculate spent amounts
          budgetExpenses.forEach(expense => {
            const categoryId = expense.categoryId;
            if (categoryMap.has(categoryId)) {
              // Update spent amount for allocated category
              categoryMap.get(categoryId).spentAmount += expense.amount;
            } else {
              // Add unallocated category that has expenses
              categoryMap.set(categoryId, {
                id: categoryId,
                name: expense.category_name || 'Unknown Category',
                allocatedAmount: 0,
                spentAmount: expense.amount,
                isAllocated: false
              });
            }
          });
          
          return {
            ...budget,
            userName: user.name,
            userEmail: user.email,
            categories: Array.from(categoryMap.values())
          };
        }));
        allBudgets.push(...augmentedBudgets);
      }

      // Apply filters
      if (search) {
        const searchLower = search.toString().toLowerCase();
        allBudgets = allBudgets.filter(budget => 
          budget.name.toLowerCase().includes(searchLower) ||
          budget.userName.toLowerCase().includes(searchLower) ||
          budget.userEmail.toLowerCase().includes(searchLower)
        );
      }

      if (userId) {
        allBudgets = allBudgets.filter(budget => budget.userId === parseInt(userId.toString()));
      }

      if (period) {
        allBudgets = allBudgets.filter(budget => budget.period === period);
      }

      if (status) {
        const now = new Date();
        allBudgets = allBudgets.filter(budget => {
          const isActive = (!budget.endDate || new Date(budget.endDate) >= now) && 
                          new Date(budget.startDate) <= now;
          
          if (status === 'active') return isActive;
          if (status === 'expired') return !isActive;
          return true;
        });
      }

      // Sort by creation date (newest first)
      allBudgets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Apply pagination
      const totalBudgets = allBudgets.length;
      if (limit) {
        const limitNum = parseInt(limit.toString());
        const offsetNum = offset ? parseInt(offset.toString()) : 0;
        allBudgets = allBudgets.slice(offsetNum, offsetNum + limitNum);
      }
      
      res.json({
        budgets: allBudgets,
        totalCount: totalBudgets,
        hasMore: limit ? (parseInt(offset?.toString() || '0') + parseInt(limit.toString())) < totalBudgets : false
      });
    } catch (error) {
      console.error("Error fetching all budgets:", error);
      res.status(500).json({ message: "Failed to fetch budgets" });
    }
  });

  // Admin budget CRUD endpoints
  app.get("/api/admin/budgets/:id", requirePermission("budgets:read_all"), async (req, res) => {
    try {
      const budgetId = parseInt(req.params.id);
      const budget = await storage.getBudgetById(budgetId);
      
      if (!budget) {
        return res.status(404).json({ message: "Budget not found" });
      }

      // Get user information
      const user = await storage.getUser(budget.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const budgetWithUser = {
        ...budget,
        userName: user.name,
        userEmail: user.email
      };

      res.json(budgetWithUser);
    } catch (error) {
      console.error("Error fetching budget by ID:", error);
      res.status(500).json({ message: "Failed to fetch budget" });
    }
  });

  app.post("/api/admin/budgets", requirePermission("budgets:create"), async (req, res) => {
    try {
      const { name, amount, period, userId, startDate, endDate } = req.body;

      if (!name || !amount || !period || !userId) {
        return res.status(400).json({ 
          message: "Name, amount, period, and userId are required" 
        });
      }

      // Validate user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      const newBudget = await storage.createBudget({
        name,
        amount,
        period,
        userId,
        startDate: startDate || new Date(),
        endDate
      });

      // Log activity
      const { logActivity } = await import('./activity-logger');
      await logActivity({
        userId: req.user!.id,
        actionType: 'CREATE',
        resourceType: 'BUDGET',
        resourceId: newBudget.id,
        description: `Admin created budget "${name}" for user ${user.name} with amount $${amount}`,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        metadata: {
          budgetId: newBudget.id,
          targetUserId: userId,
          amount,
          period
        }
      });

      const budgetWithUser = {
        ...newBudget,
        userName: user.name,
        userEmail: user.email
      };

      res.status(201).json(budgetWithUser);
    } catch (error) {
      console.error("Error creating budget:", error);
      res.status(500).json({ message: "Failed to create budget" });
    }
  });

  app.patch("/api/admin/budgets/:id", requirePermission("budgets:update"), async (req, res) => {
    try {
      const budgetId = parseInt(req.params.id);
      const { name, amount, period, startDate, endDate, userId } = req.body;

      // Get existing budget
      const existingBudget = await storage.getBudgetById(budgetId);
      if (!existingBudget) {
        return res.status(404).json({ message: "Budget not found" });
      }

      // If userId is being changed, validate the new user
      if (userId && userId !== existingBudget.userId) {
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(400).json({ message: "Invalid user ID" });
        }
      }

      const updatedBudget = await storage.updateBudget(budgetId, {
        name: name || existingBudget.name,
        amount: amount !== undefined ? amount : existingBudget.amount,
        period: period || existingBudget.period,
        startDate: startDate || existingBudget.startDate,
        endDate: endDate || existingBudget.endDate
      });

      // Get user information for response
      const targetUserId = userId || existingBudget.userId;
      const user = await storage.getUser(targetUserId);
      
      // Log activity
      const { logActivity } = await import('./activity-logger');
      await logActivity({
        userId: req.user!.id,
        actionType: 'UPDATE',
        resourceType: 'BUDGET',
        resourceId: budgetId,
        description: `Admin updated budget "${updatedBudget.name}" for user ${user?.name || 'Unknown'}`,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        metadata: {
          budgetId,
          targetUserId,
          changes: { name, amount, period, startDate, endDate }
        }
      });

      const budgetWithUser = {
        ...updatedBudget,
        userName: user?.name || 'Unknown',
        userEmail: user?.email || 'Unknown'
      };

      res.json(budgetWithUser);
    } catch (error) {
      console.error("Error updating budget:", error);
      res.status(500).json({ message: "Failed to update budget" });
    }
  });

  app.delete("/api/admin/budgets/:id", requirePermission("budgets:delete"), async (req, res) => {
    try {
      const budgetId = parseInt(req.params.id);

      // Get budget info before deletion for logging
      const existingBudget = await storage.getBudgetById(budgetId);
      if (!existingBudget) {
        return res.status(404).json({ message: "Budget not found" });
      }

      const user = await storage.getUser(existingBudget.userId);

      await storage.deleteBudget(budgetId);

      // Log activity
      const { logActivity } = await import('./activity-logger');
      await logActivity({
        userId: req.user!.id,
        actionType: 'DELETE',
        resourceType: 'BUDGET',
        resourceId: budgetId,
        description: `Admin deleted budget "${existingBudget.name}" for user ${user?.name || 'Unknown'}`,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        metadata: {
          budgetId,
          targetUserId: existingBudget.userId,
          budgetName: existingBudget.name,
          amount: existingBudget.amount
        }
      });

      res.status(200).json({ message: "Budget deleted successfully" });
    } catch (error) {
      console.error("Error deleting budget:", error);
      res.status(500).json({ message: "Failed to delete budget" });
    }
  });
  
  app.patch("/api/admin/users/:id/role", requirePermission("users:update"), async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { role } = req.body;
      
      if (!role) {
        return res.status(400).json({ message: "Role is required" });
      }

      // Validate role
      const allRoles = await storage.getAllRoles();
      const validRoleNames = allRoles.map(r => r.name);
      if (!validRoleNames.includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }
      
      await storage.setUserRole(userId, role);
      res.status(200).json({ message: "User role updated" });
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Failed to update user role" });
    }
  });
  
  // Delete user endpoint for administrators
  app.delete("/api/admin/users/:id", requirePermission("users:delete"), async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Check if user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Prevent deleting your own account
      if (userId === req.user!.id) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }
      
      // Delete user and all associated data
      await storage.deleteUser(userId);
      
      res.status(200).json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Create new user endpoint for administrators
  app.post("/api/admin/users", requirePermission("users:create"), async (req, res) => {
    try {
      const { username, name, email, password, role = 'user' } = req.body;
      
      if (!username || !name || !email || !password) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Validate role
      const allRoles = await storage.getAllRoles();
      const validRoleNames = allRoles.map(r => r.name);
      if (!validRoleNames.includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      // Check if username or email already exists
      const existingUser = await storage.getUserByUsernameOrEmail(username, email);
      if (existingUser) {
        return res.status(409).json({ message: "Username or email already exists" });
      }

      // Hash password
      const { hashPassword } = await import('./password');
      const hashedPassword = await hashPassword(password);

      const newUser = await storage.createUser({
        username,
        name,
        email,
        password: hashedPassword
      });

      // Set role if not default
      if (role !== 'user') {
        await storage.setUserRole(newUser.id, role);
      }

      // Return user without password
      const { password: _, ...safeUser } = newUser;
      res.status(201).json({ ...safeUser, role });
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // Update user endpoint for administrators
  app.patch("/api/admin/users/:id", requirePermission("users:update"), async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { name, email, role, status } = req.body;
      
      // Check if user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Validate role if provided
      if (role) {
        const allRoles = await storage.getAllRoles();
        const validRoleNames = allRoles.map(r => r.name);
        if (!validRoleNames.includes(role)) {
          return res.status(400).json({ message: "Invalid role" });
        }
      }

      if (status && !['active', 'suspended'].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const updatedUser = await storage.updateUser(userId, { name, email, role, status });
      
      // Return user without password
      const { password: _, ...safeUser } = updatedUser;
      res.json(safeUser);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Suspend user endpoint
  app.patch("/api/admin/users/:id/suspend", requirePermission("users:suspend"), async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Prevent suspending your own account
      if (userId === req.user!.id) {
        return res.status(400).json({ message: "Cannot suspend your own account" });
      }

      await storage.suspendUser(userId);
      res.json({ message: "User suspended successfully" });
    } catch (error) {
      console.error("Error suspending user:", error);
      res.status(500).json({ message: "Failed to suspend user" });
    }
  });

  // Reactivate user endpoint
  app.patch("/api/admin/users/:id/reactivate", requirePermission("users:suspend"), async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      await storage.reactivateUser(userId);
      res.json({ message: "User reactivated successfully" });
    } catch (error) {
      console.error("Error reactivating user:", error);
      res.status(500).json({ message: "Failed to reactivate user" });
    }
  });

  // Reset user password endpoint
  app.patch("/api/admin/users/:id/reset-password", requirePermission("users:update"), async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { password, generateTemporary = false } = req.body;
      
      let newPassword = password;
      
      // Generate temporary password if requested
      if (generateTemporary) {
        const crypto = await import('crypto');
        newPassword = crypto.randomBytes(8).toString('hex');
      }

      if (!newPassword) {
        return res.status(400).json({ message: "Password is required" });
      }

      // Hash password
      const { hashPassword } = await import('./password');
      const hashedPassword = await hashPassword(newPassword);

      await storage.resetUserPassword(userId, hashedPassword);
      
      res.json({ 
        message: "Password reset successfully",
        ...(generateTemporary && { temporaryPassword: newPassword })
      });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // Search users endpoint
  app.get("/api/admin/users/search", requirePermission("users:read"), async (req, res) => {
    try {
      const query = req.query.q as string || '';
      const role = req.query.role as string;
      const status = req.query.status as string;
      
      const users = await storage.searchUsers(query, { role, status });
      
      // Remove passwords from response
      const safeUsers = users.map(({ password, ...user }) => user);
      res.json(safeUsers);
    } catch (error) {
      console.error("Error searching users:", error);
      res.status(500).json({ message: "Failed to search users" });
    }
  });

  // Get user statistics endpoint
  app.get("/api/admin/stats", requirePermission("admin:stats"), async (req, res) => {
    try {
      const userStats = await storage.getUserStats();
      res.json(userStats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });

  // -------------------------------------------------------------------------
  // Analytics & Dashboard Routes
  // -------------------------------------------------------------------------

  // Get comprehensive analytics dashboard data
  app.get("/api/admin/analytics/overview", requirePermission("admin:stats"), async (req, res) => {
    try {
      const analytics = await storage.getAnalyticsOverview();
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching analytics overview:", error);
      res.status(500).json({ message: "Failed to fetch analytics overview" });
    }
  });

  // Get daily active users analytics
  app.get("/api/admin/analytics/daily-active-users", requirePermission("admin:stats"), async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const dailyActiveUsers = await storage.getDailyActiveUsers(days);
      res.json(dailyActiveUsers);
    } catch (error) {
      console.error("Error fetching daily active users:", error);
      res.status(500).json({ message: "Failed to fetch daily active users" });
    }
  });

  // Get expense trends analytics
  app.get("/api/admin/analytics/expense-trends", requirePermission("admin:stats"), async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const expenseTrends = await storage.getExpenseTrends(days);
      res.json(expenseTrends);
    } catch (error) {
      console.error("Error fetching expense trends:", error);
      res.status(500).json({ message: "Failed to fetch expense trends" });
    }
  });

  // Get top expense categories
  app.get("/api/admin/analytics/top-categories", requirePermission("admin:stats"), async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const topCategories = await storage.getTopExpenseCategories(limit);
      res.json(topCategories);
    } catch (error) {
      console.error("Error fetching top categories:", error);
      res.status(500).json({ message: "Failed to fetch top categories" });
    }
  });

  // Get recent activity for dashboard
  app.get("/api/admin/analytics/recent-activity", requirePermission("admin:stats"), async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const recentActivity = await storage.getRecentActivity(limit);
      res.json(recentActivity);
    } catch (error) {
      console.error("Error fetching recent activity:", error);
      res.status(500).json({ message: "Failed to fetch recent activity" });
    }
  });

  // Export data as CSV
  app.get("/api/admin/reports/export/csv", requirePermission("admin:stats"), async (req, res) => {
    try {
      const reportType = req.query.type as string || 'users';
      const csvData = await storage.exportToCSV(reportType);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${reportType}-export-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvData);
    } catch (error) {
      console.error("Error exporting CSV:", error);
      res.status(500).json({ message: "Failed to export CSV" });
    }
  });

  // Export data as JSON for PDF generation
  app.get("/api/admin/reports/export/json", requirePermission("admin:stats"), async (req, res) => {
    try {
      const reportType = req.query.type as string || 'overview';
      const jsonData = await storage.exportToJSON(reportType);
      res.json(jsonData);
    } catch (error) {
      console.error("Error exporting JSON:", error);
      res.status(500).json({ message: "Failed to export JSON" });
    }
  });

  // -------------------------------------------------------------------------
  // Admin History & Audit Routes
  // -------------------------------------------------------------------------

  // Get comprehensive admin history with advanced filtering
  app.get("/api/admin/history", requirePermission("admin:stats"), async (req, res) => {
    try {
      const filters = {
        search: req.query.search as string || '',
        userId: req.query.userId ? parseInt(req.query.userId as string) : undefined,
        category: req.query.category as string || '',
        activityType: req.query.activityType as string || '',
        startDate: req.query.startDate as string || '',
        endDate: req.query.endDate as string || '',
        minAmount: req.query.minAmount ? parseFloat(req.query.minAmount as string) : undefined,
        maxAmount: req.query.maxAmount ? parseFloat(req.query.maxAmount as string) : undefined,
        page: parseInt(req.query.page as string) || 1,
        limit: Math.min(parseInt(req.query.limit as string) || 50, 100)
      };

      const history = await storage.getAdminHistory(filters);
      res.json(history);
    } catch (error) {
      console.error("Error fetching admin history:", error);
      res.status(500).json({ message: "Failed to fetch admin history" });
    }
  });

  // Get filter options for admin history (users, categories, activity types)
  app.get("/api/admin/history/filters", requirePermission("admin:stats"), async (req, res) => {
    try {
      const filterOptions = await storage.getHistoryFilterOptions();
      res.json(filterOptions);
    } catch (error) {
      console.error("Error fetching history filter options:", error);
      res.status(500).json({ message: "Failed to fetch filter options" });
    }
  });

  // Export admin history as CSV
  app.get("/api/admin/history/export", requirePermission("admin:stats"), async (req, res) => {
    try {
      const filters = {
        search: req.query.search as string || '',
        userId: req.query.userId ? parseInt(req.query.userId as string) : undefined,
        category: req.query.category as string || '',
        activityType: req.query.activityType as string || '',
        startDate: req.query.startDate as string || '',
        endDate: req.query.endDate as string || '',
        minAmount: req.query.minAmount ? parseFloat(req.query.minAmount as string) : undefined,
        maxAmount: req.query.maxAmount ? parseFloat(req.query.maxAmount as string) : undefined
      };

      const csvData = await storage.exportAdminHistory(filters);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="admin-history-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvData);
    } catch (error) {
      console.error("Error exporting admin history:", error);
      res.status(500).json({ message: "Failed to export admin history" });
    }
  });

  // Get admin history statistics/summary
  app.get("/api/admin/history/stats", requirePermission("admin:stats"), async (req, res) => {
    try {
      const filters = {
        search: req.query.search as string || '',
        userId: req.query.userId ? parseInt(req.query.userId as string) : undefined,
        category: req.query.category as string || '',
        activityType: req.query.activityType as string || '',
        startDate: req.query.startDate as string || '',
        endDate: req.query.endDate as string || '',
        minAmount: req.query.minAmount ? parseFloat(req.query.minAmount as string) : undefined,
        maxAmount: req.query.maxAmount ? parseFloat(req.query.maxAmount as string) : undefined
      };

      const stats = await storage.getHistoryStats(filters);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching history stats:", error);
      res.status(500).json({ message: "Failed to fetch history stats" });
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
      
      // Check if user is admin with user_id = 14
      const isAdmin = userId === 14;
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

  // ========== ROLE MANAGEMENT ROUTES ==========
  
  // Get all roles with their permissions
  app.get("/api/admin/roles", requirePermission("admin:roles"), async (req, res) => {
    try {
      const roles = await storage.getAllRolesWithPermissions();
      res.json(roles);
    } catch (error) {
      console.error("Error fetching roles:", error);
      res.status(500).json({ message: "Failed to fetch roles" });
    }
  });

  // Get all available permissions
  app.get("/api/admin/permissions", requirePermission("admin:roles"), async (req, res) => {
    try {
      const permissions = await storage.getAllPermissions();
      res.json(permissions);
    } catch (error) {
      console.error("Error fetching permissions:", error);
      res.status(500).json({ message: "Failed to fetch permissions" });
    }
  });

  // Create a new role
  app.post("/api/admin/roles", requirePermission("admin:roles"), async (req, res) => {
    try {
      const { name, description, permissionIds } = req.body;
      
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ message: "Role name is required" });
      }

      if (permissionIds && !Array.isArray(permissionIds)) {
        return res.status(400).json({ message: "Permission IDs must be an array" });
      }

      const role = await storage.createRole({ name, description });
      
      if (permissionIds && permissionIds.length > 0) {
        await storage.setRolePermissions(role.id, permissionIds);
      }

      const roleWithPermissions = await storage.getRoleById(role.id);
      res.status(201).json(roleWithPermissions);
    } catch (error) {
      console.error("Error creating role:", error);
      if (error instanceof Error && error.message.includes('duplicate')) {
        res.status(409).json({ message: "Role name already exists" });
      } else {
        res.status(500).json({ message: "Failed to create role" });
      }
    }
  });

  // Update a role
  app.patch("/api/admin/roles/:id", requirePermission("admin:roles"), async (req, res) => {
    try {
      const roleId = parseInt(req.params.id);
      const { name, description, permissionIds } = req.body;

      if (isNaN(roleId)) {
        return res.status(400).json({ message: "Invalid role ID" });
      }

      // Update basic role info if provided
      if (name || description) {
        await storage.updateRole(roleId, { name, description });
      }

      // Update permissions if provided
      if (permissionIds && Array.isArray(permissionIds)) {
        await storage.setRolePermissions(roleId, permissionIds);
      }

      const updatedRole = await storage.getRoleById(roleId);
      if (!updatedRole) {
        return res.status(404).json({ message: "Role not found" });
      }

      res.json(updatedRole);
    } catch (error) {
      console.error("Error updating role:", error);
      res.status(500).json({ message: "Failed to update role" });
    }
  });

  // Update a role (PUT method for REST compliance)
  app.put("/api/admin/roles/:id", requirePermission("admin:roles"), async (req, res) => {
    try {
      const roleId = parseInt(req.params.id);
      const { name, description, permissionIds } = req.body;

      if (isNaN(roleId)) {
        return res.status(400).json({ message: "Invalid role ID" });
      }

      // Update basic role info if provided
      if (name || description) {
        await storage.updateRole(roleId, { name, description });
      }

      // Update permissions if provided
      if (permissionIds && Array.isArray(permissionIds)) {
        await storage.setRolePermissions(roleId, permissionIds);
      }

      const updatedRole = await storage.getRoleById(roleId);
      if (!updatedRole) {
        return res.status(404).json({ message: "Role not found" });
      }

      res.json(updatedRole);
    } catch (error) {
      console.error("Error updating role:", error);
      res.status(500).json({ message: "Failed to update role" });
    }
  });

  // Delete a role
  app.delete("/api/admin/roles/:id", requirePermission("admin:roles"), async (req, res) => {
    try {
      const roleId = parseInt(req.params.id);

      if (isNaN(roleId)) {
        return res.status(400).json({ message: "Invalid role ID" });
      }

      // Check if role is a system role
      const role = await storage.getRoleById(roleId);
      if (!role) {
        return res.status(404).json({ message: "Role not found" });
      }

      if (role.isSystem) {
        return res.status(400).json({ message: "Cannot delete system roles" });
      }

      // Check if role is assigned to any users
      const usersWithRole = await storage.getUsersByRole(roleId);
      if (usersWithRole.length > 0) {
        return res.status(400).json({ 
          message: "Cannot delete role that is assigned to users",
          users: usersWithRole.map((u: any) => u.username)
        });
      }

      await storage.deleteRole(roleId);
      res.json({ message: "Role deleted successfully" });
    } catch (error) {
      console.error("Error deleting role:", error);
      res.status(500).json({ message: "Failed to delete role" });
    }
  });

  // Assign permission to role
  app.post("/api/admin/roles/:id/permissions", requirePermission("admin:roles"), async (req, res) => {
    try {
      const roleId = parseInt(req.params.id);
      const { permissionIds } = req.body;

      if (isNaN(roleId)) {
        return res.status(400).json({ message: "Invalid role ID" });
      }

      if (!Array.isArray(permissionIds)) {
        return res.status(400).json({ message: "Permission IDs must be an array" });
      }

      await storage.setRolePermissions(roleId, permissionIds);
      res.json({ message: "Permissions assigned successfully" });
    } catch (error) {
      console.error("Error assigning permissions:", error);
      res.status(500).json({ message: "Failed to assign permissions" });
    }
  });

  // Remove permission from role
  app.delete("/api/admin/roles/:id/permissions/:permId", requirePermission("admin:roles"), async (req, res) => {
    try {
      const roleId = parseInt(req.params.id);
      const permissionId = parseInt(req.params.permId);

      if (isNaN(roleId) || isNaN(permissionId)) {
        return res.status(400).json({ message: "Invalid role ID or permission ID" });
      }

      // Get current permissions and remove the specified one
      const role = await storage.getRoleById(roleId);
      if (!role) {
        return res.status(404).json({ message: "Role not found" });
      }

      const currentPermissions = await storage.getRolePermissions(roleId);
      const updatedPermissionIds = currentPermissions
        .filter((p: any) => p.id !== permissionId)
        .map((p: any) => p.id);

      await storage.setRolePermissions(roleId, updatedPermissionIds);
      res.json({ message: "Permission removed successfully" });
    } catch (error) {
      console.error("Error removing permission:", error);
      res.status(500).json({ message: "Failed to remove permission" });
    }
  });

  // Assign role to user
  app.post("/api/admin/users/:id/roles", requirePermission("users:update"), async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { roleId } = req.body;

      if (isNaN(userId) || isNaN(roleId)) {
        return res.status(400).json({ message: "Invalid user ID or role ID" });
      }

      await storage.assignRoleToUser(userId, roleId);
      res.json({ message: "Role assigned successfully" });
    } catch (error) {
      console.error("Error assigning role:", error);
      res.status(500).json({ message: "Failed to assign role" });
    }
  });

  // Assign role to user (alternative endpoint for compatibility)
  app.post("/api/admin/users/:userId/roles/:roleId", requirePermission("users:update"), async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const roleId = parseInt(req.params.roleId);

      if (isNaN(userId) || isNaN(roleId)) {
        return res.status(400).json({ message: "Invalid user ID or role ID" });
      }

      await storage.assignRoleToUser(userId, roleId);
      res.json({ message: "Role assigned successfully" });
    } catch (error) {
      console.error("Error assigning role:", error);
      res.status(500).json({ message: "Failed to assign role" });
    }
  });

  // Remove role from user
  app.delete("/api/admin/users/:userId/roles/:roleId", requirePermission("users:update"), async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const roleId = parseInt(req.params.roleId);

      if (isNaN(userId) || isNaN(roleId)) {
        return res.status(400).json({ message: "Invalid user ID or role ID" });
      }

      await storage.removeRoleFromUser(userId, roleId);
      res.json({ message: "Role removed successfully" });
    } catch (error) {
      console.error("Error removing role:", error);
      res.status(500).json({ message: "Failed to remove role" });
    }
  });

  // Get user's roles and permissions
  app.get("/api/admin/users/:userId/permissions", requirePermission("users:read"), async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);

      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      const userPermissions = await storage.getUserPermissions(userId);
      const userRoles = await storage.getUserRoles(userId);

      res.json({
        user_id: userId,
        roles: userRoles,
        permissions: userPermissions
      });
    } catch (error) {
      console.error("Error fetching user permissions:", error);
      res.status(500).json({ message: "Failed to fetch user permissions" });
    }
  });

  // ===== SYSTEM SETTINGS ROUTES =====
  
  // Get all system settings (admin only)
  app.get("/api/admin/settings", requirePermission("admin:settings"), async (req, res) => {
    try {
      const settings = await storage.getSystemSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching system settings:", error);
      res.status(500).json({ message: "Failed to fetch system settings" });
    }
  });

  // Get system settings grouped by category (admin only)
  app.get("/api/admin/settings/categories", requirePermission("admin:settings"), async (req, res) => {
    try {
      const settings = await storage.getSystemSettingsByCategory();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching system settings by category:", error);
      res.status(500).json({ message: "Failed to fetch system settings" });
    }
  });

  // Get public system settings (accessible to all authenticated users)
  app.get("/api/settings/public", requireAuth, async (req, res) => {
    try {
      const settings = await storage.getPublicSystemSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching public system settings:", error);
      res.status(500).json({ message: "Failed to fetch public settings" });
    }
  });

  // Get a specific system setting (admin only)
  app.get("/api/admin/settings/:key", requirePermission("admin:settings"), async (req, res) => {
    try {
      const { key } = req.params;
      const setting = await storage.getSystemSetting(key);
      
      if (!setting) {
        return res.status(404).json({ message: "Setting not found" });
      }
      
      res.json(setting);
    } catch (error) {
      console.error("Error fetching system setting:", error);
      res.status(500).json({ message: "Failed to fetch system setting" });
    }
  });

  // Update a system setting (admin only)
  app.patch("/api/admin/settings/:key", requirePermission("admin:settings"), async (req, res) => {
    try {
      const { key } = req.params;
      const { value, description } = req.body;

      if (value === undefined) {
        return res.status(400).json({ message: "Setting value is required" });
      }

      // Get the current setting to validate the type
      const currentSetting = await storage.getSystemSetting(key);
      if (!currentSetting) {
        return res.status(404).json({ message: "Setting not found" });
      }

      // Validate the value based on the setting type
      if (!storage.validateSettingValue(value, currentSetting.settingType)) {
        return res.status(400).json({ 
          message: `Invalid value for setting type '${currentSetting.settingType}'` 
        });
      }

      const updatedSetting = await storage.updateSystemSetting(key, value, description);
      
      if (!updatedSetting) {
        return res.status(404).json({ message: "Setting not found" });
      }

      res.json(updatedSetting);
    } catch (error) {
      console.error("Error updating system setting:", error);
      res.status(500).json({ message: "Failed to update system setting" });
    }
  });

  // Update multiple system settings (admin only)
  app.patch("/api/admin/settings", requirePermission("admin:settings"), async (req, res) => {
    try {
      const { updates } = req.body;

      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({ message: "Updates array is required" });
      }

      // Validate all updates first
      for (const update of updates) {
        if (!update.key || update.value === undefined) {
          return res.status(400).json({ 
            message: "Each update must have 'key' and 'value' properties" 
          });
        }

        const currentSetting = await storage.getSystemSetting(update.key);
        if (!currentSetting) {
          return res.status(404).json({ message: `Setting '${update.key}' not found` });
        }

        if (!storage.validateSettingValue(update.value, currentSetting.settingType)) {
          return res.status(400).json({ 
            message: `Invalid value for setting '${update.key}' of type '${currentSetting.settingType}'` 
          });
        }
      }

      const updatedSettings = await storage.updateMultipleSystemSettings(updates);
      res.json(updatedSettings);
    } catch (error) {
      console.error("Error updating multiple system settings:", error);
      res.status(500).json({ message: "Failed to update system settings" });
    }
  });

  // Create a new system setting (admin only)
  app.post("/api/admin/settings", requirePermission("admin:settings"), async (req, res) => {
    try {
      const { settingKey, settingValue, settingType, category, description, isPublic } = req.body;

      if (!settingKey || !category || settingValue === undefined) {
        return res.status(400).json({ 
          message: "Setting key, value, and category are required" 
        });
      }

      // Validate the value based on the setting type
      const type = settingType || 'text';
      if (!storage.validateSettingValue(settingValue, type)) {
        return res.status(400).json({ 
          message: `Invalid value for setting type '${type}'` 
        });
      }

      const newSetting = await storage.createSystemSetting({
        settingKey,
        settingValue,
        settingType: type,
        category,
        description,
        isPublic: isPublic || false
      });

      res.status(201).json(newSetting);
    } catch (error) {
      console.error("Error creating system setting:", error);
      if (error instanceof Error && error.message.includes('duplicate')) {
        res.status(409).json({ message: "Setting key already exists" });
      } else {
        res.status(500).json({ message: "Failed to create system setting" });
      }
    }
  });

  // Delete a system setting (admin only)
  app.delete("/api/admin/settings/:key", requirePermission("admin:settings"), async (req, res) => {
    try {
      const { key } = req.params;
      
      const deleted = await storage.deleteSystemSetting(key);
      
      if (!deleted) {
        return res.status(404).json({ message: "Setting not found" });
      }

      res.json({ message: "Setting deleted successfully" });
    } catch (error) {
      console.error("Error deleting system setting:", error);
      res.status(500).json({ message: "Failed to delete system setting" });
    }
  });

  // ===== END SYSTEM SETTINGS ROUTES =====

  const httpServer = createServer(app);

  return httpServer;
}
