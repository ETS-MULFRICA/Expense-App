import { pgTable, text, serial, integer, boolean, timestamp, doublePrecision, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  currency: text("currency").default('XAF'),
  role: text("role").default('user'),
  status: text("status").default('active'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Main categories table
export const expenseCategories = pgTable("expense_categories", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  isSystem: boolean("is_system").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Subcategories table
export const expenseSubcategories = pgTable("expense_subcategories", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").notNull().references(() => expenseCategories.id),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  isSystem: boolean("is_system").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Income categories table
export const incomeCategories = pgTable("income_categories", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  isSystem: boolean("is_system").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Income subcategories table
export const incomeSubcategories = pgTable("income_subcategories", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").notNull().references(() => incomeCategories.id),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  isSystem: boolean("is_system").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Updated expenses table with category/subcategory references
export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  amount: doublePrecision("amount").notNull(),
  description: text("description").notNull(),
  date: timestamp("date").notNull(),
  categoryId: integer("category_id").notNull().references(() => expenseCategories.id),
  subcategoryId: integer("subcategory_id").references(() => expenseSubcategories.id),
  budgetId: integer("budget_id").references(() => budgets.id),
  merchant: text("merchant"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Income table
export const incomes = pgTable("incomes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  amount: doublePrecision("amount").notNull(),
  description: text("description").notNull(),
  date: timestamp("date").notNull(),
  categoryId: integer("category_id").references(() => incomeCategories.id), // Made nullable for custom categories
  categoryName: text("category_name"), // Added to store custom category names
  subcategoryId: integer("subcategory_id").references(() => incomeSubcategories.id),
  source: text("source"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Budget planning table
export const budgets = pgTable("budgets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  period: text("period").notNull().default("monthly"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  amount: doublePrecision("amount").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Budget category allocations
export const budgetAllocations = pgTable("budget_allocations", {
  id: serial("id").primaryKey(),
  budgetId: integer("budget_id").notNull().references(() => budgets.id),
  categoryId: integer("category_id").notNull().references(() => expenseCategories.id),
  subcategoryId: integer("subcategory_id").references(() => expenseSubcategories.id),
  amount: doublePrecision("amount").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Zod schemas for validation
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  name: true,
  email: true,
});

// Category schemas
export const insertExpenseCategorySchema = createInsertSchema(expenseCategories).pick({
  name: true,
  description: true,
});

export const insertExpenseSubcategorySchema = createInsertSchema(expenseSubcategories).pick({
  categoryId: true,
  name: true,
  description: true,
});

export const insertIncomeCategorySchema = createInsertSchema(incomeCategories).pick({
  name: true,
  description: true,
  isSystem: true,
});

export const insertIncomeSubcategorySchema = createInsertSchema(incomeSubcategories).pick({
  categoryId: true,
  name: true,
  description: true,
});

// For backward compatibility with existing app
export const legacyInsertExpenseSchema = createInsertSchema(expenses)
  .pick({
    amount: true,
    description: true,
    date: true,
    merchant: true,
    notes: true,
  })
  .extend({
    category: z.string(), // For backward compatibility
  });

// New expense schema that uses proper category relationships
export const insertExpenseSchema = createInsertSchema(expenses)
  .pick({
    amount: true,
    description: true,
    date: true,
    categoryId: true,
    subcategoryId: true,
    budgetId: true,
    merchant: true,
    notes: true,
  });

// Income schema
export const insertIncomeSchema = createInsertSchema(incomes)
  .pick({
    amount: true,
    description: true,
    date: true,
    categoryId: true,
    subcategoryId: true,
    source: true,
    notes: true,
  });

// Budget schemas
export const insertBudgetSchema = createInsertSchema(budgets)
  .pick({
    name: true,
    period: true,
    startDate: true,
    endDate: true,
    amount: true,
    notes: true,
  });

export const insertBudgetAllocationSchema = createInsertSchema(budgetAllocations)
  .pick({
    budgetId: true,
    categoryId: true,
    subcategoryId: true,
    amount: true,
  });

// Client-side validation schemas
export const clientExpenseSchema = insertExpenseSchema.extend({
  amount: z.number().positive({ message: 'Amount is required and must be positive' }),
  description: z.string().min(1, { message: 'Description is required' }),
  date: z.union([z.date(), z.string().min(1).pipe(z.coerce.date())]),
  categoryId: z.number().int().positive({ message: 'Category is required' }),
  merchant: z.string().min(1, { message: 'Merchant/Payee is required' }),
  // subcategoryId can be null or a positive number, so we allow null or positive int
  subcategoryId: z.union([z.number().int().positive(), z.null()]),
  // budgetId is optional - if null, expense tracks against all matching budgets
  budgetId: z.union([z.number().int().positive(), z.null()]).optional(),
  notes: z.string().optional(),
});

export const clientIncomeSchema = insertIncomeSchema.extend({
  date: z.union([z.date(), z.string().min(1).pipe(z.coerce.date())])
});

export const clientBudgetSchema = insertBudgetSchema.extend({
  name: z.string().min(1, { message: 'Budget name is required' }),
  period: z.string().min(1, { message: 'Period is required' }),
  startDate: z.union([z.date(), z.string().min(1).pipe(z.coerce.date())]),
  endDate: z.union([z.date(), z.string().min(1).pipe(z.coerce.date())]),
  amount: z.number().positive({ message: 'Total budget is required and must be positive' }),
  notes: z.string().optional(),
});

// Export types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type ExpenseCategory = typeof expenseCategories.$inferSelect;
export type InsertExpenseCategory = z.infer<typeof insertExpenseCategorySchema>;
export type ExpenseSubcategory = typeof expenseSubcategories.$inferSelect;
export type InsertExpenseSubcategory = z.infer<typeof insertExpenseSubcategorySchema>;

export type IncomeCategory = typeof incomeCategories.$inferSelect;
export type InsertIncomeCategory = z.infer<typeof insertIncomeCategorySchema>;
export type IncomeSubcategory = typeof incomeSubcategories.$inferSelect;
export type InsertIncomeSubcategory = z.infer<typeof insertIncomeSubcategorySchema>;

export type Expense = typeof expenses.$inferSelect & { category_name?: string };
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type LegacyInsertExpense = z.infer<typeof legacyInsertExpenseSchema>;

export type Income = typeof incomes.$inferSelect;
export type InsertIncome = z.infer<typeof insertIncomeSchema>;

export type Budget = typeof budgets.$inferSelect;
export type InsertBudget = z.infer<typeof insertBudgetSchema>;
export type BudgetAllocation = typeof budgetAllocations.$inferSelect;
export type InsertBudgetAllocation = z.infer<typeof insertBudgetAllocationSchema>;

// User hidden categories table - allows users to hide system categories
export const userHiddenCategories = pgTable("user_hidden_categories", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  categoryId: integer("category_id").notNull().references(() => expenseCategories.id),
  categoryType: text("category_type").notNull(), // 'expense' or 'budget'
  hiddenAt: timestamp("hidden_at").notNull().defaultNow(),
});

// Activity Log table for tracking user actions
export const activityLogs = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  actionType: text("action_type").notNull(), // CREATE, UPDATE, DELETE, LOGIN, LOGOUT, etc.
  resourceType: text("resource_type").notNull(), // EXPENSE, INCOME, BUDGET, CATEGORY, USER, etc.
  resourceId: integer("resource_id"), // ID of affected resource (nullable for LOGIN/LOGOUT)
  description: text("description").notNull(), // Human readable description
  ipAddress: text("ip_address"), // User's IP address (stored as text for simplicity)
  userAgent: text("user_agent"), // Browser/device info
  metadata: jsonb("metadata"), // Additional data (old/new values, etc.)
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertActivityLogSchema = createInsertSchema(activityLogs);

export const insertUserHiddenCategorySchema = createInsertSchema(userHiddenCategories).pick({
  categoryId: true,
  categoryType: true,
});

export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;

export type UserHiddenCategory = typeof userHiddenCategories.$inferSelect;
export type InsertUserHiddenCategory = z.infer<typeof insertUserHiddenCategorySchema>;

// RBAC Tables
export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  isSystem: boolean("is_system").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const permissions = pgTable("permissions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  resource: text("resource").notNull(),
  action: text("action").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const rolePermissions = pgTable("role_permissions", {
  id: serial("id").primaryKey(),
  roleId: integer("role_id").notNull().references(() => roles.id),
  permissionId: integer("permission_id").notNull().references(() => permissions.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const userRoles = pgTable("user_roles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  roleId: integer("role_id").notNull().references(() => roles.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// RBAC Schemas
export const insertRoleSchema = createInsertSchema(roles).omit({
  id: true,
  isSystem: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPermissionSchema = createInsertSchema(permissions).omit({
  id: true,
  createdAt: true,
});

export const insertRolePermissionSchema = createInsertSchema(rolePermissions).omit({
  id: true,
  createdAt: true,
});

export const insertUserRoleSchema = createInsertSchema(userRoles).omit({
  id: true,
  createdAt: true,
});

// RBAC Types
export type Role = typeof roles.$inferSelect;
export type InsertRole = z.infer<typeof insertRoleSchema>;

export type Permission = typeof permissions.$inferSelect;
export type InsertPermission = z.infer<typeof insertPermissionSchema>;

export type RolePermission = typeof rolePermissions.$inferSelect;
export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;

export type UserRole = typeof userRoles.$inferSelect;
export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;

// System Settings Table
export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  settingKey: text("setting_key").notNull().unique(),
  settingValue: text("setting_value"),
  settingType: text("setting_type").notNull().default("text"), // text, number, boolean, json, file
  category: text("category").notNull(), // site, branding, localization, email, security, features
  description: text("description"),
  isPublic: boolean("is_public").default(false), // whether setting can be exposed to frontend
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// System Settings Schemas
export const insertSystemSettingSchema = createInsertSchema(systemSettings).pick({
  settingKey: true,
  settingValue: true,
  settingType: true,
  category: true,
  description: true,
  isPublic: true,
});

export const updateSystemSettingSchema = createInsertSchema(systemSettings).pick({
  settingValue: true,
  description: true,
}).partial();

// System Settings Types
export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = z.infer<typeof insertSystemSettingSchema>;
export type UpdateSystemSetting = z.infer<typeof updateSystemSettingSchema>;

// Settings by category interface for better organization
export interface SystemSettingsByCategory {
  site: SystemSetting[];
  branding: SystemSetting[];
  localization: SystemSetting[];
  email: SystemSetting[];
  security: SystemSetting[];
  features: SystemSetting[];
}

// Public settings interface for frontend consumption
export interface PublicSystemSettings {
  siteName: string;
  siteDescription: string;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  secondaryColor: string;
  defaultCurrency: string;
  defaultLanguage: string;
  timezone: string;
  dateFormat: string;
  numberFormat: string;
  enableBudgets: boolean;
  enableAnalytics: boolean;
  enableExports: boolean;
  enableCategories: boolean;
}

// Announcements & Communication Tables
export const announcements = pgTable("announcements", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  announcementType: text("announcement_type").notNull().default("general"), // general, urgent, maintenance, update, welcome
  priority: text("priority").notNull().default("normal"), // low, normal, high, urgent
  createdBy: integer("created_by").notNull().references(() => users.id),
  targetAudience: text("target_audience").notNull().default("all"), // all, new_users, active_users, specific_roles
  isActive: boolean("is_active").default(true),
  expiresAt: timestamp("expires_at"), // nullable - no expiry if null
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const userAnnouncements = pgTable("user_announcements", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  announcementId: integer("announcement_id").notNull().references(() => announcements.id),
  viewedAt: timestamp("viewed_at"), // when user first saw the announcement
  readAt: timestamp("read_at"), // when user fully read/clicked the announcement
  dismissedAt: timestamp("dismissed_at"), // when user dismissed/closed the announcement
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Announcements Schemas
export const insertAnnouncementSchema = createInsertSchema(announcements).pick({
  title: true,
  content: true,
  announcementType: true,
  priority: true,
  targetAudience: true,
  expiresAt: true,
});

export const updateAnnouncementSchema = createInsertSchema(announcements).pick({
  title: true,
  content: true,
  announcementType: true,
  priority: true,
  targetAudience: true,
  isActive: true,
  expiresAt: true,
}).partial();

export const insertUserAnnouncementSchema = createInsertSchema(userAnnouncements).pick({
  announcementId: true,
  viewedAt: true,
  readAt: true,
  dismissedAt: true,
});

// Announcement Types
export type Announcement = typeof announcements.$inferSelect;
export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;
export type UpdateAnnouncement = z.infer<typeof updateAnnouncementSchema>;

export type UserAnnouncement = typeof userAnnouncements.$inferSelect;
export type InsertUserAnnouncement = z.infer<typeof insertUserAnnouncementSchema>;

// Extended announcement types with relationships
export interface AnnouncementWithCreator extends Announcement {
  creatorName: string;
  creatorUsername: string;
}

export interface AnnouncementWithStats extends AnnouncementWithCreator {
  totalInteractions: number;
  totalViews: number;
  totalReads: number;
  totalDismissals: number;
  viewRate: number;
  readRate: number;
  dismissRate: number;
}

export interface UserAnnouncementWithDetails extends UserAnnouncement {
  announcement: AnnouncementWithCreator;
  isNew: boolean;
}

// Announcement analytics interface
export interface AnnouncementStats {
  totalUsers: number;
  totalViewed: number;
  totalRead: number;
  totalDismissed: number;
  viewRate: number;
  readRate: number;
  dismissRate: number;
}

// User's announcement feed interface
export interface UserAnnouncementFeed {
  id: number;
  title: string;
  content: string;
  announcementType: string;
  priority: string;
  createdBy: number;
  creatorName: string;
  createdAt: string;
  expiresAt: string | null;
  viewedAt: string | null;
  readAt: string | null;
  dismissedAt: string | null;
  isNew: boolean;
}

// Extended types with relationships
export interface RoleWithPermissions extends Role {
  permissions: Permission[];
}

export interface UserWithRoles extends User {
  roles: Role[];
}

export interface UserPermissions {
  userId: number;
  permissions: Permission[];
  roles: Role[];
}
