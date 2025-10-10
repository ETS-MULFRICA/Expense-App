import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { formatCurrency } from './currency-formatter';

// Color scheme for professional PDFs
const COLORS = {
  primary: [41, 128, 185] as [number, number, number], // Blue
  secondary: [52, 73, 94] as [number, number, number], // Dark gray
  success: [39, 174, 96] as [number, number, number], // Green
  warning: [243, 156, 18] as [number, number, number], // Orange
  danger: [231, 76, 60] as [number, number, number], // Red
  light: [236, 240, 241] as [number, number, number], // Light gray
  white: [255, 255, 255] as [number, number, number],
  text: [44, 62, 80] as [number, number, number], // Dark text
};

// Helper function to add header with logo and title
const addPDFHeader = (doc: jsPDF, title: string, subtitle?: string) => {
  // Add header background
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, 210, 35, 'F');
  
  // Add title
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 20, 22);
  
  if (subtitle) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(subtitle, 20, 30);
  }
  
  // Add generation date
  doc.setFontSize(10);
  doc.text(`Generated on: ${format(new Date(), 'PPP p')}`, 150, 22, { align: 'right' });
  
  // Reset text color
  doc.setTextColor(...COLORS.text);
};

// Helper function to add footer
const addPDFFooter = (doc: jsPDF, pageNumber: number, totalPages: number) => {
  const pageHeight = doc.internal.pageSize.height;
  
  // Add footer line
  doc.setDrawColor(...COLORS.light);
  doc.line(20, pageHeight - 20, 190, pageHeight - 20);
  
  // Add page number
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.secondary);
  doc.text(`Page ${pageNumber} of ${totalPages}`, 105, pageHeight - 10, { align: 'center' });
  
  // Add app name
  doc.text('Expense Tracker - Admin Dashboard', 20, pageHeight - 10);
  doc.text(`© ${new Date().getFullYear()}`, 190, pageHeight - 10, { align: 'right' });
};

// Helper function to add summary card
const addSummaryCard = (doc: jsPDF, x: number, y: number, width: number, height: number, title: string, value: string, color: [number, number, number]) => {
  // Card background
  doc.setFillColor(...COLORS.light);
  doc.roundedRect(x, y, width, height, 3, 3, 'F');
  
  // Card border
  doc.setDrawColor(...color);
  doc.setLineWidth(2);
  doc.roundedRect(x, y, width, height, 3, 3, 'S');
  
  // Title
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.secondary);
  doc.text(title, x + 5, y + 8);
  
  // Value
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...color);
  doc.text(value, x + 5, y + 18);
  
  // Reset
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.text);
  doc.setLineWidth(0.1);
};

// Enhanced Users Report PDF
export const exportUserReportToPDF = async (data: any) => {
  const doc = new jsPDF();
  
  addPDFHeader(doc, 'User Management Report', 'Comprehensive user statistics and activity overview');
  
  let yPosition = 50;
  
  // Handle empty or invalid data
  if (!data || typeof data !== 'object') {
    doc.setFontSize(14);
    doc.setTextColor(...COLORS.danger);
    doc.text('No user data available for this report.', 20, yPosition);
    addPDFFooter(doc, 1, 1);
    const timestamp = format(new Date(), 'yyyy-MM-dd-HHmmss');
    doc.save(`user-report-${timestamp}.pdf`);
    return;
  }
  
  // Summary Cards
  const cardWidth = 40;
  const cardHeight = 25;
  const cardSpacing = 45;
  
  addSummaryCard(doc, 20, yPosition, cardWidth, cardHeight, 'Total Users', data.totalUsers?.toString() || '0', COLORS.primary);
  addSummaryCard(doc, 20 + cardSpacing, yPosition, cardWidth, cardHeight, 'Active Users', data.dailyActiveUsers?.toString() || '0', COLORS.success);
  addSummaryCard(doc, 20 + cardSpacing * 2, yPosition, cardWidth, cardHeight, 'New This Month', data.recentSignups?.toString() || '0', COLORS.warning);
  addSummaryCard(doc, 20 + cardSpacing * 3, yPosition, cardWidth, cardHeight, 'Total Transactions', data.totalTransactions?.toString() || '0', COLORS.secondary);
  
  yPosition += 40;
  
  // Top Categories Section
  if (data.topCategories && data.topCategories.length > 0) {
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.primary);
    doc.text('Top Expense Categories', 20, yPosition);
    yPosition += 10;
    
    const categoryColumns = ['Category', 'Transaction Count', 'Total Amount', 'Percentage'];
    const categoryRows = data.topCategories.map((cat: any) => [
      cat.categoryName || cat.name || 'Unknown',
      (cat.transactionCount || cat.count || 0).toString(),
      formatCurrency(cat.totalAmount || 0),
      data.totalTransactions > 0 ? 
        `${((cat.transactionCount || cat.count || 0) / data.totalTransactions * 100).toFixed(1)}%` : 
        `${(cat.percentage || 0).toFixed(1)}%`
    ]);
    
    autoTable(doc, {
      head: [categoryColumns],
      body: categoryRows,
      startY: yPosition,
      theme: 'striped',
      headStyles: { 
        fillColor: COLORS.primary,
        textColor: COLORS.white,
        fontSize: 11,
        fontStyle: 'bold'
      },
      styles: { 
        fontSize: 10,
        cellPadding: 4,
        lineColor: COLORS.light,
        lineWidth: 0.5
      },
      alternateRowStyles: { fillColor: [249, 249, 249] },
      margin: { left: 20, right: 20 },
    });
    
    yPosition = (doc as any).lastAutoTable.finalY + 20;
  } else {
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.secondary);
    doc.text('No category data available.', 20, yPosition);
    yPosition += 20;
  }
  
  // Recent Activity Section
  if (data.recentActivity && data.recentActivity.length > 0) {
    // Add new page if needed
    if (yPosition > 250) {
      doc.addPage();
      addPDFHeader(doc, 'User Management Report', 'Recent Activity');
      yPosition = 50;
    }
    
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.primary);
    doc.text('Recent Activity', 20, yPosition);
    yPosition += 10;
    
    const activityColumns = ['Date', 'User', 'Activity Type', 'Description'];
    const activityRows = data.recentActivity.slice(0, 20).map((activity: any) => [
      format(new Date(activity.createdAt || activity.date), 'MMM dd, yyyy HH:mm'),
      activity.userName || activity.username || 'Unknown',
      activity.actionType || activity.activityType || 'N/A',
      (activity.description || 'No description').substring(0, 60) + 
        (activity.description && activity.description.length > 60 ? '...' : '')
    ]);
    
    autoTable(doc, {
      head: [activityColumns],
      body: activityRows,
      startY: yPosition,
      theme: 'striped',
      headStyles: { 
        fillColor: COLORS.secondary,
        textColor: COLORS.white,
        fontSize: 11,
        fontStyle: 'bold'
      },
      styles: { 
        fontSize: 9,
        cellPadding: 3,
        lineColor: COLORS.light,
        lineWidth: 0.5
      },
      alternateRowStyles: { fillColor: [249, 249, 249] },
      margin: { left: 20, right: 20 },
    });
  } else {
    if (yPosition > 250) {
      doc.addPage();
      addPDFHeader(doc, 'User Management Report', 'Recent Activity');
      yPosition = 50;
    }
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.secondary);
    doc.text('No recent activity data available.', 20, yPosition);
  }
  
  // Add footer
  addPDFFooter(doc, 1, 1);
  
  // Download
  const timestamp = format(new Date(), 'yyyy-MM-dd-HHmmss');
  doc.save(`user-report-${timestamp}.pdf`);
};

// Enhanced Expense Trends PDF
export const exportExpenseTrendsToPDF = async (data: any) => {
  const doc = new jsPDF();
  
  addPDFHeader(doc, 'Expense Analytics Report', 'Detailed expense trends and category analysis');
  
  let yPosition = 50;
  
  // Handle empty or invalid data
  if (!data || typeof data !== 'object') {
    doc.setFontSize(14);
    doc.setTextColor(...COLORS.danger);
    doc.text('No expense data available for this report.', 20, yPosition);
    doc.text('Please ensure you have expense records in the system.', 20, yPosition + 20);
    addPDFFooter(doc, 1, 1);
    const timestamp = format(new Date(), 'yyyy-MM-dd-HHmmss');
    doc.save(`expense-trends-${timestamp}.pdf`);
    return;
  }
  
  // Summary Cards
  const totalExpenses = data.expenseTrends?.reduce((sum: number, trend: any) => sum + (trend.totalAmount || 0), 0) || 0;
  const totalTransactions = data.expenseTrends?.reduce((sum: number, trend: any) => sum + (trend.transactionCount || 0), 0) || 0;
  const avgPerTransaction = totalTransactions > 0 ? totalExpenses / totalTransactions : 0;
  
  addSummaryCard(doc, 20, yPosition, 40, 25, 'Total Expenses', formatCurrency(totalExpenses), COLORS.danger);
  addSummaryCard(doc, 65, yPosition, 40, 25, 'Total Transactions', totalTransactions.toString(), COLORS.primary);
  addSummaryCard(doc, 110, yPosition, 40, 25, 'Avg per Transaction', formatCurrency(avgPerTransaction), COLORS.warning);
  
  yPosition += 40;
  
  // Monthly Trends
  if (data.expenseTrends && data.expenseTrends.length > 0) {
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.primary);
    doc.text('Monthly Expense Trends', 20, yPosition);
    yPosition += 10;
    
    const trendColumns = ['Month', 'Total Amount', 'Transaction Count', 'Average per Transaction', 'Change from Previous'];
    const trendRows = data.expenseTrends.map((trend: any, index: number) => {
      const prevTrend = index > 0 ? data.expenseTrends[index - 1] : null;
      const change = prevTrend ? ((trend.totalAmount - prevTrend.totalAmount) / prevTrend.totalAmount * 100) : 0;
      
      return [
        format(new Date(trend.date), 'MMM yyyy'),
        formatCurrency(trend.totalAmount || 0),
        (trend.transactionCount || 0).toString(),
        formatCurrency((trend.totalAmount || 0) / Math.max(1, trend.transactionCount || 1)),
        prevTrend ? `${change >= 0 ? '+' : ''}${change.toFixed(1)}%` : 'N/A'
      ];
    });
    
    autoTable(doc, {
      head: [trendColumns],
      body: trendRows,
      startY: yPosition,
      theme: 'striped',
      headStyles: { 
        fillColor: COLORS.primary,
        textColor: COLORS.white,
        fontSize: 10,
        fontStyle: 'bold'
      },
      styles: { 
        fontSize: 9,
        cellPadding: 3,
        lineColor: COLORS.light,
        lineWidth: 0.5
      },
      alternateRowStyles: { fillColor: [249, 249, 249] },
      margin: { left: 20, right: 20 },
    });
    
    yPosition = (doc as any).lastAutoTable.finalY + 20;
  } else {
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.secondary);
    doc.text('No monthly expense trends available.', 20, yPosition);
    yPosition += 20;
  }
  
  // Category Breakdown
  if (data.topCategories && data.topCategories.length > 0) {
    if (yPosition > 200) {
      doc.addPage();
      addPDFHeader(doc, 'Expense Analytics Report', 'Category Breakdown');
      yPosition = 50;
    }
    
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.primary);
    doc.text('Expense Categories Breakdown', 20, yPosition);
    yPosition += 10;
    
    const categoryColumns = ['Category', 'Total Amount', 'Transaction Count', '% of Total', 'Avg per Transaction'];
    const categoryRows = data.topCategories.map((cat: any) => [
      cat.name || cat.categoryName || 'Unknown',
      formatCurrency(cat.totalAmount || 0),
      (cat.count || 0).toString(),
      totalExpenses > 0 ? `${((cat.totalAmount / totalExpenses) * 100).toFixed(1)}%` : '0%',
      formatCurrency((cat.totalAmount || 0) / Math.max(1, cat.count || 1))
    ]);
    
    autoTable(doc, {
      head: [categoryColumns],
      body: categoryRows,
      startY: yPosition,
      theme: 'striped',
      headStyles: { 
        fillColor: COLORS.secondary,
        textColor: COLORS.white,
        fontSize: 10,
        fontStyle: 'bold'
      },
      styles: { 
        fontSize: 9,
        cellPadding: 3,
        lineColor: COLORS.light,
        lineWidth: 0.5
      },
      alternateRowStyles: { fillColor: [249, 249, 249] },
      margin: { left: 20, right: 20 },
    });
  } else {
    if (yPosition > 250) {
      doc.addPage();
      addPDFHeader(doc, 'Expense Analytics Report', 'Category Breakdown');
      yPosition = 50;
    }
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.secondary);
    doc.text('No category data available.', 20, yPosition);
  }
  
  addPDFFooter(doc, 1, 1);
  
  const timestamp = format(new Date(), 'yyyy-MM-dd-HHmmss');
  doc.save(`expense-trends-${timestamp}.pdf`);
};

// Enhanced Financial Overview PDF
export const exportFinancialOverviewToPDF = async (data: any) => {
  const doc = new jsPDF();
  
  addPDFHeader(doc, 'Financial Overview Report', 'Complete financial summary and insights');
  
  let yPosition = 50;
  
  // Key Financial Metrics
  const totalIncome = data.totalIncomeAmount || 0;
  const totalExpenses = data.totalExpenseAmount || 0;
  const netIncome = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? ((netIncome / totalIncome) * 100) : 0;
  
  addSummaryCard(doc, 20, yPosition, 37, 25, 'Total Income', formatCurrency(totalIncome), COLORS.success);
  addSummaryCard(doc, 62, yPosition, 37, 25, 'Total Expenses', formatCurrency(totalExpenses), COLORS.danger);
  addSummaryCard(doc, 104, yPosition, 37, 25, 'Net Income', formatCurrency(netIncome), netIncome >= 0 ? COLORS.success : COLORS.danger);
  addSummaryCard(doc, 146, yPosition, 37, 25, 'Savings Rate', `${savingsRate.toFixed(1)}%`, savingsRate >= 20 ? COLORS.success : savingsRate >= 10 ? COLORS.warning : COLORS.danger);
  
  yPosition += 40;
  
  // Budget Performance
  if (data.budgetPerformance && data.budgetPerformance.length > 0) {
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.primary);
    doc.text('Budget Performance', 20, yPosition);
    yPosition += 10;
    
    const budgetColumns = ['Budget Name', 'Allocated', 'Spent', 'Remaining', 'Utilization', 'Status'];
    const budgetRows = data.budgetPerformance.map((budget: any) => {
      const utilization = ((budget.spent / budget.allocated) * 100);
      const status = utilization > 100 ? 'Over Budget' : utilization > 80 ? 'Near Limit' : 'On Track';
      
      return [
        budget.name || 'Unknown',
        formatCurrency(budget.allocated || 0),
        formatCurrency(budget.spent || 0),
        formatCurrency((budget.allocated || 0) - (budget.spent || 0)),
        `${utilization.toFixed(1)}%`,
        status
      ];
    });
    
    autoTable(doc, {
      head: [budgetColumns],
      body: budgetRows,
      startY: yPosition,
      theme: 'striped',
      headStyles: { 
        fillColor: COLORS.primary,
        textColor: COLORS.white,
        fontSize: 10,
        fontStyle: 'bold'
      },
      styles: { 
        fontSize: 9,
        cellPadding: 3,
        lineColor: COLORS.light,
        lineWidth: 0.5
      },
      alternateRowStyles: { fillColor: [249, 249, 249] },
      margin: { left: 20, right: 20 },
      didParseCell: (data) => {
        // Color code the status column
        if (data.column.index === 5) {
          const status = data.cell.text[0];
          if (status === 'Over Budget') {
            data.cell.styles.textColor = COLORS.danger;
            data.cell.styles.fontStyle = 'bold';
          } else if (status === 'Near Limit') {
            data.cell.styles.textColor = COLORS.warning;
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = COLORS.success;
          }
        }
      }
    });
    
    yPosition = (doc as any).lastAutoTable.finalY + 20;
  }
  
  // Income vs Expense Trends
  if (data.incomeVsExpenseTrends && data.incomeVsExpenseTrends.length > 0) {
    if (yPosition > 200) {
      doc.addPage();
      addPDFHeader(doc, 'Financial Overview Report', 'Income vs Expense Trends');
      yPosition = 50;
    }
    
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.primary);
    doc.text('Income vs Expense Trends', 20, yPosition);
    yPosition += 10;
    
    const trendColumns = ['Month', 'Income', 'Expenses', 'Net Income', 'Savings Rate'];
    const trendRows = data.incomeVsExpenseTrends.map((trend: any) => {
      const income = trend.totalIncome || 0;
      const expenses = trend.totalExpenses || 0;
      const net = income - expenses;
      const rate = income > 0 ? ((net / income) * 100) : 0;
      
      return [
        format(new Date(trend.date), 'MMM yyyy'),
        formatCurrency(income),
        formatCurrency(expenses),
        formatCurrency(net),
        `${rate.toFixed(1)}%`
      ];
    });
    
    autoTable(doc, {
      head: [trendColumns],
      body: trendRows,
      startY: yPosition,
      theme: 'striped',
      headStyles: { 
        fillColor: COLORS.secondary,
        textColor: COLORS.white,
        fontSize: 10,
        fontStyle: 'bold'
      },
      styles: { 
        fontSize: 9,
        cellPadding: 3,
        lineColor: COLORS.light,
        lineWidth: 0.5
      },
      alternateRowStyles: { fillColor: [249, 249, 249] },
      margin: { left: 20, right: 20 },
      didParseCell: (data) => {
        // Color code net income and savings rate
        if (data.column.index === 3 || data.column.index === 4) {
          const value = data.cell.text[0];
          if (data.column.index === 3) {
            // Net income
            if (value.includes('-')) {
              data.cell.styles.textColor = COLORS.danger;
            } else {
              data.cell.styles.textColor = COLORS.success;
            }
          } else {
            // Savings rate
            const rate = parseFloat(value.replace('%', ''));
            if (rate >= 20) {
              data.cell.styles.textColor = COLORS.success;
            } else if (rate >= 10) {
              data.cell.styles.textColor = COLORS.warning;
            } else {
              data.cell.styles.textColor = COLORS.danger;
            }
          }
        }
      }
    });
  }
  
  addPDFFooter(doc, 1, 1);
  
  const timestamp = format(new Date(), 'yyyy-MM-dd-HHmmss');
  doc.save(`financial-overview-${timestamp}.pdf`);
};

// Enhanced Admin History PDF
export const exportAdminHistoryToPDF = async (data: any[], filters: any = {}) => {
  const doc = new jsPDF();
  
  // Create filter summary
  const filterSummary = [];
  if (filters.search) filterSummary.push(`Search: "${filters.search}"`);
  if (filters.userId) filterSummary.push(`User ID: ${filters.userId}`);
  if (filters.category) filterSummary.push(`Category: ${filters.category}`);
  if (filters.activityType) filterSummary.push(`Activity: ${filters.activityType}`);
  if (filters.startDate) filterSummary.push(`From: ${format(new Date(filters.startDate), 'MMM dd, yyyy')}`);
  if (filters.endDate) filterSummary.push(`To: ${format(new Date(filters.endDate), 'MMM dd, yyyy')}`);
  
  const subtitle = filterSummary.length > 0 ? `Filters Applied: ${filterSummary.join(' | ')}` : 'Complete admin activity log';
  
  addPDFHeader(doc, 'Admin Activity History', subtitle);
  
  let yPosition = 50;
  
  // Summary stats
  const totalActivities = data.length;
  const uniqueUsers = new Set(data.map(item => item.userId)).size;
  const dateRange = data.length > 0 ? {
    from: new Date(Math.min(...data.map(item => new Date(item.timestamp).getTime()))),
    to: new Date(Math.max(...data.map(item => new Date(item.timestamp).getTime())))
  } : null;
  
  addSummaryCard(doc, 20, yPosition, 45, 25, 'Total Activities', totalActivities.toString(), COLORS.primary);
  addSummaryCard(doc, 70, yPosition, 45, 25, 'Unique Users', uniqueUsers.toString(), COLORS.secondary);
  if (dateRange) {
    addSummaryCard(doc, 120, yPosition, 65, 25, 'Date Range', 
      `${format(dateRange.from, 'MMM dd')} - ${format(dateRange.to, 'MMM dd, yyyy')}`, COLORS.warning);
  }
  
  yPosition += 40;
  
  // Activity breakdown by type
  const activityTypes = data.reduce((acc: any, item: any) => {
    acc[item.activityType] = (acc[item.activityType] || 0) + 1;
    return acc;
  }, {});
  
  if (Object.keys(activityTypes).length > 0) {
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.primary);
    doc.text('Activity Breakdown', 20, yPosition);
    yPosition += 10;
    
    const typeColumns = ['Activity Type', 'Count', 'Percentage'];
    const typeRows = Object.entries(activityTypes)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .map(([type, count]) => [
        type,
        (count as number).toString(),
        `${((count as number / totalActivities) * 100).toFixed(1)}%`
      ]);
    
    autoTable(doc, {
      head: [typeColumns],
      body: typeRows,
      startY: yPosition,
      theme: 'striped',
      headStyles: { 
        fillColor: COLORS.primary,
        textColor: COLORS.white,
        fontSize: 11,
        fontStyle: 'bold'
      },
      styles: { 
        fontSize: 10,
        cellPadding: 4,
        lineColor: COLORS.light,
        lineWidth: 0.5
      },
      alternateRowStyles: { fillColor: [249, 249, 249] },
      margin: { left: 20, right: 20 },
    });
    
    yPosition = (doc as any).lastAutoTable.finalY + 20;
  }
  
  // Detailed activity log
  if (data.length > 0) {
    if (yPosition > 200) {
      doc.addPage();
      addPDFHeader(doc, 'Admin Activity History', 'Detailed Activity Log');
      yPosition = 50;
    }
    
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.primary);
    doc.text('Detailed Activity Log', 20, yPosition);
    yPosition += 10;
    
    const activityColumns = ['Date & Time', 'User', 'Activity', 'Category', 'Description'];
    const activityRows = data.slice(0, 50).map((activity: any) => [
      format(new Date(activity.timestamp), 'MMM dd, yyyy HH:mm'),
      activity.username || `User ${activity.userId}`,
      activity.activityType || 'Unknown',
      activity.category || 'N/A',
      (activity.description || 'No description').substring(0, 60) + 
        (activity.description && activity.description.length > 60 ? '...' : '')
    ]);
    
    autoTable(doc, {
      head: [activityColumns],
      body: activityRows,
      startY: yPosition,
      theme: 'striped',
      headStyles: { 
        fillColor: COLORS.secondary,
        textColor: COLORS.white,
        fontSize: 10,
        fontStyle: 'bold'
      },
      styles: { 
        fontSize: 8,
        cellPadding: 2,
        lineColor: COLORS.light,
        lineWidth: 0.5
      },
      alternateRowStyles: { fillColor: [249, 249, 249] },
      margin: { left: 20, right: 20 },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 30 },
        2: { cellWidth: 25 },
        3: { cellWidth: 20 },
        4: { cellWidth: 60 }
      }
    });
    
    // Add note if data was truncated
    if (data.length > 50) {
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(10);
      doc.setTextColor(...COLORS.warning);
      doc.text(`Note: Showing first 50 of ${data.length} activities. Apply filters for more specific results.`, 20, finalY);
    }
  }
  
  addPDFFooter(doc, 1, 1);
  
  const timestamp = format(new Date(), 'yyyy-MM-dd-HHmmss');
  doc.save(`admin-history-${timestamp}.pdf`);
};

// Generic function to handle PDF exports from admin dashboard
export const exportAdminReportToPDF = async (reportType: string, data: any, filters?: any) => {
  try {
    // Add loading indicator or validation here if needed
    console.log(`Generating PDF for report type: ${reportType}`, data);
    
    switch (reportType) {
      case 'users':
        await exportUserReportToPDF(data);
        break;
      case 'expenses':
        await exportExpenseTrendsToPDF(data);
        break;
      case 'overview':
        await exportFinancialOverviewToPDF(data);
        break;
      case 'history':
        await exportAdminHistoryToPDF(data, filters);
        break;
      default:
        // Fallback for unknown report types
        const doc = new jsPDF();
        addPDFHeader(doc, `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`, 'Generated from admin dashboard');
        
        let yPosition = 60;
        doc.setFontSize(14);
        doc.setTextColor(...COLORS.text);
        doc.text('Report data:', 20, yPosition);
        yPosition += 20;
        
        // Check if data is available
        if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
          doc.setFontSize(12);
          doc.setTextColor(...COLORS.danger);
          doc.text('No data available for this report type.', 20, yPosition);
          doc.text('Please ensure the system has relevant data to generate this report.', 20, yPosition + 15);
        } else {
          // Display basic information about the data
          doc.setFontSize(12);
          doc.setTextColor(...COLORS.secondary);
          doc.text('This report type is not yet fully implemented.', 20, yPosition);
          yPosition += 15;
          doc.text('Available data fields:', 20, yPosition);
          yPosition += 15;
          
          // List available fields
          if (typeof data === 'object') {
            const fields = Object.keys(data).slice(0, 10); // Limit to first 10 fields
            fields.forEach(field => {
              doc.setFontSize(10);
              doc.text(`• ${field}: ${typeof data[field]}`, 25, yPosition);
              yPosition += 10;
              if (yPosition > 250) return; // Stop if we reach bottom of page
            });
          }
        }
        
        addPDFFooter(doc, 1, 1);
        
        const timestamp = format(new Date(), 'yyyy-MM-dd-HHmmss');
        doc.save(`${reportType}-report-${timestamp}.pdf`);
        break;
    }
  } catch (error) {
    console.error('Error generating PDF:', error);
    
    // Create an error PDF
    const doc = new jsPDF();
    addPDFHeader(doc, 'PDF Generation Error', 'An error occurred while generating this report');
    
    doc.setFontSize(14);
    doc.setTextColor(...COLORS.danger);
    doc.text('Error generating PDF report', 20, 60);
    
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.text);
    doc.text('Please try again later or contact support if the issue persists.', 20, 80);
    
    if (error instanceof Error) {
      doc.setFontSize(10);
      doc.setTextColor(...COLORS.secondary);
      doc.text(`Error details: ${error.message}`, 20, 100);
    }
    
    addPDFFooter(doc, 1, 1);
    
    const timestamp = format(new Date(), 'yyyy-MM-dd-HHmmss');
    doc.save(`error-report-${timestamp}.pdf`);
    
    throw new Error('Failed to generate PDF report');
  }
};