import React, { useState, useEffect } from 'react';
import {
  Container, Typography, Card, CardContent, Grid, Alert,
  CircularProgress, Box, Chip, LinearProgress, Divider
} from '@mui/material';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell
} from 'recharts';
import axios from 'axios';

// ── Metric definitions with groups, thresholds, and display config ─────────────
const METRIC_DEFS = {
  // ML Model Quality
  precision: {
    label: 'Precision', group: 'ML Model Quality',
    desc: 'Fraction of flagged anomalies that are genuine — minimises false alerts.',
    unit: '', scale: 100, format: v => `${(v*100).toFixed(1)}%`,
    good: 0.80, ok: 0.70, higherIsBetter: true,
  },
  recall: {
    label: 'Recall', group: 'ML Model Quality',
    desc: 'Fraction of real anomalies correctly detected — minimises missed events.',
    unit: '', scale: 100, format: v => `${(v*100).toFixed(1)}%`,
    good: 0.80, ok: 0.70, higherIsBetter: true,
  },
  f1_score: {
    label: 'F1-Score', group: 'ML Model Quality',
    desc: 'Harmonic mean of Precision & Recall — overall classifier balance.',
    unit: '', scale: 100, format: v => `${(v*100).toFixed(1)}%`,
    good: 0.80, ok: 0.70, higherIsBetter: true,
  },
  // Forecasting Accuracy
  rmse: {
    label: 'RMSE', group: 'Forecasting Accuracy',
    desc: 'Root Mean Square Error for stock / expense predictions (lower = better).',
    unit: '₹', scale: null, format: v => `₹${v.toFixed(1)}`,
    good: 50, ok: 75, higherIsBetter: false,
  },
  mae: {
    label: 'MAE', group: 'Forecasting Accuracy',
    desc: 'Mean Absolute Error — average prediction miss (lower = better).',
    unit: '₹', scale: null, format: v => `₹${v.toFixed(1)}`,
    good: 35, ok: 50, higherIsBetter: false,
  },
  // Portfolio Performance
  sharpe_ratio: {
    label: 'Sharpe Ratio', group: 'Portfolio Performance',
    desc: 'Risk-adjusted return. >1.0 is strong; >2.0 is excellent.',
    unit: '', scale: null, format: v => v.toFixed(2),
    good: 1.0, ok: 0.5, higherIsBetter: true,
  },
  cagr: {
    label: 'CAGR', group: 'Portfolio Performance',
    desc: 'Compound Annual Growth Rate of the optimised portfolio.',
    unit: '%', scale: null, format: v => `${v.toFixed(1)}%`,
    good: 10, ok: 5, higherIsBetter: true,
  },
  volatility: {
    label: 'Volatility', group: 'Portfolio Performance',
    desc: 'Annualised portfolio risk — lower values mean more stable returns.',
    unit: '%', scale: null, format: v => `${v.toFixed(1)}%`,
    good: 15, ok: 20, higherIsBetter: false,
  },
  // System
  average_reward: {
    label: 'Avg RL Reward', group: 'System & RL Agent',
    desc: 'Average reward per episode from the reinforcement learning agent.',
    unit: '₹', scale: null, format: v => `₹${v.toFixed(0)}`,
    good: 1000, ok: 500, higherIsBetter: true,
  },
  dashboard_latency: {
    label: 'Dashboard Latency', group: 'System & RL Agent',
    desc: 'End-to-end API response time in seconds (lower = faster).',
    unit: 's', scale: null, format: v => `${v.toFixed(2)}s`,
    good: 2, ok: 3, higherIsBetter: false,
  },
};

const getStatus = (def, value) => {
  if (def.higherIsBetter) {
    if (value >= def.good) return 'good';
    if (value >= def.ok)   return 'ok';
    return 'poor';
  } else {
    if (value <= def.good) return 'good';
    if (value <= def.ok)   return 'ok';
    return 'poor';
  }
};

const STATUS_COLOR = { good:'#10b981', ok:'#f59e0b', poor:'#ef4444' };
const STATUS_CHIP  = { good:'success',  ok:'warning',  poor:'error'   };
const STATUS_LABEL = { good:'Good',     ok:'Fair',     poor:'Needs Work' };

// ─── Component ────────────────────────────────────────────────────────────────
const PerformanceMetrics = () => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => { fetchMetrics(); }, []);

  const fetchMetrics = async () => {
    try {
      const res = await axios.get('/api/performance_metrics');
      setMetrics(res.data);
    } catch (err) {
      setError('Could not fetch performance metrics. Make sure the backend is running.');
    }
    setLoading(false);
  };

  if (loading) return (
    <Container maxWidth="lg" sx={{ display:'flex', justifyContent:'center', mt:4 }}>
      <CircularProgress />
    </Container>
  );

  if (error) return (
    <Container maxWidth="lg" sx={{ py:4 }}>
      <Alert severity="error">{error}</Alert>
    </Container>
  );

  // Group metrics
  const groups = {};
  Object.entries(METRIC_DEFS).forEach(([key, def]) => {
    if (!(def.group in groups)) groups[def.group] = [];
    const value  = metrics[key] ?? 0;
    const status = getStatus(def, value);
    groups[def.group].push({ key, def, value, status });
  });

  // Radar chart data — normalise each metric to 0-100 for display
  const radarData = [
    { subject:'Precision',    value: metrics.precision   * 100 },
    { subject:'Recall',       value: metrics.recall      * 100 },
    { subject:'F1',           value: metrics.f1_score    * 100 },
    { subject:'Sharpe×50',    value: Math.min(100, metrics.sharpe_ratio * 50) },
    { subject:'CAGR',         value: Math.min(100, metrics.cagr * 5) },
    { subject:'RL Reward/20', value: Math.min(100, metrics.average_reward / 20) },
  ];

  // Bar chart — forecast error (lower is better)
  const forecastBar = [
    { name:'RMSE', value: metrics.rmse, fill:'#6366f1' },
    { name:'MAE',  value: metrics.mae,  fill:'#10b981' },
  ];

  // Overall score
  const goodCount = Object.entries(METRIC_DEFS).filter(([k,def]) => getStatus(def, metrics[k]??0) === 'good').length;
  const total     = Object.keys(METRIC_DEFS).length;
  const score     = Math.round((goodCount / total) * 100);
  const scoreColor = score >= 70 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <Container maxWidth="lg" sx={{ py:4 }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom textAlign="center">
        System Performance Metrics
      </Typography>
      <Typography variant="body2" textAlign="center" color="text.secondary" sx={{ mb:4 }}>
        Evaluation of ML models, forecasting accuracy, portfolio performance and system health
      </Typography>

      {/* Overall score */}
      <Card sx={{ mb:4, borderTop:`4px solid ${scoreColor}` }}>
        <CardContent>
          <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:2 }}>
            <Box>
              <Typography variant="h6" fontWeight="bold">Overall System Score</Typography>
              <Typography variant="body2" color="text.secondary">
                {goodCount} of {total} metrics are in the "Good" range
              </Typography>
            </Box>
            <Box sx={{ textAlign:'center' }}>
              <Typography variant="h3" fontWeight="bold" sx={{ color:scoreColor }}>{score}%</Typography>
              <LinearProgress variant="determinate" value={score}
                sx={{ width:200, height:8, borderRadius:4,
                  '& .MuiLinearProgress-bar':{ bgcolor:scoreColor } }} />
            </Box>
            <Box sx={{ display:'flex', gap:1, flexWrap:'wrap' }}>
              {['good','ok','poor'].map(s => (
                <Chip key={s} label={`${Object.entries(METRIC_DEFS).filter(([k,d])=>getStatus(d,metrics[k]??0)===s).length} ${STATUS_LABEL[s]}`}
                  size="small" sx={{ bgcolor:STATUS_COLOR[s]+'22', color:STATUS_COLOR[s], fontWeight:'bold' }} />
              ))}
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Grid container spacing={3}>

        {/* Radar chart */}
        <Grid item xs={12} md={5}>
          <Card sx={{ height:'100%' }}><CardContent>
            <Typography variant="h6" fontWeight="bold" gutterBottom>Model Quality Radar</Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb:1 }}>
              All values normalised to 0–100 for comparison
            </Typography>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize:11 }} />
                <Radar dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
                <Tooltip formatter={v=>[`${v.toFixed(1)}`, 'Score']} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent></Card>
        </Grid>

        {/* Forecast error bars */}
        <Grid item xs={12} md={7}>
          <Card sx={{ height:'100%' }}><CardContent>
            <Typography variant="h6" fontWeight="bold" gutterBottom>Forecasting Error</Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb:1 }}>
              RMSE and MAE — lower is better. Good threshold: RMSE &lt; ₹50, MAE &lt; ₹35.
            </Typography>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={forecastBar} margin={{ top:5, right:20, left:0, bottom:5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize:13 }} />
                <YAxis tick={{ fontSize:11 }} tickFormatter={v=>`₹${v}`} />
                <Tooltip formatter={v=>[`₹${v.toFixed(1)}`, 'Error']} />
                <Bar dataKey="value" radius={[6,6,0,0]}>
                  {forecastBar.map((e,i)=><Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Quick metric pills */}
            <Divider sx={{ my:1.5 }} />
            <Grid container spacing={1}>
              {[
                { label:'Sharpe Ratio', val:metrics.sharpe_ratio?.toFixed(2), color:'#6366f1' },
                { label:'CAGR',         val:`${metrics.cagr?.toFixed(1)}%`,    color:'#10b981' },
                { label:'Volatility',   val:`${metrics.volatility?.toFixed(1)}%`, color:'#f59e0b' },
                { label:'Latency',      val:`${metrics.dashboard_latency?.toFixed(2)}s`, color:'#3b82f6' },
              ].map(m => (
                <Grid item xs={6} sm={3} key={m.label}>
                  <Box sx={{ textAlign:'center', p:1, bgcolor:'grey.800', borderRadius:2, border: '1px solid #333' }}>
                    <Typography variant="caption" color="text.secondary">{m.label}</Typography>
                    <Typography variant="h6" fontWeight="bold" sx={{ color:m.color }}>{m.val}</Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </CardContent></Card>
        </Grid>

        {/* Grouped metric cards */}
        {Object.entries(groups).map(([groupName, items]) => (
          <Grid item xs={12} key={groupName}>
            <Typography variant="h6" fontWeight="bold" sx={{ mb:1.5, pl:0.5 }}>{groupName}</Typography>
            <Grid container spacing={2}>
              {items.map(({ key, def, value, status }) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={key}>
                  <Card sx={{ borderLeft:`4px solid ${STATUS_COLOR[status]}`, height:'100%' }}>
                    <CardContent sx={{ pb:'12px !important' }}>
                      <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'center', mb:0.5 }}>
                        <Typography variant="subtitle2" fontWeight="bold">{def.label}</Typography>
                        <Chip label={STATUS_LABEL[status]} size="small" color={STATUS_CHIP[status]} />
                      </Box>
                      <Typography variant="h5" fontWeight="bold" sx={{ color:STATUS_COLOR[status], mb:0.5 }}>
                        {def.format(value)}
                      </Typography>
                      {def.scale && (
                        <LinearProgress variant="determinate"
                          value={Math.min(100, value * def.scale)}
                          sx={{ height:5, borderRadius:3, mb:0.8,
                            '& .MuiLinearProgress-bar':{ bgcolor:STATUS_COLOR[status] } }} />
                      )}
                      <Typography variant="caption" color="text.secondary">{def.desc}</Typography>
                      <Typography variant="caption" display="block" color="text.disabled" sx={{ mt:0.3 }}>
                        Good threshold: {def.higherIsBetter ? '≥' : '≤'} {def.format(def.good)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
            <Divider sx={{ mt:2, mb:1 }} />
          </Grid>
        ))}

      </Grid>
    </Container>
  );
};

export default PerformanceMetrics;