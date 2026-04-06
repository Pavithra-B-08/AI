import React, { useState, useEffect } from 'react';
import {
  Container, Typography, Card, CardContent, Grid, Alert,
  CircularProgress, Box, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Divider, LinearProgress
} from '@mui/material';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts';

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300'];

// ─── Same formula used everywhere so named profiles are comparable to Monte Carlo
const calcMetrics = ({ stocks, bonds, gold, cash }) => {
  const s = stocks, b = bonds, g = gold, c = cash;
  const expectedReturn = s*0.12 + b*0.04 + g*0.06 + c*0.02;
  const volatility = Math.sqrt(
    s*s*0.18*0.18 + b*b*0.06*0.06 + g*g*0.15*0.15 + c*c*0.01*0.01
    + 2*s*b*0.18*0.06*0.20
    + 2*s*g*0.18*0.15*(-0.10)
    + 2*b*g*0.06*0.15*0.30
  );
  return { expectedReturn, volatility, sharpeRatio: expectedReturn / volatility };
};

// ─── DISTINCT allocations per profile → distinct metrics ─────────────────────
const buildProfiles = () => {
  const raw = {
    conservative: { label:'Conservative', chipColor:'success', stocks:0.10, bonds:0.50, gold:0.20, cash:0.20,
      description:'Capital preservation — heavy bonds & gold, minimal equity.' },
    moderate:     { label:'Moderate',     chipColor:'warning', stocks:0.40, bonds:0.30, gold:0.15, cash:0.15,
      description:'Balanced growth — equity & debt blend for medium-term goals.' },
    aggressive:   { label:'Aggressive',   chipColor:'error',   stocks:0.75, bonds:0.10, gold:0.10, cash:0.05,
      description:'Maximum growth — heavy equity for long-horizon investors.' },
  };
  Object.keys(raw).forEach(k => Object.assign(raw[k], calcMetrics(raw[k])));
  return raw;
};
const NAMED_PROFILES = buildProfiles();

// ─── Per-profile savings deployment splits ────────────────────────────────────
const SAVINGS_SPLITS = {
  conservative: [
    { asset:'Emergency Fund',   pct:40, desc:'Liquid FDs / savings account',  color:COLORS[0] },
    { asset:'Debt Instruments', pct:35, desc:'Bonds, PPF, NSC',               color:COLORS[1] },
    { asset:'Gold',             pct:15, desc:'Sovereign Gold Bonds',           color:COLORS[2] },
    { asset:'Equity',           pct:10, desc:'Index funds only',               color:COLORS[3] },
  ],
  moderate: [
    { asset:'Emergency Fund',   pct:25, desc:'Liquid FDs / savings account',  color:COLORS[0] },
    { asset:'Equity',           pct:35, desc:'Diversified mutual funds / ETF', color:COLORS[1] },
    { asset:'Debt Instruments', pct:25, desc:'Bonds, balanced advantage funds',color:COLORS[2] },
    { asset:'Gold',             pct:15, desc:'Gold ETFs / SGB',                color:COLORS[3] },
  ],
  aggressive: [
    { asset:'Emergency Fund',   pct:10, desc:'Minimal liquid buffer',          color:COLORS[0] },
    { asset:'Equity / Stocks',  pct:55, desc:'Mid/small-cap + sectoral funds', color:COLORS[1] },
    { asset:'Mutual Funds',     pct:25, desc:'Flexi-cap SIPs',                 color:COLORS[2] },
    { asset:'Gold / Alts',      pct:10, desc:'Gold ETFs + REITs',              color:COLORS[3] },
  ],
  optimal: [
    { asset:'Emergency Fund',   pct:20, desc:'Liquid FDs',                     color:COLORS[0] },
    { asset:'Equity / Stocks',  pct:40, desc:'Index + active equity funds',    color:COLORS[1] },
    { asset:'Debt Instruments', pct:25, desc:'Balanced advantage funds',       color:COLORS[2] },
    { asset:'Gold',             pct:15, desc:'Gold ETFs',                      color:COLORS[3] },
  ],
};

// ─── Component ────────────────────────────────────────────────────────────────
const PortfolioOptimization = () => {
  const [optimization, setOptimization] = useState(null);
  const [loading, setLoading]           = useState(true);
  const [dialogOpen, setDialogOpen]     = useState(false);
  const [dialogData, setDialogData]     = useState(null);

  const hasUserData = (() => {
    try { return JSON.parse(localStorage.getItem('userTransactions') || '[]').length > 0; }
    catch { return false; }
  })();

  useEffect(() => {
    if (hasUserData) setOptimization(runMonteCarlo());
    setLoading(false);
  }, [hasUserData]); // eslint-disable-line

  const runMonteCarlo = () => {
    const portfolios = Array.from({ length: 1000 }, (_, id) => {
      const stocks = Math.random()*0.8 + 0.1;
      const bonds  = Math.random()*(1-stocks)*0.8;
      const gold   = Math.random()*(1-stocks-bonds)*0.6;
      const cash   = 1-stocks-bonds-gold;
      return { id, stocks, bonds, gold, cash, ...calcMetrics({stocks,bonds,gold,cash}), isEfficient:false };
    });
    portfolios.sort((a,b) => a.volatility - b.volatility);
    let max = -Infinity;
    portfolios.forEach(p => { if (p.sharpeRatio > max){ p.isEfficient=true; max=p.sharpeRatio; } });
    const optimal = portfolios.reduce((best,p) => p.sharpeRatio > best.sharpeRatio ? p : best);
    return {
      portfolios, optimalPortfolio: optimal,
      stats: {
        total: 1000,
        efficient: portfolios.filter(p=>p.isEfficient).length,
        maxReturn: Math.max(...portfolios.map(p=>p.expectedReturn)),
        minVol: Math.min(...portfolios.map(p=>p.volatility)),
      }
    };
  };

  const userSavings = (() => {
    try {
      const txns = JSON.parse(localStorage.getItem('userTransactions')||'[]');
      return Math.max(0, txns.reduce((s,t)=>s+(Number(t.credit)||0),0) - txns.reduce((s,t)=>s+(Number(t.debit)||0),0));
    } catch { return 100000; }
  })();

  const openDialog = (profileKey, portfolio) => {
    const profile  = profileKey ? NAMED_PROFILES[profileKey] : null;
    const metrics  = profile || calcMetrics(portfolio);
    const assetMix = [
      { label:'Stocks', value: (profile||portfolio).stocks },
      { label:'Bonds',  value: (profile||portfolio).bonds  },
      { label:'Gold',   value: (profile||portfolio).gold   },
      { label:'Cash',   value: (profile||portfolio).cash   },
    ];
    const split = (SAVINGS_SPLITS[profileKey] || SAVINGS_SPLITS.optimal).map(row => ({
      ...row, amount: Math.round(userSavings * row.pct / 100)
    }));
    setDialogData({
      title:       profile ? `${profile.label} Portfolio` : 'Optimal (Monte Carlo) Portfolio',
      description: profile ? profile.description : 'Maximum Sharpe ratio found across 1,000 Monte Carlo simulations.',
      metrics, assetMix, split,
    });
    setDialogOpen(true);
  };

  if (loading) return <Container maxWidth="lg" sx={{ display:'flex', justifyContent:'center', mt:4 }}><CircularProgress /></Container>;
  if (!hasUserData) return <Container maxWidth="lg" sx={{ py:4 }}><Alert severity="info">Please enter transactions in the <strong>Transactions</strong> tab first.</Alert></Container>;

  const scatterAll      = optimization.portfolios.filter(p=>!p.isEfficient).map(p=>({ x:+(p.volatility*100).toFixed(2), y:+(p.expectedReturn*100).toFixed(2) }));
  const scatterFrontier = optimization.portfolios.filter(p=> p.isEfficient).map(p=>({ x:+(p.volatility*100).toFixed(2), y:+(p.expectedReturn*100).toFixed(2) }));
  const opt = optimization.optimalPortfolio;

  return (
    <Container maxWidth="lg" sx={{ py:4 }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom textAlign="center">Portfolio Optimization</Typography>
      <Typography variant="body1" textAlign="center" color="text.secondary" sx={{ mb:4 }}>
        Monte Carlo simulation · 1,000 portfolios · Optimal asset allocation
      </Typography>

      <Grid container spacing={3}>

        {/* Stats */}
        <Grid item xs={12}>
          <Card><CardContent>
            <Typography variant="h6" gutterBottom>Monte Carlo Simulation Results</Typography>
            <Grid container spacing={2}>
              {[
                { label:'Portfolios Simulated',      val:'1,000',                                     bg:'primary.light',  fg:'primary.contrastText' },
                { label:'Efficient Frontier Points', val:optimization.stats.efficient,                 bg:'success.light',  fg:'success.contrastText' },
                { label:'Max Expected Return',       val:`${(optimization.stats.maxReturn*100).toFixed(1)}%`, bg:'warning.light', fg:'warning.contrastText' },
                { label:'Min Portfolio Risk',        val:`${(optimization.stats.minVol*100).toFixed(1)}%`,   bg:'info.light',    fg:'info.contrastText'    },
              ].map(s=>(
                <Grid item xs={6} md={3} key={s.label}>
                  <Box sx={{ textAlign:'center', p:2, bgcolor:s.bg, borderRadius:2 }}>
                    <Typography variant="h4" color={s.fg} fontWeight="bold">{s.val}</Typography>
                    <Typography variant="body2" color={s.fg}>{s.label}</Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </CardContent></Card>
        </Grid>

        {/* Scatter */}
        <Grid item xs={12} md={8}>
          <Card><CardContent>
            <Typography variant="h6" gutterBottom>Efficient Frontier</Typography>
            <ResponsiveContainer width="100%" height={380}>
              <ScatterChart margin={{ top:10, right:20, bottom:20, left:0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="x" name="Volatility"     unit="%" label={{ value:'Risk (%)',    position:'insideBottom', offset:-8 }} domain={['auto','auto']} tick={{ fontSize:11 }} />
                <YAxis type="number" dataKey="y" name="Expected Return" unit="%" label={{ value:'Return (%)', angle:-90, position:'insideLeft'       }} domain={['auto','auto']} tick={{ fontSize:11 }} />
                <Tooltip formatter={(v,n)=>[`${Number(v).toFixed(2)}%`, n==='x'?'Risk':'Return']} />
                <Legend verticalAlign="top" />
                <Scatter name="All Portfolios"     data={scatterAll}      fill="#8884d8" fillOpacity={0.25} />
                <Scatter name="Efficient Frontier" data={scatterFrontier} fill="#ff7300" fillOpacity={0.85} />
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent></Card>
        </Grid>

        {/* Optimal card */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height:'100%' }}><CardContent>
            <Typography variant="h6" gutterBottom>Optimal Portfolio (Max Sharpe)</Typography>
            {[
              { label:'Expected Annual Return', val:`${(opt.expectedReturn*100).toFixed(1)}%`, color:'success.main' },
              { label:'Portfolio Volatility',   val:`${(opt.volatility*100).toFixed(1)}%`,    color:'warning.main' },
              { label:'Sharpe Ratio',           val:opt.sharpeRatio.toFixed(2),               color:'info.main'    },
            ].map(m=>(
              <Box key={m.label} sx={{ mb:2 }}>
                <Typography variant="body2" color="text.secondary">{m.label}</Typography>
                <Typography variant="h5" fontWeight="bold" color={m.color}>{m.val}</Typography>
              </Box>
            ))}
            <Divider sx={{ my:1 }} />
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb:1 }}>
              S:{(opt.stocks*100).toFixed(0)}% · B:{(opt.bonds*100).toFixed(0)}% · G:{(opt.gold*100).toFixed(0)}% · C:{(opt.cash*100).toFixed(0)}%
            </Typography>
            <Button variant="contained" fullWidth onClick={()=>openDialog(null, opt)}>
              View Allocation
            </Button>
          </CardContent></Card>
        </Grid>

        {/* Comparison table — each row uses its own computed metrics */}
        <Grid item xs={12} md={7}>
          <Card><CardContent>
            <Typography variant="h6" gutterBottom>Portfolio Comparison</Typography>
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor:'grey.100' }}>
                    <TableCell><b>Profile</b></TableCell>
                    <TableCell><b>Allocation</b></TableCell>
                    <TableCell align="right"><b>Return</b></TableCell>
                    <TableCell align="right"><b>Risk</b></TableCell>
                    <TableCell align="right"><b>Sharpe</b></TableCell>
                    <TableCell align="center"><b>Details</b></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(NAMED_PROFILES).map(([key, p]) => (
                    <TableRow key={key} hover>
                      <TableCell><Chip label={p.label} color={p.chipColor} size="small" /></TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace:'nowrap' }}>
                          S:{(p.stocks*100).toFixed(0)}% B:{(p.bonds*100).toFixed(0)}% G:{(p.gold*100).toFixed(0)}% C:{(p.cash*100).toFixed(0)}%
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ color:'success.main', fontWeight:'bold' }}>
                        {(p.expectedReturn*100).toFixed(1)}%
                      </TableCell>
                      <TableCell align="right" sx={{ color:'warning.main', fontWeight:'bold' }}>
                        {(p.volatility*100).toFixed(1)}%
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight:'bold' }}>
                        {p.sharpeRatio.toFixed(2)}
                      </TableCell>
                      <TableCell align="center">
                        <Button size="small" variant="outlined" onClick={()=>openDialog(key, p)}>View</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow sx={{ bgcolor:'primary.50' }} hover>
                    <TableCell><Chip label="Optimal" color="primary" size="small" /></TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace:'nowrap' }}>
                        S:{(opt.stocks*100).toFixed(0)}% B:{(opt.bonds*100).toFixed(0)}% G:{(opt.gold*100).toFixed(0)}% C:{(opt.cash*100).toFixed(0)}%
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ color:'success.main', fontWeight:'bold' }}>{(opt.expectedReturn*100).toFixed(1)}%</TableCell>
                    <TableCell align="right" sx={{ color:'warning.main', fontWeight:'bold' }}>{(opt.volatility*100).toFixed(1)}%</TableCell>
                    <TableCell align="right" sx={{ fontWeight:'bold' }}>{opt.sharpeRatio.toFixed(2)}</TableCell>
                    <TableCell align="center">
                      <Button size="small" variant="contained" onClick={()=>openDialog(null, opt)}>View</Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent></Card>
        </Grid>

        {/* Insights */}
        <Grid item xs={12} md={5}>
          <Card sx={{ height:'100%' }}><CardContent>
            <Typography variant="h6" gutterBottom>Optimization Insights</Typography>
            {[
              { s:'info',    t:'Efficient Frontier',     b:'The optimal portfolio maximises Sharpe ratio — best return per unit of risk across 1,000 simulations.' },
              { s:'success', t:'Diversification Benefit', b:'Stocks + gold correlation is negative (−0.10), meaning gold hedges equity drawdowns effectively.' },
              { s:'warning', t:'Rebalance Quarterly',     b:'Market drift shifts actual allocations. Rebalancing back to targets maintains your intended risk profile.' },
              { s:'info',    t:'Sharpe Over Raw Return',  b:'Conservative: lower return but also lower risk. Compare Sharpe ratios, not returns, across profiles.' },
            ].map(ins=>(
              <Alert key={ins.t} severity={ins.s} sx={{ mb:1 }}>
                <Typography variant="subtitle2">{ins.t}</Typography>
                <Typography variant="body2">{ins.b}</Typography>
              </Alert>
            ))}
          </CardContent></Card>
        </Grid>

      </Grid>

      {/* ── Dialog ───────────────────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onClose={()=>setDialogOpen(false)}
        maxWidth="sm" fullWidth PaperProps={{ sx:{ borderRadius:3 } }}>
        {dialogData && (
          <>
            <DialogTitle sx={{ pb:0 }}>
              <Typography variant="h6" fontWeight="bold">{dialogData.title}</Typography>
              <Typography variant="body2" color="text.secondary">{dialogData.description}</Typography>
            </DialogTitle>
            <Divider sx={{ mt:1 }} />
            <DialogContent sx={{ pt:2 }}>

              {/* Metrics row */}
              <Grid container spacing={1} sx={{ mb:2 }}>
                {[
                  { label:'Return', val:`${(dialogData.metrics.expectedReturn*100).toFixed(1)}%`, color:'success.main' },
                  { label:'Risk',   val:`${(dialogData.metrics.volatility*100).toFixed(1)}%`,    color:'warning.main' },
                  { label:'Sharpe', val:dialogData.metrics.sharpeRatio.toFixed(2),               color:'info.main'    },
                ].map(m=>(
                  <Grid item xs={4} key={m.label}>
                    <Box sx={{ textAlign:'center', p:1, bgcolor:'#1a1a1a', borderRadius:1, border: '1px solid #333' }}>
                      <Typography variant="caption" color="text.secondary">{m.label}</Typography>
                      <Typography variant="h6" fontWeight="bold" color={m.color}>{m.val}</Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>

              {/* Asset mix horizontal bar */}
              <Typography variant="subtitle2" gutterBottom>Asset Mix</Typography>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart layout="vertical"
                  data={dialogData.assetMix.map(a=>({ name:a.label, value:parseFloat((a.value*100).toFixed(1)) }))}
                  margin={{ left:10, right:30, top:0, bottom:0 }}>
                  <XAxis type="number" unit="%" tick={{ fontSize:11 }} domain={[0,100]} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize:12 }} width={50} />
                  <Tooltip formatter={v=>[`${v}%`,'Allocation']} />
                  <Bar dataKey="value" radius={[0,4,4,0]}>
                    {dialogData.assetMix.map((_,i)=><Cell key={i} fill={COLORS[i]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              <Divider sx={{ my:2 }} />

              {/* Savings deployment */}
              <Typography variant="subtitle2" gutterBottom>
                Deploy Your Savings — ₹{userSavings.toLocaleString()}
              </Typography>
              {dialogData.split.map((item,i)=>(
                <Box key={i} sx={{ mb:1.5 }}>
                  <Box sx={{ display:'flex', justifyContent:'space-between', mb:0.3 }}>
                    <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
                      <Box sx={{ width:10, height:10, borderRadius:'50%', bgcolor:item.color }} />
                      <Typography variant="body2" fontWeight="medium">{item.asset}</Typography>
                    </Box>
                    <Box sx={{ textAlign:'right' }}>
                      <Typography variant="body2" fontWeight="bold" color="primary">₹{item.amount.toLocaleString()}</Typography>
                      <Typography variant="caption" color="text.secondary">{item.pct}%</Typography>
                    </Box>
                  </Box>
                  <LinearProgress variant="determinate" value={item.pct}
                    sx={{ height:5, borderRadius:3, bgcolor:'grey.200',
                      '& .MuiLinearProgress-bar':{ bgcolor:item.color, borderRadius:3 } }} />
                  <Typography variant="caption" color="text.secondary">{item.desc}</Typography>
                </Box>
              ))}
            </DialogContent>
            <DialogActions sx={{ px:3, pb:2 }}>
              <Button onClick={()=>setDialogOpen(false)} variant="contained" fullWidth>Got it</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Container>
  );
};

export default PortfolioOptimization;