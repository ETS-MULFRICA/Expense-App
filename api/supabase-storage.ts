import { 
  User, InsertUser, 
  Expense, InsertExpense, LegacyInsertExpense,
  ExpenseCategory, InsertExpenseCategory,
  ExpenseSubcategory, InsertExpenseSubcategory,
  IncomeCategory, InsertIncomeCategory,
  IncomeSubcategory, InsertIncomeSubcategory,
  Income, InsertIncome,
  Budget, InsertBudget,
  BudgetAllocation, InsertBudgetAllocation
} from "@shared/schema";
import { supabase } from "./supabase";
import { IStorage } from "./storage";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

export class SupabaseStorage implements IStorage {
  public sessionStore = new MemoryStore({ checkPeriod: 86400000 });

  // Helper method to ensure supabase is available
  private ensureSupabase() {
    if (!supabase) {
      throw new Error('Supabase client not initialized. Please check your environment variables.');
    }
    return supabase;
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const client = this.ensureSupabase();
    const { data, error } = await client
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !data) return undefined;
    
    return {
      ...data,
      currency: data.currency || 'XAF',
      role: data.role || 'user',
      createdAt: new Date(data.created_at)
    };
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const client = this.ensureSupabase();
    const { data, error } = await client
      .from('users')
      .select('*')
      .eq('username', username)
      .single();
    
    if (error || !data) return undefined;
    
    return {
      ...data,
      currency: data.currency || 'XAF',
      role: data.role || 'user',
      createdAt: new Date(data.created_at)
    };
  }

  async createUser(user: InsertUser): Promise<User> {
    const client = this.ensureSupabase();
    const { data, error } = await client
      .from('users')
      .insert({
        username: user.username,
        password: user.password,
        name: user.name,
        email: user.email,
        currency: 'XAF',
        role: 'user'
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to create user: ${error?.message}`);
    }

    const newUser = {
      ...data,
      currency: data.currency || 'XAF',
      role: data.role || 'user',
      createdAt: new Date(data.created_at)
    };

    // Create default categories for new user
    await this.createDefaultCategories(newUser.id);

    return newUser;
  }

  async getAllUsers(): Promise<User[]> {
    const client = this.ensureSupabase();
    const { data, error } = await client
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to get users: ${error.message}`);

    return (data || []).map(user => ({
      ...user,
      currency: user.currency || 'XAF',
      role: user.role || 'user',
      createdAt: new Date(user.created_at)
    }));
  }

  async getUserRole(userId: number): Promise<string> {
    const user = await this.getUser(userId);
    return user?.role || 'user';
  }

  async setUserRole(userId: number, role: string): Promise<void> {
    const client = this.ensureSupabase();
    const { error } = await client
      .from('users')
      .update({ role })
      .eq('id', userId);

    if (error) {
      throw new Error(`Failed to update user role: ${error.message}`);
    }
  }

  async updateUserSettings(userId: number, settings: { currency?: string }): Promise<User> {
    const client = this.ensureSupabase();
    const { data, error } = await client
      .from('users')
      .update(settings)
      .eq('id', userId)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to update user settings: ${error?.message}`);
    }

    return {
      ...data,
      currency: data.currency || 'XAF',
      role: data.role || 'user',
      createdAt: new Date(data.created_at)
    };
  }

  // Expense Category operations
  async getExpenseCategories(userId: number): Promise<ExpenseCategory[]> {
    const client = this.ensureSupabase();
    const { data, error } = await client
      .from('expense_categories')
      .select('*')
      .eq('user_id', userId)
      .order('name', { ascending: true });

    if (error) throw new Error(`Failed to get expense categories: ${error.message}`);

    return (data || []).map(cat => ({
      ...cat,
      userId: cat.user_id,
      isSystem: cat.is_system || false,
      createdAt: new Date(cat.created_at)
    }));
  }

  async getExpenseCategoryById(id: number): Promise<ExpenseCategory | undefined> {
    const client = this.ensureSupabase();
    const { data, error } = await client
      .from('expense_categories')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return undefined;

    return {
      ...data,
      userId: data.user_id,
      isSystem: data.is_system || false,
      createdAt: new Date(data.created_at)
    };
  }

  async createExpenseCategory(userId: number, category: InsertExpenseCategory): Promise<ExpenseCategory> {
    const client = this.ensureSupabase();
    const { data, error } = await client
      .from('expense_categories')
      .insert({
        user_id: userId,
        name: category.name,
        description: category.description || null,
        is_system: false
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to create expense category: ${error?.message}`);
    }

    return {
      ...data,
      userId: data.user_id,
      isSystem: data.is_system || false,
      createdAt: new Date(data.created_at)
    };
  }

  async updateExpenseCategory(id: number, category: InsertExpenseCategory): Promise<ExpenseCategory> {
    const client = this.ensureSupabase();
    const { data, error } = await client
      .from('expense_categories')
      .update({
        name: category.name,
        description: category.description
      })
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to update expense category: ${error?.message}`);
    }

    return {
      ...data,
      userId: data.user_id,
      isSystem: data.is_system || false,
      createdAt: new Date(data.created_at)
    };
  }

  async deleteExpenseCategory(id: number): Promise<void> {
    const client = this.ensureSupabase();
    const { error } = await client
      .from('expense_categories')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete expense category: ${error.message}`);
    }
  }

  // Expense Subcategory operations
  async getExpenseSubcategories(categoryId: number): Promise<ExpenseSubcategory[]> {
    const client = this.ensureSupabase();
    const { data, error } = await client
      .from('expense_subcategories')
      .select('*')
      .eq('category_id', categoryId)
      .order('name', { ascending: true });

    if (error) throw new Error(`Failed to get expense subcategories: ${error.message}`);

    return (data || []).map(sub => ({
      ...sub,
      categoryId: sub.category_id,
      userId: sub.user_id,
      isSystem: sub.is_system || false,
      createdAt: new Date(sub.created_at)
    }));
  }

  async getExpenseSubcategoryById(id: number): Promise<ExpenseSubcategory | undefined> {
    const client = this.ensureSupabase();
    const { data, error } = await client
      .from('expense_subcategories')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return undefined;

    return {
      ...data,
      categoryId: data.category_id,
      userId: data.user_id,
      isSystem: data.is_system || false,
      createdAt: new Date(data.created_at)
    };
  }

  async createExpenseSubcategory(userId: number, subcategory: InsertExpenseSubcategory): Promise<ExpenseSubcategory> {
    const client = this.ensureSupabase();
    const { data, error } = await client
      .from('expense_subcategories')
      .insert({
        category_id: subcategory.categoryId,
        user_id: userId,
        name: subcategory.name,
        description: subcategory.description || null,
        is_system: false
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to create expense subcategory: ${error?.message}`);
    }

    return {
      ...data,
      categoryId: data.category_id,
      userId: data.user_id,
      isSystem: data.is_system || false,
      createdAt: new Date(data.created_at)
    };
  }

  async updateExpenseSubcategory(id: number, subcategory: InsertExpenseSubcategory): Promise<ExpenseSubcategory> {
    const client = this.ensureSupabase();
    const { data, error } = await client
      .from('expense_subcategories')
      .update({
        name: subcategory.name,
        description: subcategory.description,
        category_id: subcategory.categoryId
      })
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to update expense subcategory: ${error?.message}`);
    }

    return {
      ...data,
      categoryId: data.category_id,
      userId: data.user_id,
      isSystem: data.is_system || false,
      createdAt: new Date(data.created_at)
    };
  }

  async deleteExpenseSubcategory(id: number): Promise<void> {
    const client = this.ensureSupabase();
    const { error } = await client
      .from('expense_subcategories')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete expense subcategory: ${error.message}`);
    }
  }

  // Income Category operations  
  async getIncomeCategories(userId: number): Promise<IncomeCategory[]> {
    const client = this.ensureSupabase();
    const { data, error } = await client
      .from('income_categories')
      .select('*')
      .eq('user_id', userId)
      .order('name', { ascending: true });

    if (error) throw new Error(`Failed to get income categories: ${error.message}`);

    return (data || []).map(cat => ({
      ...cat,
      userId: cat.user_id,
      isSystem: cat.is_system || false,
      createdAt: new Date(cat.created_at)
    }));
  }

  async getIncomeCategoryById(id: number): Promise<IncomeCategory | undefined> {
    const client = this.ensureSupabase();
    const { data, error } = await client
      .from('income_categories')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return undefined;

    return {
      ...data,
      userId: data.user_id,
      isSystem: data.is_system || false,
      createdAt: new Date(data.created_at)
    };
  }

  async createIncomeCategory(userId: number, category: InsertIncomeCategory): Promise<IncomeCategory> {
    const client = this.ensureSupabase();
    const { data, error } = await client
      .from('income_categories')
      .insert({
        user_id: userId,
        name: category.name,
        description: category.description || null,
        is_system: false
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to create income category: ${error?.message}`);
    }

    return {
      ...data,
      userId: data.user_id,
      isSystem: data.is_system || false,
      createdAt: new Date(data.created_at)
    };
  }

  async updateIncomeCategory(id: number, category: InsertIncomeCategory): Promise<IncomeCategory> {
    const client = this.ensureSupabase();
    const { data, error } = await client
      .from('income_categories')
      .update({
        name: category.name,
        description: category.description
      })
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to update income category: ${error?.message}`);
    }

    return {
      ...data,
      userId: data.user_id,
      isSystem: data.is_system || false,
      createdAt: new Date(data.created_at)
    };
  }

  async deleteIncomeCategory(id: number): Promise<void> {
    const client = this.ensureSupabase();
    const { error } = await client
      .from('income_categories')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete income category: ${error.message}`);
    }
  }

  // Income Subcategory operations
  async getIncomeSubcategories(categoryId: number): Promise<IncomeSubcategory[]> {
    const client = this.ensureSupabase();
    const { data, error } = await client
      .from('income_subcategories')
      .select('*')
      .eq('category_id', categoryId)
      .order('name', { ascending: true });

    if (error) throw new Error(`Failed to get income subcategories: ${error.message}`);

    return (data || []).map(sub => ({
      ...sub,
      categoryId: sub.category_id,
      userId: sub.user_id,
      isSystem: sub.is_system || false,
      createdAt: new Date(sub.created_at)
    }));
  }

  async getIncomeSubcategoryById(id: number): Promise<IncomeSubcategory | undefined> {
    const client = this.ensureSupabase();
    const { data, error } = await client
      .from('income_subcategories')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return undefined;

    return {
      ...data,
      categoryId: data.category_id,
      userId: data.user_id,
      isSystem: data.is_system || false,
      createdAt: new Date(data.created_at)
    };
  }

  async createIncomeSubcategory(userId: number, subcategory: InsertIncomeSubcategory): Promise<IncomeSubcategory> {
    const client = this.ensureSupabase();
    const { data, error } = await client
      .from('income_subcategories')
      .insert({
        category_id: subcategory.categoryId,
        user_id: userId,
        name: subcategory.name,
        description: subcategory.description || null,
        is_system: false
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to create income subcategory: ${error?.message}`);
    }

    return {
      ...data,
      categoryId: data.category_id,
      userId: data.user_id,
      isSystem: data.is_system || false,
      createdAt: new Date(data.created_at)
    };
  }

  async updateIncomeSubcategory(id: number, subcategory: InsertIncomeSubcategory): Promise<IncomeSubcategory> {
    const client = this.ensureSupabase();
    const { data, error } = await client
      .from('income_subcategories')
      .update({
        name: subcategory.name,
        description: subcategory.description,
        category_id: subcategory.categoryId
      })
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to update income subcategory: ${error?.message}`);
    }

    return {
      ...data,
      categoryId: data.category_id,
      userId: data.user_id,
      isSystem: data.is_system || false,
      createdAt: new Date(data.created_at)
    };
  }

  async deleteIncomeSubcategory(id: number): Promise<void> {
    const client = this.ensureSupabase();
    const { error } = await client
      .from('income_subcategories')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete income subcategory: ${error.message}`);
    }
  }

  // Expense operations
  async getExpensesByUserId(userId: number): Promise<Expense[]> {
    const client = this.ensureSupabase();
    const { data, error } = await client
      .from('expenses')
      .select(`
        *,
        expense_categories!inner(name),
        expense_subcategories(name)
      `)
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) throw new Error(`Failed to get expenses: ${error.message}`);

    return (data || []).map(expense => ({
      ...expense,
      userId: expense.user_id,
      categoryId: expense.category_id,
      subcategoryId: expense.subcategory_id,
      date: new Date(expense.date),
      createdAt: new Date(expense.created_at)
    }));
  }

  async getExpenseById(id: number): Promise<Expense | undefined> {
    const client = this.ensureSupabase();
    const { data, error } = await client
      .from('expenses')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return undefined;

    return {
      ...data,
      userId: data.user_id,
      categoryId: data.category_id,
      subcategoryId: data.subcategory_id,
      date: new Date(data.date),
      createdAt: new Date(data.created_at)
    };
  }

  async createExpense(expense: InsertExpense & { userId: number }): Promise<Expense> {
    const client = this.ensureSupabase();
    const { data, error } = await client
      .from('expenses')
      .insert({
        user_id: expense.userId,
        amount: expense.amount,
        description: expense.description,
        date: expense.date.toISOString(),
        category_id: expense.categoryId,
        subcategory_id: expense.subcategoryId || null,
        merchant: expense.merchant || null,
        notes: expense.notes || null
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to create expense: ${error?.message}`);
    }

    return {
      ...data,
      userId: data.user_id,
      categoryId: data.category_id,
      subcategoryId: data.subcategory_id,
      date: new Date(data.date),
      createdAt: new Date(data.created_at)
    };
  }

  async createLegacyExpense(expense: LegacyInsertExpense & { userId: number }): Promise<Expense> {
    // For legacy expenses, we need to find or create category first
    const categories = await this.getExpenseCategories(expense.userId);
    let category = categories.find(c => c.name.toLowerCase() === expense.category.toLowerCase());
    
    if (!category) {
      category = await this.createExpenseCategory(expense.userId, {
        name: expense.category,
        description: `Auto-created category for ${expense.category}`
      });
    }

    return this.createExpense({
      userId: expense.userId,
      amount: expense.amount,
      description: expense.description,
      date: expense.date,
      categoryId: category.id,
      subcategoryId: null,
      merchant: expense.merchant,
      notes: expense.notes
    });
  }

  async updateExpense(id: number, expense: InsertExpense & { userId: number }): Promise<Expense> {
    const client = this.ensureSupabase();
    const { data, error } = await client
      .from('expenses')
      .update({
        amount: expense.amount,
        description: expense.description,
        date: expense.date.toISOString(),
        category_id: expense.categoryId,
        subcategory_id: expense.subcategoryId || null,
        merchant: expense.merchant || null,
        notes: expense.notes || null
      })
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to update expense: ${error?.message}`);
    }

    return {
      ...data,
      userId: data.user_id,
      categoryId: data.category_id,
      subcategoryId: data.subcategory_id,
      date: new Date(data.date),
      createdAt: new Date(data.created_at)
    };
  }

  async updateLegacyExpense(id: number, expense: LegacyInsertExpense & { userId: number }): Promise<Expense> {
    const categories = await this.getExpenseCategories(expense.userId);
    let category = categories.find(c => c.name.toLowerCase() === expense.category.toLowerCase());
    
    if (!category) {
      category = await this.createExpenseCategory(expense.userId, {
        name: expense.category,
        description: `Auto-created category for ${expense.category}`
      });
    }

    return this.updateExpense(id, {
      userId: expense.userId,
      amount: expense.amount,
      description: expense.description,
      date: expense.date,
      categoryId: category.id,
      subcategoryId: null,
      merchant: expense.merchant,
      notes: expense.notes
    });
  }

  async deleteExpense(id: number): Promise<void> {
    const client = this.ensureSupabase();
    const { error } = await client
      .from('expenses')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete expense: ${error.message}`);
    }
  }

  async getAllExpenses(): Promise<Expense[]> {
    const client = this.ensureSupabase();
    const { data, error } = await client
      .from('expenses')
      .select('*')
      .order('date', { ascending: false });

    if (error) throw new Error(`Failed to get all expenses: ${error.message}`);

    return (data || []).map(expense => ({
      ...expense,
      userId: expense.user_id,
      categoryId: expense.category_id,
      subcategoryId: expense.subcategory_id,
      date: new Date(expense.date),
      createdAt: new Date(expense.created_at)
    }));
  }

  // Income operations
  async getIncomesByUserId(userId: number): Promise<Income[]> {
    const client = this.ensureSupabase();
    const { data, error } = await client
      .from('incomes')
      .select(`
        *,
        income_categories!inner(name),
        income_subcategories(name)
      `)
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) throw new Error(`Failed to get incomes: ${error.message}`);

    return (data || []).map(income => ({
      ...income,
      userId: income.user_id,
      categoryId: income.category_id,
      subcategoryId: income.subcategory_id,
      date: new Date(income.date),
      createdAt: new Date(income.created_at)
    }));
  }

  async getIncomeById(id: number): Promise<Income | undefined> {
    const client = this.ensureSupabase();
    const { data, error } = await client
      .from('incomes')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return undefined;

    return {
      ...data,
      userId: data.user_id,
      categoryId: data.category_id,
      subcategoryId: data.subcategory_id,
      date: new Date(data.date),
      createdAt: new Date(data.created_at)
    };
  }

  async createIncome(income: InsertIncome & { userId: number }): Promise<Income> {
    const client = this.ensureSupabase();
    const { data, error } = await client
      .from('incomes')
      .insert({
        user_id: income.userId,
        amount: income.amount,
        description: income.description,
        date: income.date.toISOString(),
        category_id: income.categoryId,
        subcategory_id: income.subcategoryId || null,
        source: income.source || null,
        notes: income.notes || null
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to create income: ${error?.message}`);
    }

    return {
      ...data,
      userId: data.user_id,
      categoryId: data.category_id,
      subcategoryId: data.subcategory_id,
      date: new Date(data.date),
      createdAt: new Date(data.created_at)
    };
  }

  async updateIncome(id: number, income: InsertIncome & { userId: number }): Promise<Income> {
    const client = this.ensureSupabase();
    const { data, error } = await client
      .from('incomes')
      .update({
        amount: income.amount,
        description: income.description,
        date: income.date.toISOString(),
        category_id: income.categoryId,
        subcategory_id: income.subcategoryId || null,
        source: income.source || null,
        notes: income.notes || null
      })
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to update income: ${error?.message}`);
    }

    return {
      ...data,
      userId: data.user_id,
      categoryId: data.category_id,
      subcategoryId: data.subcategory_id,
      date: new Date(data.date),
      createdAt: new Date(data.created_at)
    };
  }

  async deleteIncome(id: number): Promise<void> {
    const client = this.ensureSupabase();
    const { error } = await client
      .from('incomes')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete income: ${error.message}`);
    }
  }

  async getAllIncomes(): Promise<Income[]> {
    const client = this.ensureSupabase();
    const { data, error } = await client
      .from('incomes')
      .select('*')
      .order('date', { ascending: false });

    if (error) throw new Error(`Failed to get all incomes: ${error.message}`);

    return (data || []).map(income => ({
      ...income,
      userId: income.user_id,
      categoryId: income.category_id,
      subcategoryId: income.subcategory_id,
      date: new Date(income.date),
      createdAt: new Date(income.created_at)
    }));
  }

  // Budget operations - Simplified stubs for now
  async getBudgetsByUserId(userId: number): Promise<Budget[]> {
    // Simplified implementation
    return [];
  }

  async getBudgetById(id: number): Promise<Budget | undefined> {
    return undefined;
  }

  async createBudget(budget: InsertBudget & { userId: number }): Promise<Budget> {
    throw new Error('Budget operations not yet implemented for Supabase storage');
  }

  async updateBudget(id: number, budget: InsertBudget): Promise<Budget> {
    throw new Error('Budget operations not yet implemented for Supabase storage');
  }

  async deleteBudget(id: number): Promise<void> {
    throw new Error('Budget operations not yet implemented for Supabase storage');
  }

  // Budget Allocation operations - Simplified stubs
  async getBudgetAllocations(budgetId: number): Promise<BudgetAllocation[]> {
    return [];
  }

  async createBudgetAllocation(allocation: InsertBudgetAllocation): Promise<BudgetAllocation> {
    throw new Error('Budget allocation operations not yet implemented for Supabase storage');
  }

  async updateBudgetAllocation(id: number, allocation: InsertBudgetAllocation): Promise<BudgetAllocation> {
    throw new Error('Budget allocation operations not yet implemented for Supabase storage');
  }

  async deleteBudgetAllocation(id: number): Promise<void> {
    throw new Error('Budget allocation operations not yet implemented for Supabase storage');
  }

  // Reports and analytics - Simplified stubs
  async getMonthlyExpenseTotals(userId: number, year: number): Promise<{ month: number; total: number }[]> {
    return [];
  }

  async getCategoryExpenseTotals(userId: number, startDate: Date, endDate: Date): Promise<{ category: string; total: number }[]> {
    return [];
  }

  async getMonthlyIncomeTotals(userId: number, year: number): Promise<{ month: number; total: number }[]> {
    return [];
  }

  async getCategoryIncomeTotals(userId: number, startDate: Date, endDate: Date): Promise<{ category: string; total: number }[]> {
    return [];
  }

  async getBudgetPerformance(budgetId: number): Promise<{ 
    allocated: number; 
    spent: number; 
    remaining: number;
    categories: { categoryId: number; allocated: number; spent: number; remaining: number }[] 
  }> {
    return {
      allocated: 0,
      spent: 0,
      remaining: 0,
      categories: []
    };
  }

  // Create default categories helper
  private async createDefaultCategories(userId: number): Promise<void> {
    const defaultCategories = [
      { name: 'Food & Dining', description: 'Restaurants, groceries, etc.' },
      { name: 'Transportation', description: 'Gas, public transport, etc.' },
      { name: 'Entertainment', description: 'Movies, games, etc.' },
      { name: 'Utilities', description: 'Electricity, water, internet' },
      { name: 'Healthcare', description: 'Medical expenses' }
    ];

    for (const category of defaultCategories) {
      await this.createExpenseCategory(userId, category);
    }

    // Create default income categories
    const defaultIncomeCategories = [
      { name: 'Salary', description: 'Regular employment income' },
      { name: 'Freelance', description: 'Contract work' },
      { name: 'Investment', description: 'Investment returns' }
    ];

    for (const category of defaultIncomeCategories) {
      await this.createIncomeCategory(userId, category);
    }
  }
}
