
import { Router } from 'express';
import { storage } from './storage';
import { requireAdmin } from './middleware';
import { pool } from './db';
import { getAllUsersActivityLogs } from './activity-logger';
import { format, subDays } from 'date-fns';
import { PDFDocument, rgb } from 'pdf-lib';

const router = Router();

// Debug: return raw per-day counts for users and expenses
router.get('/dashboard/debug-daily', requireAdmin, async (req, res) => {
  try {
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;
    const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd');
    const dailyRes = await pool.query(
      `SELECT to_char(d::date, 'YYYY-MM-DD') as date,
        (SELECT COUNT(*) FROM expenses e WHERE (e.date::date = d::date OR e.created_at::date = d::date)) as transactions,
        (SELECT COUNT(*) FROM users u WHERE u.created_at::date = d::date) as newUsers
       FROM generate_series($1::date, now()::date, '1 day') d`,
      [startDate]
    );
    res.json({ daily: dailyRes.rows });
  } catch (error) {
    console.error('Error fetching debug daily:', error);
    res.status(500).json({ error: 'Failed to fetch debug daily' });
  }
});

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  adminUsers: number;
  dailyActiveUsers: number;
  totalTransactions: number;
  recentActivity: any[];
  topCategories: any[];
  dailyStats: any[];
}

async function getDashboardStats(timeRange: string): Promise<DashboardStats> {
  const days = timeRange === '7d' ? 7 : timeRange === '90d' ? 90 : 30;
  const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd');

  // Get user statistics
  // Use existing storage helpers
  const userStats = await storage.getUserStats();
  const totalUsers = userStats.totalUsers;
  const activeUsers = userStats.activeUsers;
  const suspendedUsers = userStats.suspendedUsers;
  const adminUsers = userStats.adminUsers;

  // Total transactions (count of expenses) since startDate
  // Compare both date and created_at as date to be robust to how rows were inserted
  const txRes = await pool.query(`SELECT COUNT(*) as cnt FROM expenses WHERE (date::date >= $1::date OR created_at::date >= $1::date)`, [startDate]);
  const totalTransactions = parseInt(txRes.rows[0]?.cnt || '0');

  // Daily active users in the last 24 hours (activity log)
  const dailyActiveRes = await pool.query(`SELECT COUNT(DISTINCT user_id) as cnt FROM activity_log WHERE created_at >= now() - interval '1 day'`);
  const dailyActiveUsers = parseInt(dailyActiveRes.rows[0]?.cnt || '0');

  // Recent activity from activity logger
  const recentActivity = await getAllUsersActivityLogs(10, 0, {});

  // Top categories (by count and total) since startDate
  const topCatRes = await pool.query(
    `SELECT ec.name, COUNT(e.id) as count, COALESCE(SUM(e.amount),0) as total
     FROM expenses e
     LEFT JOIN expense_categories ec ON e.category_id = ec.id
     WHERE (e.date::date >= $1::date OR e.created_at::date >= $1::date)
     GROUP BY ec.name
     ORDER BY count DESC
     LIMIT 10`,
    [startDate]
  );
  const topCategories = topCatRes.rows.map((r: any) => ({ name: r.name || 'Uncategorized', count: parseInt(r.count || '0'), total: parseFloat(r.total || '0') }));

  // Daily stats: transactions and new users per day between startDate and today
  // Calculate daily active users per day
  const dailyRes = await pool.query(
    `SELECT to_char(d::date, 'YYYY-MM-DD') as date,
      COALESCE((SELECT COUNT(*) FROM expenses e WHERE (e.date::date = d::date OR e.created_at::date = d::date)),0) as transactions,
      COALESCE((SELECT COUNT(*) FROM users u WHERE u.created_at::date = d::date),0) as newUsers,
      COALESCE((SELECT COUNT(DISTINCT user_id) FROM activity_log a WHERE a.created_at::date = d::date),0) as activeUsers
     FROM generate_series($1::date, now()::date, '1 day') d`,
    [startDate]
  );
  const dailyStats = dailyRes.rows.map((r: any) => ({
    date: r.date,
    transactions: parseInt(r.transactions || '0'),
    newUsers: parseInt(r.newusers || '0'),
    activeUsers: parseInt(r.activeusers || '0')
  }));

  return {
    totalUsers,
    activeUsers,
    suspendedUsers,
    adminUsers,
    dailyActiveUsers,
    totalTransactions,
    recentActivity,
    topCategories,
    dailyStats
  };
}

// Get dashboard stats
router.get('/dashboard', requireAdmin, async (req, res) => {
  try {
    const timeRange = (req.query.timeRange as string) || '30d';
    const stats = await getDashboardStats(timeRange);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

// Debug endpoint: return raw expenses and recent activity for troubleshooting
router.get('/dashboard/debug-raw', requireAdmin, async (req, res) => {
  try {
    const expenses = await pool.query(`SELECT id, user_id, amount, description, date, created_at FROM expenses ORDER BY created_at DESC LIMIT 50`);
    const activity = await pool.query(`SELECT id, user_id, action, resource, created_at FROM activity_log ORDER BY created_at DESC LIMIT 50`);
    res.json({ expenses: expenses.rows, activity: activity.rows });
  } catch (error) {
    console.error('Error fetching debug raw data:', error);
    res.status(500).json({ error: 'Failed to fetch raw debug data' });
  }
});

// Seed a test expense for a user (admin only). Simple helper to verify dashboard visuals.
router.post('/dashboard/seed-expense', requireAdmin, async (req, res) => {
  try {
    const userId = parseInt((req.query.userId as string) || req.body.userId, 10);
    if (!userId) return res.status(400).json({ error: 'userId is required (query or body)' });

    const amount = typeof req.body.amount === 'number' ? req.body.amount : parseFloat((req.query.amount as string) || '10');
    const description = (req.body.description as string) || (req.query.description as string) || 'Seed expense';

    // Ensure there is at least one expense category to reference; create a simple one for the user if none
    let catRes = await pool.query(`SELECT id FROM expense_categories WHERE user_id = $1 LIMIT 1`, [userId]);
    let categoryId: number;
    if (catRes.rows.length > 0) {
      categoryId = catRes.rows[0].id;
    } else {
      const insertCat = await pool.query(`INSERT INTO expense_categories (user_id, name, created_at) VALUES ($1, $2, now()) RETURNING id`, [userId, 'Seed Category']);
      categoryId = insertCat.rows[0].id;
    }

    const insertRes = await pool.query(
      `INSERT INTO expenses (user_id, amount, description, date, category_id, created_at)
       VALUES ($1, $2, $3, now(), $4, now()) RETURNING *`,
      [userId, amount, description, categoryId]
    );

    res.json({ inserted: insertRes.rows[0] });
  } catch (error) {
    console.error('Error seeding expense:', error);
    res.status(500).json({ error: 'Failed to seed expense' });
  }
});

// Export data as CSV
router.get('/export/csv', requireAdmin, async (req, res) => {
  try {
    // For CSV, reuse admin expenses export route behavior: getAllExpenses without filters
    const expensesRaw = await storage.getAllExpenses();
    const expensesArr = Array.isArray(expensesRaw) ? expensesRaw : (expensesRaw.rows || []);
    const data = expensesArr.map((e: any) => ({ id: e.id, userId: e.userId || e.user_id, categoryId: e.categoryId || e.category_id, amount: e.amount, description: e.description, date: e.date, createdAt: e.createdAt || e.created_at }));

    // Build CSV manually to avoid needing @types/json2csv
    const header = ['id','userId','categoryId','amount','description','date','createdAt'];
    const rows = data.map((d: any) => header.map(h => {
      const v = d[h as keyof typeof d];
      if (v === null || v === undefined) return '';
      const s = String(v);
      // escape double quotes
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g,'""')}"` : s;
    }).join(','));

    const csv = header.join(',') + '\n' + rows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=expense-data-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting CSV:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// Export data as PDF
router.get('/export/pdf', requireAdmin, async (req, res) => {
  try {
  const stats = await getDashboardStats('30d');
    
    // Create PDF document
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { height } = page.getSize();
    
    // Add content to PDF
    page.drawText('Expense App Analytics Report', {
      x: 50,
      y: height - 50,
      size: 20
    });

    // Add stats
    const stats_text = [
      `Total Users: ${stats.totalUsers}`,
      `Active Users: ${stats.activeUsers}`,
      `Daily Active Users: ${stats.dailyActiveUsers}`,
      `Total Transactions: ${stats.totalTransactions}`,
      '\nTop Categories:',
      ...stats.topCategories.map(cat => 
        `${cat.name}: ${cat.count} transactions, $${cat.total.toFixed(2)}`
      )
    ].join('\n');

    page.drawText(stats_text, {
      x: 50,
      y: height - 100,
      size: 12,
      lineHeight: 16
    });

    const pdfBytes = await pdfDoc.save();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=expense-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error('Error exporting PDF:', error);
    res.status(500).json({ error: 'Failed to export report' });
  }
});

export default router;