import React, { useState, useEffect } from 'react';
import {
  Container, Typography, Card, CardContent, Grid, Alert,
  CircularProgress, Chip, List, ListItem, ListItemText,
  Box, LinearProgress, FormControl, InputLabel, Select, MenuItem, Divider
} from '@mui/material';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const PIE_COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6'];
const fmt = n => `₹${Number(n).toLocaleString('en-IN')}`;

// ── Pure local finance calculator — reads directly from localStorage ──────────
const calcFinanceData = () => {
  try {
    const raw = localStorage.getItem('userTransactions');
    if (!raw) return null;
    const txns = JSON.parse(raw).map(t => ({
      category: t.Category ?? t.category ?? 'Other',
      debit:    Number(t.Debit   ?? t.debit   ?? 0),
      credit:   Number(t.Credit  ?? t.credit  ?? 0),
      balance:  Number(t.Balance ?? t.balance ?? 0),
    }));
    if (!txns.length) return null;

    // These are ALREADY this period's totals — do NOT divide by 12
    const totalIncome   = txns.reduce((s,t) => s + t.credit, 0);
    const totalExpenses = txns.reduce((s,t) => s + t.debit,  0);
    const savings       = totalIncome - totalExpenses;
    const savingsRate   = totalIncome > 0 ? (savings / totalIncome) * 100 : 0;

    const categoryExpenses = {};
    txns.forEach(t => {
      if (t.debit > 0) categoryExpenses[t.category] = (categoryExpenses[t.category]||0) + t.debit;
    });

    const lastBalance = txns[txns.length - 1]?.balance ?? savings;

    return { totalIncome, totalExpenses, savings, savingsRate, categoryExpenses, currentBalance: lastBalance };
  } catch { return null; }
};

// ── Allocation profiles per (risk, timeframe) ─────────────────────────────────
const ALLOCATIONS = {
  conservative: {
    short:  { 'Liquid FD / Savings': 0.50, 'Debt Mutual Funds': 0.30, 'Gold ETF': 0.15, 'Equity Index Fund': 0.05 },
    medium: { 'Fixed Deposits': 0.35, 'Debt Mutual Funds': 0.30, 'Gold ETF': 0.20, 'Equity Index Fund': 0.15 },
    long:   { 'Fixed Deposits': 0.25, 'Debt Mutual Funds': 0.25, 'Gold ETF': 0.20, 'Equity Index Fund': 0.30 },
  },
  moderate: {
    short:  { 'Liquid FD / Savings': 0.30, 'Debt Mutual Funds': 0.30, 'Equity Funds': 0.25, 'Gold ETF': 0.15 },
    medium: { 'Equity Funds': 0.35, 'Debt Mutual Funds': 0.25, 'Fixed Deposits': 0.20, 'Gold ETF': 0.20 },
    long:   { 'Equity Funds': 0.45, 'Mutual Funds (Flexi)': 0.25, 'Fixed Deposits': 0.15, 'Gold ETF': 0.15 },
  },
  aggressive: {
    short:  { 'Equity / Stocks': 0.40, 'Sectoral Funds': 0.25, 'Debt Funds': 0.20, 'Gold': 0.15 },
    medium: { 'Equity / Stocks': 0.55, 'Mid-cap Funds': 0.25, 'Gold': 0.10, 'Debt Funds': 0.10 },
    long:   { 'Equity / Stocks': 0.60, 'Small / Mid-cap': 0.25, 'Gold / REITs': 0.10, 'Debt Funds': 0.05 },
  },
};

const DISCRETIONARY = new Set(['Entertainment','Food Delivery','Shopping','Travel','Luxury','Other']);

// ── Recommendation engine ─────────────────────────────────────────────────────
const buildRecommendations = (fd, risk, timeframe) => {
  const recs = [];
  const { totalIncome, totalExpenses, savings, savingsRate, categoryExpenses, currentBalance } = fd;

  // 1. Emergency fund — target 3 months of expenses (since we only have 1 month data)
  const efTarget = totalExpenses * 3;
  const efGap    = Math.max(0, efTarget - currentBalance);
  if (efGap > 0) {
    recs.push({
      type: 'Emergency', priority: 'Critical', timeframe: '3–6 months',
      title: 'Build Your Emergency Fund',
      message: `You need ${fmt(efTarget)} (3 months of expenses). Current balance: ${fmt(currentBalance)}.`,
      action:  `Save ${fmt(Math.round(efGap / 3))} each month for the next 3 months to close the ${fmt(efGap)} gap.`,
    });
  } else {
    recs.push({
      type: 'Success', priority: 'Low', timeframe: 'Ongoing',
      title: '🎉 Emergency Fund Adequate',
      message: `Your balance (${fmt(currentBalance)}) covers 3+ months of expenses (${fmt(totalExpenses)}/month).`,
      action: 'Consider investing surplus beyond the emergency buffer.',
    });
  }

  // 2. Savings rate
  const targetRate = { conservative: 25, moderate: 20, aggressive: 15 }[risk];
  if (savingsRate < targetRate) {
    const discCats = Object.entries(categoryExpenses)
      .filter(([c]) => DISCRETIONARY.has(c))
      .sort((a,b) => b[1]-a[1]);
    const suggestion = discCats.length
      ? `Reduce ${discCats[0][0]} (${fmt(discCats[0][1])}) — it's your top flexible expense.`
      : 'Review non-essential expenses for reduction opportunities.';
    recs.push({
      type: 'Savings', priority: 'High', timeframe: '1–3 months',
      title: 'Improve Your Savings Rate',
      message: `Current savings rate: ${savingsRate.toFixed(1)}%. Target for ${risk} profile: ${targetRate}%.`,
      action: suggestion,
      amount: Math.round(totalIncome * (targetRate/100) - savings),
    });
  } else {
    recs.push({
      type: 'Success', priority: 'Low', timeframe: 'Ongoing',
      title: '✅ Savings Target Met',
      message: `You're saving ${savingsRate.toFixed(1)}% — above the ${targetRate}% target for your ${risk} profile.`,
      action: 'Redirect surplus savings to your investment allocation plan below.',
    });
  }

  // 3. Top discretionary spend insight
  const discEntries = Object.entries(categoryExpenses).filter(([c]) => DISCRETIONARY.has(c)).sort((a,b)=>b[1]-a[1]);
  if (discEntries.length) {
    const [cat, amt] = discEntries[0];
    const saving20 = Math.round(amt * 0.20);
    recs.push({
      type: 'Spending', priority: 'Medium', timeframe: 'This month',
      title: `Cut ${cat} by 20%`,
      message: `${cat} is your largest flexible expense at ${fmt(amt)} this period.`,
      action: `A 20% reduction saves ${fmt(saving20)} — without touching any essential bills.`,
      amount: saving20,
    });
  }

  // 4. 50-30-20 budget check
  const needsPct  = (totalExpenses / totalIncome) * 100;
  const wantsCats = discEntries.reduce((s,[,v])=>s+v, 0);
  const wantsPct  = totalIncome > 0 ? (wantsCats / totalIncome) * 100 : 0;
  recs.push({
    type: 'Budget', priority: 'Medium', timeframe: 'Monthly',
    title: '50-30-20 Budget Check',
    message: `Needs: ${needsPct.toFixed(0)}% of income | Flexible: ${wantsPct.toFixed(0)}% | Savings: ${savingsRate.toFixed(0)}%`,
    action: `Ideal targets — Needs ≤50%: ${needsPct<=50?'✅':'❌'}  |  Flexible ≤30%: ${wantsPct<=30?'✅':'❌'}  |  Savings ≥20%: ${savingsRate>=20?'✅':'❌'}`,
  });

  return recs;
};

// ─── Component ────────────────────────────────────────────────────────────────
const Recommendations = () => {
  const [riskProfile, setRiskProfile] = useState('moderate');
  const [timeframe,   setTimeframe]   = useState('medium');

  const financeData = calcFinanceData();

  if (!financeData) return (
    <Container maxWidth="lg" sx={{ py:4 }}>
      <Alert severity="info">Please enter your transactions in the <strong>Transactions</strong> tab first.</Alert>
    </Container>
  );

  const { totalIncome, totalExpenses, savings, savingsRate, categoryExpenses } = financeData;
  const recs       = buildRecommendations(financeData, riskProfile, timeframe);
  const allocation = ALLOCATIONS[riskProfile][timeframe];
  const allocData  = Object.entries(allocation).map(([name, pct]) => ({
    name, pct, amount: Math.round(savings * pct),
  }));

  return (
    <Container maxWidth="lg" sx={{ py:4 }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom textAlign="center">
        Personalised Financial Recommendations
      </Typography>
      <Typography variant="body2" textAlign="center" color="text.secondary" sx={{ mb:4 }}>
        Computed from your actual transactions — adjust profile and timeframe to personalise.
      </Typography>

      {/* Controls */}
      <Box sx={{ display:'flex', justifyContent:'center', gap:3, mb:4, flexWrap:'wrap' }}>
        <FormControl sx={{ minWidth:200 }}>
          <InputLabel>Risk Profile</InputLabel>
          <Select value={riskProfile} label="Risk Profile" onChange={e=>setRiskProfile(e.target.value)}>
            <MenuItem value="conservative">Conservative</MenuItem>
            <MenuItem value="moderate">Moderate</MenuItem>
            <MenuItem value="aggressive">Aggressive</MenuItem>
          </Select>
        </FormControl>
        <FormControl sx={{ minWidth:200 }}>
          <InputLabel>Investment Timeframe</InputLabel>
          <Select value={timeframe} label="Investment Timeframe" onChange={e=>setTimeframe(e.target.value)}>
            <MenuItem value="short">Short-term (1–3 years)</MenuItem>
            <MenuItem value="medium">Medium-term (3–10 years)</MenuItem>
            <MenuItem value="long">Long-term (10+ years)</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Summary cards — show ACTUAL period totals, no /12 division */}
      <Grid container spacing={2} sx={{ mb:4 }}>
        {[
          { label:'Income This Period',    value:fmt(totalIncome),             color:'#10b981', bg:'#d1fae5' },
          { label:'Expenses This Period',  value:fmt(totalExpenses),           color:'#ef4444', bg:'#fee2e2' },
          { label:'Net Savings',           value:fmt(savings),                 color:'#6366f1', bg:'#ede9fe' },
          { label:'Savings Rate',          value:`${savingsRate.toFixed(1)}%`, color:'#f59e0b', bg:'#fef3c7' },
        ].map(c => (
          <Grid item xs={6} md={3} key={c.label}>
            <Card sx={{ borderTop:`4px solid ${c.color}`, bgcolor:c.bg }}>
              <CardContent sx={{ py:1.5, textAlign:'center' }}>
                <Typography variant="caption" color="text.secondary">{c.label}</Typography>
                <Typography variant="h5" fontWeight="bold" sx={{ color:c.color }}>{c.value}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>

        {/* Action cards */}
        <Grid item xs={12} md={8}>
          <Card><CardContent>
            <Typography variant="h6" fontWeight="bold" gutterBottom>🎯 Your Action Plan</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb:2 }}>
              Based on <strong>{riskProfile}</strong> profile · <strong>{timeframe}-term</strong> horizon
            </Typography>
            <Grid container spacing={2}>
              {recs.map((rec,i) => (
                <Grid item xs={12} md={6} key={i}>
                  <Card variant="outlined" sx={{
                    height:'100%',
                    borderLeft:4,
                    borderLeftColor:
                      rec.priority==='Critical' ? 'error.main' :
                      rec.priority==='High'     ? 'warning.main' :
                      rec.priority==='Medium'   ? 'info.main' : 'success.main'
                  }}>
                    <CardContent>
                      <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', mb:1 }}>
                        <Typography variant="subtitle1" fontWeight="bold" sx={{ fontSize:'0.95rem' }}>
                          {rec.title}
                        </Typography>
                        <Chip label={rec.priority} size="small"
                          color={rec.priority==='Critical'?'error':rec.priority==='High'?'warning':rec.priority==='Medium'?'info':'success'} />
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb:1 }}>{rec.message}</Typography>
                      <Typography variant="body2" fontWeight="medium">{rec.action}</Typography>
                      {rec.amount > 0 && (
                        <Typography variant="body2" color="primary.main" fontWeight="bold" sx={{ mt:0.5 }}>
                          Target: {fmt(rec.amount)}
                        </Typography>
                      )}
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt:0.5 }}>
                        ⏱ {rec.timeframe}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </CardContent></Card>

          {/* 50-30-20 breakdown */}
          <Card sx={{ mt:3 }}><CardContent>
            <Typography variant="h6" fontWeight="bold" gutterBottom>📊 50-30-20 Budget Breakdown</Typography>
            <Grid container spacing={2}>
              {[
                { label:'50% Needs (target)',    val:fmt(Math.round(totalIncome*0.50)), actual:fmt(totalExpenses),         color:'#6366f1' },
                { label:'30% Wants (target)',    val:fmt(Math.round(totalIncome*0.30)), actual:fmt(Object.values(categoryExpenses).reduce((s,v)=>s+v,0) - totalExpenses > 0 ? 0 : 0), color:'#f59e0b' },
                { label:'20% Savings (target)',  val:fmt(Math.round(totalIncome*0.20)), actual:fmt(savings),               color:'#10b981' },
              ].map(row => (
                <Grid item xs={12} md={4} key={row.label}>
                  <Box sx={{ p:1.5, bgcolor:'grey.800', borderRadius:2, border: '1px solid #333' }}>
                    <Typography variant="caption" color="text.secondary">{row.label}</Typography>
                    <Typography variant="h6" fontWeight="bold" sx={{ color:row.color }}>{row.val}</Typography>
                    <Typography variant="caption" color="text.secondary">Actual: {row.actual}</Typography>
                    <LinearProgress variant="determinate"
                      value={Math.min(100, row.label.includes('Savings')
                        ? Math.max(0, savingsRate)
                        : Math.max(0, (totalExpenses/totalIncome)*100))}
                      sx={{ mt:0.5, height:5, borderRadius:3,
                        '& .MuiLinearProgress-bar':{ bgcolor:row.color } }} />
                  </Box>
                </Grid>
              ))}
            </Grid>
          </CardContent></Card>
        </Grid>

        {/* Allocation chart */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height:'fit-content' }}><CardContent>
            <Typography variant="h6" fontWeight="bold" gutterBottom>💰 Savings Allocation</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb:1 }}>
              How to invest your {fmt(savings)} · <strong>{riskProfile}</strong> · <strong>{timeframe}-term</strong>
            </Typography>

            {savings <= 0 ? (
              <Alert severity="warning">Build savings first before investing.</Alert>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={allocData} dataKey="amount" nameKey="name"
                      cx="50%" cy="50%" outerRadius={75} innerRadius={35}>
                      {allocData.map((_,i) => <Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v,n)=>[fmt(v), n]} />
                  </PieChart>
                </ResponsiveContainer>

                <Divider sx={{ my:1.5 }} />

                {allocData.map((item,i) => (
                  <Box key={item.name} sx={{ mb:1.2 }}>
                    <Box sx={{ display:'flex', justifyContent:'space-between', mb:0.2 }}>
                      <Box sx={{ display:'flex', alignItems:'center', gap:0.8 }}>
                        <Box sx={{ width:10, height:10, borderRadius:'50%', bgcolor:PIE_COLORS[i%PIE_COLORS.length] }} />
                        <Typography variant="caption">{item.name}</Typography>
                      </Box>
                      <Typography variant="caption" fontWeight="bold">
                        {fmt(item.amount)} ({(item.pct*100).toFixed(0)}%)
                      </Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={item.pct*100}
                      sx={{ height:4, borderRadius:2,
                        '& .MuiLinearProgress-bar':{ bgcolor:PIE_COLORS[i%PIE_COLORS.length] } }} />
                  </Box>
                ))}
              </>
            )}
          </CardContent></Card>

          {/* Next steps */}
          <Card sx={{ mt:3 }}><CardContent>
            <Typography variant="h6" fontWeight="bold" gutterBottom>🗺 Next Steps</Typography>
            {[
              { n:'1', title:'Emergency Fund First', sub:'Ensure 3–6 months of expenses is liquid.' },
              { n:'2', title:'Follow Allocation Plan', sub:'Invest per the chart for your profile.' },
              { n:'3', title:'Automate Savings',       sub:'Set up auto-transfer on salary day.' },
              { n:'4', title:'Review Monthly',         sub:'Update transactions and re-check plan.' },
            ].map(s => (
              <Box key={s.n} sx={{ display:'flex', gap:1.5, mb:1.5, alignItems:'flex-start' }}>
                <Box sx={{ width:24, height:24, borderRadius:'50%', bgcolor:'primary.main',
                  display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <Typography variant="caption" color="white" fontWeight="bold">{s.n}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" fontWeight="bold">{s.title}</Typography>
                  <Typography variant="caption" color="text.secondary">{s.sub}</Typography>
                </Box>
              </Box>
            ))}
          </CardContent></Card>
        </Grid>

      </Grid>
    </Container>
  );
};

export default Recommendations;