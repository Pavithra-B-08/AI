import React, { useState, useEffect } from 'react';
import {
  Container, Typography, Card, CardContent, Grid, Alert,
  Box, LinearProgress, Divider
} from '@mui/material';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import TrendingUpIcon    from '@mui/icons-material/TrendingUp';
import TrendingDownIcon  from '@mui/icons-material/TrendingDown';
import SavingsIcon       from '@mui/icons-material/Savings';
import WarningAmberIcon  from '@mui/icons-material/WarningAmber';
import AutoAwesomeIcon   from '@mui/icons-material/AutoAwesome';

const COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f97316'];
const fmt    = n => `₹${Number(n).toLocaleString('en-IN')}`;

// ── Pure rule-based insight engine — zero API calls, zero external services ───
// Categories that are fixed obligations — never suggest cutting these
const PRIORITY_CATS    = new Set(['Rent','Healthcare','Insurance','Tax Payment','Education','Utilities','Transportation']);
// Categories that are flexible and can be reduced
const DISCRETIONARY_CATS = new Set(['Entertainment','Food Delivery','Shopping','Travel','Luxury','Other']);

const generateInsights = ({ totalIncome, totalExpenses, netSavings, savingsRate, categoryData, dowData }) => {
  const insights = [];

  const discData     = categoryData.filter(c => DISCRETIONARY_CATS.has(c.name));
  const discTotal    = discData.reduce((s,c) => s+c.value, 0);
  const priorityTotal= categoryData.filter(c => PRIORITY_CATS.has(c.name)).reduce((s,c) => s+c.value, 0);
  const topDisc      = discData[0] || null; // highest discretionary spend
  const topDay       = [...dowData].sort((a,b) => b.amount - a.amount)[0];

  // 1. Savings health — suggest cutting ONLY discretionary, never priority
  if (savingsRate >= 30) {
    insights.push({ icon:'savings', title:'Strong Savings Rate',
      detail:`You saved ${savingsRate.toFixed(1)}% of income (${fmt(netSavings)}) — well above the recommended 20%. Keep it up.` });
  } else if (savingsRate >= 15) {
    const suggestion = topDisc
      ? `Consider trimming ${topDisc.name} (${fmt(topDisc.value)}) to close the gap.`
      : `Look for small discretionary cuts to reach 20%.`;
    insights.push({ icon:'savings', title:'Almost at Savings Target',
      detail:`You saved ${fmt(netSavings)} (${savingsRate.toFixed(1)}%) this period — just under the 20% goal. ${suggestion}` });
  } else if (savingsRate > 0) {
    const suggestion = topDisc
      ? `Reducing ${topDisc.name} (${fmt(topDisc.value)}) is your most actionable lever.`
      : `Focus on reducing flexible expenses to build a buffer.`;
    insights.push({ icon:'savings', title:'Savings Rate Needs Attention',
      detail:`Only ${savingsRate.toFixed(1)}% saved (${fmt(netSavings)}) against a 20% target. ${suggestion}` });
  } else {
    const suggestion = topDisc
      ? `Start by cutting ${topDisc.name} (${fmt(topDisc.value)}).`
      : `Review all non-essential expenses immediately.`;
    insights.push({ icon:'savings', title:'Expenses Exceed Income',
      detail:`Overspent by ${fmt(Math.abs(netSavings))} this period. Priority bills are fixed — ${suggestion}` });
  }

  // 2. Discretionary spend overview — only actionable if discretionary exists
  if (discData.length > 0) {
    const discPct = totalExpenses > 0 ? (discTotal / totalExpenses) * 100 : 0;
    if (discPct > 30) {
      insights.push({ icon:'opportunity', title:'Discretionary Spending is High',
        detail:`${discPct.toFixed(0)}% of expenses (${fmt(discTotal)}) went to flexible categories like ${discData.map(c=>c.name).slice(0,2).join(' & ')}. These are your best savings levers.` });
    } else if (discPct > 0) {
      insights.push({ icon:'pattern', title:'Discretionary Spending is Controlled',
        detail:`Only ${discPct.toFixed(0)}% of expenses (${fmt(discTotal)}) are in flexible categories. Most of your spending is on fixed obligations — good discipline.` });
    }
  } else {
    // All spending is priority — note this positively
    insights.push({ icon:'pattern', title:'All Spending is Essential',
      detail:`Every expense this period is a fixed obligation (${categoryData.map(c=>c.name).join(', ')}). No discretionary waste detected.` });
  }

  // 3. Biggest discretionary saving opportunity
  if (topDisc) {
    const saving20 = Math.round(topDisc.value * 0.20);
    insights.push({ icon:'opportunity', title:`Saving Opportunity: ${topDisc.name}`,
      detail:`${topDisc.name} cost ${fmt(topDisc.value)} this period. A 20% reduction here would save ${fmt(saving20)} — without touching any essential bills.` });
  } else if (totalIncome > 0) {
    // Fallback: income utilisation
    const ratio = (totalExpenses / totalIncome) * 100;
    insights.push({ icon:'pattern', title:'Income Utilisation',
      detail:`You used ${ratio.toFixed(0)}% of income on expenses (${fmt(totalExpenses)} of ${fmt(totalIncome)}). ${ratio < 80 ? 'Healthy ratio — keep it below 80%.' : 'Try to bring this below 80% next period.'}` });
  }

  // 4. Priority vs discretionary balance
  if (priorityTotal > 0 && discTotal > 0) {
    const priorityPct = totalExpenses > 0 ? (priorityTotal / totalExpenses) * 100 : 0;
    insights.push({ icon:'pattern', title:'Fixed vs Flexible Breakdown',
      detail:`${priorityPct.toFixed(0)}% of expenses are fixed obligations (${fmt(priorityTotal)}) and ${(100-priorityPct).toFixed(0)}% are flexible (${fmt(discTotal)}). Focus savings efforts on the flexible portion only.` });
  } else if (topDay && topDay.amount > 0 && discData.length > 0) {
    // Peak day — only mention if there's actually discretionary spend to act on
    insights.push({ icon:'opportunity', title:`Highest Spending Day: ${topDay.day}`,
      detail:`Most spending happened on ${topDay.day} (${fmt(topDay.amount)}). Check if any discretionary purchases on this day can be deferred or reduced.` });
  }

  return insights.slice(0, 4);
};

// ─── Component ────────────────────────────────────────────────────────────────
const SpendingAnalysis = () => {
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('userTransactions');
      if (raw) {
        setTransactions(JSON.parse(raw).map(t => ({
          date:        t.Date        ?? t.date        ?? '',
          description: t.Description ?? t.description ?? '',
          category:    t.Category    ?? t.category    ?? 'Other',
          debit:       Number(t.Debit   ?? t.debit   ?? 0),
          credit:      Number(t.Credit  ?? t.credit  ?? 0),
          balance:     Number(t.Balance ?? t.balance ?? 0),
        })));
      }
    } catch(e) { console.error('Failed to load transactions', e); }
  }, []);

  const metrics = React.useMemo(() => {
    if (!transactions.length) return null;

    const totalIncome   = transactions.reduce((s,t) => s + t.credit, 0);
    const totalExpenses = transactions.reduce((s,t) => s + t.debit,  0);
    const netSavings    = totalIncome - totalExpenses;
    const savingsRate   = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

    const catMap = {};
    transactions.forEach(t => { if (t.debit > 0) catMap[t.category] = (catMap[t.category]||0) + t.debit; });
    const categoryData = Object.entries(catMap)
      .map(([name, value]) => ({ name, value, pct: totalExpenses > 0 ? (value/totalExpenses)*100 : 0 }))
      .sort((a,b) => b.value - a.value);

    const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const dowMap = { Sun:0, Mon:0, Tue:0, Wed:0, Thu:0, Fri:0, Sat:0 };
    transactions.forEach(t => {
      if (t.debit > 0 && t.date) {
        const d = DOW[new Date(t.date).getDay()];
        if (d) dowMap[d] += t.debit;
      }
    });
    const dowData = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => ({ day, amount: dowMap[day] }));

    const dates = transactions.map(t=>t.date).filter(Boolean).sort();
    const dateRange = dates.length
      ? `${new Date(dates[0]).toLocaleDateString('en-IN',{day:'numeric',month:'short'})} – ${new Date(dates[dates.length-1]).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}`
      : 'This period';

    return { totalIncome, totalExpenses, netSavings, savingsRate, categoryData, dowData, dateRange };
  }, [transactions]);

  if (!transactions.length) return (
    <Container maxWidth="lg" sx={{ py:4 }}>
      <Alert severity="info">
        No transaction data found. Please enter your transactions in the <strong>Transactions</strong> tab first.
      </Alert>
    </Container>
  );
  if (!metrics) return null;

  const insights = generateInsights(metrics);
  const maxDow   = Math.max(...metrics.dowData.map(d => d.amount));
  const iconMap  = {
    pattern:     <TrendingUpIcon   sx={{ color:'#6366f1' }} />,
    category:    <WarningAmberIcon sx={{ color:'#f59e0b' }} />,
    savings:     <SavingsIcon      sx={{ color:'#10b981' }} />,
    opportunity: <TrendingDownIcon sx={{ color:'#ef4444' }} />,
  };

  return (
    <Container maxWidth="lg" sx={{ py:4 }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom textAlign="center">Spending Analysis</Typography>
      <Typography variant="body2" textAlign="center" color="text.secondary" sx={{ mb:3 }}>
        Based on <strong>{transactions.length} transaction{transactions.length!==1?'s':''}</strong> you entered · <strong>{metrics.dateRange}</strong>
      </Typography>

      {/* Summary cards */}
      <Grid container spacing={2} sx={{ mb:3 }}>
        {[
          { label:'Total Income',   value:fmt(metrics.totalIncome),             color:'#10b981', bg:'#d1fae5' },
          { label:'Total Expenses', value:fmt(metrics.totalExpenses),            color:'#ef4444', bg:'#fee2e2' },
          { label:'Net Savings',    value:fmt(metrics.netSavings),               color:'#6366f1', bg:'#ede9fe' },
          { label:'Savings Rate',   value:`${metrics.savingsRate.toFixed(1)}%`,  color:'#f59e0b', bg:'#fef3c7' },
        ].map(card => (
          <Grid item xs={6} md={3} key={card.label}>
            <Card sx={{ borderTop:`4px solid ${card.color}`, bgcolor:'grey.800', border: '1px solid #333' }}>
              <CardContent sx={{ py:1.5 }}>
                <Typography variant="caption" color="text.secondary">{card.label}</Typography>
                <Typography variant="h6" fontWeight="bold" sx={{ color:card.color }}>{card.value}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>

        {/* Category pie */}
        <Grid item xs={12} md={5}>
          <Card sx={{ height:'100%' }}><CardContent>
            <Typography variant="h6" fontWeight="bold" gutterBottom>Expenses by Category</Typography>
            {metrics.categoryData.length === 0
              ? <Typography color="text.secondary">No expense transactions found.</Typography>
              : <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={metrics.categoryData} dataKey="value" nameKey="name"
                        cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                        {metrics.categoryData.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={v=>[fmt(v),'Spent']} />
                    </PieChart>
                  </ResponsiveContainer>
                  <Box sx={{ mt:1 }}>
                    {metrics.categoryData.map((cat,i) => (
                      <Box key={cat.name} sx={{ mb:0.8 }}>
                        <Box sx={{ display:'flex', justifyContent:'space-between', mb:0.2 }}>
                          <Box sx={{ display:'flex', alignItems:'center', gap:0.8 }}>
                            <Box sx={{ width:10, height:10, borderRadius:'50%', bgcolor:COLORS[i%COLORS.length] }} />
                            <Typography variant="caption">{cat.name}</Typography>
                          </Box>
                          <Typography variant="caption" fontWeight="bold">
                            {fmt(cat.value)} ({cat.pct.toFixed(0)}%)
                          </Typography>
                        </Box>
                        <LinearProgress variant="determinate" value={Math.min(cat.pct,100)}
                          sx={{ height:4, borderRadius:2, '& .MuiLinearProgress-bar':{ bgcolor:COLORS[i%COLORS.length] } }} />
                      </Box>
                    ))}
                  </Box>
                </>
            }
          </CardContent></Card>
        </Grid>

        {/* Day of week */}
        <Grid item xs={12} md={7}>
          <Card sx={{ height:'100%' }}><CardContent>
            <Typography variant="h6" fontWeight="bold" gutterBottom>Spending by Day of Week</Typography>
            {metrics.dowData.every(d => d.amount === 0)
              ? <Alert severity="info">Add transaction dates to see day-of-week breakdown.</Alert>
              : <>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={metrics.dowData} margin={{ top:5, right:10, left:0, bottom:5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" tick={{ fontSize:12 }} />
                      <YAxis tickFormatter={v => v>=1000 ? `₹${(v/1000).toFixed(0)}k` : `₹${v}`} tick={{ fontSize:11 }} />
                      <Tooltip formatter={v=>[fmt(v),'Spent']} />
                      <Bar dataKey="amount" radius={[4,4,0,0]}>
                        {metrics.dowData.map((d,i) => (
                          <Cell key={i} fill={d.amount===maxDow && maxDow>0 ? '#ef4444' : '#6366f1'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <Typography variant="caption" color="text.secondary">
                    Red bar = highest spending day from your entered transactions.
                  </Typography>
                </>
            }
          </CardContent></Card>
        </Grid>

        {/* Rule-based insights */}
        <Grid item xs={12}>
          <Card><CardContent>
            <Box sx={{ display:'flex', alignItems:'center', gap:1, mb:1 }}>
              <AutoAwesomeIcon sx={{ color:'#6366f1' }} />
              <Typography variant="h6" fontWeight="bold">Spending Insights</Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb:2 }}>
              {/* Computed directly from your {transactions.length} transaction{transactions.length!==1?'s':''} — no external services or API calls. */}
            </Typography>
            <Divider sx={{ mb:2 }} />
            <Grid container spacing={2}>
              {insights.map((ins,i) => (
                <Grid item xs={12} sm={6} key={i}>
                  <Box sx={{ p:2, borderRadius:2, border:'1px solid', borderColor:'#333',
                    bgcolor:'#1a1a1a', display:'flex', gap:1.5, alignItems:'flex-start' }}>
                    <Box sx={{ mt:0.3, flexShrink:0 }}>
                      {iconMap[ins.icon] || <AutoAwesomeIcon sx={{ color:'#6366f1' }} />}
                    </Box>
                    <Box>
                      <Typography variant="subtitle2" fontWeight="bold" gutterBottom sx={{ color:'#ffffff' }}>{ins.title}</Typography>
                      <Typography variant="body2" color="text.secondary">{ins.detail}</Typography>
                    </Box>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </CardContent></Card>
        </Grid>

      </Grid>
    </Container>
  );
};

export default SpendingAnalysis;