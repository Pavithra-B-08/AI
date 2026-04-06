import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Card,
  CardContent,
  Grid,
  Alert,
  CircularProgress,
  Box,
  Chip,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  LinearProgress
} from '@mui/material';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

const RiskAssessment = () => {
  const [riskProfile, setRiskProfile] = useState('moderate');
  const [investmentAmount, setInvestmentAmount] = useState(50000);
  const [timeHorizon, setTimeHorizon] = useState(5);
  const [assessment, setAssessment] = useState(null);

  // Check if user has entered transactions
  const hasUserData = (() => {
    try {
      const transactions = localStorage.getItem('userTransactions');
      return transactions && JSON.parse(transactions).length > 0;
    } catch {
      return false;
    }
  })();

  useEffect(() => {
    if (hasUserData) {
      calculateRiskAssessment();
    } else {
      // Show a message instead of mock data
      setAssessment(null);
    }
  }, [riskProfile, investmentAmount, timeHorizon, hasUserData]);

  const calculateRiskAssessment = () => {
    // Mock risk assessment calculation
    const profiles = {
      conservative: {
        expectedReturn: 0.06,
        volatility: 0.08,
        maxDrawdown: 0.12,
        sharpeRatio: 0.75,
        allocation: {
          bonds: 0.6,
          stocks: 0.2,
          gold: 0.15,
          cash: 0.05
        }
      },
      moderate: {
        expectedReturn: 0.08,
        volatility: 0.12,
        maxDrawdown: 0.18,
        sharpeRatio: 1.2,
        allocation: {
          bonds: 0.4,
          stocks: 0.4,
          gold: 0.15,
          cash: 0.05
        }
      },
      aggressive: {
        expectedReturn: 0.12,
        volatility: 0.18,
        maxDrawdown: 0.25,
        sharpeRatio: 1.5,
        allocation: {
          bonds: 0.2,
          stocks: 0.6,
          gold: 0.15,
          cash: 0.05
        }
      }
    };

    const profile = profiles[riskProfile];
    const projectedValue = investmentAmount * Math.pow(1 + profile.expectedReturn, timeHorizon);
    const riskAdjustedReturn = projectedValue * profile.sharpeRatio;

    setAssessment({
      ...profile,
      projectedValue: Math.round(projectedValue),
      riskAdjustedReturn: Math.round(riskAdjustedReturn),
      allocation: profile.allocation
    });
  };

  const riskRadarData = assessment ? [
    { subject: 'Return Potential', A: assessment.expectedReturn * 100, fullMark: 20 },
    { subject: 'Risk Level', A: assessment.volatility * 100, fullMark: 20 },
    { subject: 'Stability', A: (1 - assessment.maxDrawdown) * 100, fullMark: 100 },
    { subject: 'Risk-Adjusted Return', A: assessment.sharpeRatio * 20, fullMark: 30 },
    { subject: 'Time Horizon Fit', A: Math.min(timeHorizon * 5, 100), fullMark: 100 }
  ] : [];

  const allocationData = assessment ? Object.entries(assessment.allocation).map(([key, value]) => ({
    category: key.charAt(0).toUpperCase() + key.slice(1),
    percentage: value * 100
  })) : [];

  const getRiskColor = (profile) => {
    switch (profile) {
      case 'conservative': return 'success';
      case 'moderate': return 'warning';
      case 'aggressive': return 'error';
      default: return 'default';
    }
  };

  const getRiskDescription = (profile) => {
    switch (profile) {
      case 'conservative':
        return 'Low risk, stable returns. Suitable for capital preservation and steady growth.';
      case 'moderate':
        return 'Balanced approach with moderate risk. Good for long-term wealth building.';
      case 'aggressive':
        return 'High risk, high potential returns. Suitable for those with high risk tolerance.';
      default:
        return '';
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom textAlign="center">
        Risk Assessment & Portfolio Analysis
      </Typography>
      <Typography variant="body1" textAlign="center" sx={{ mb: 4, color: 'text.secondary' }}>
        Monte Carlo simulation and risk analysis for optimal portfolio allocation
      </Typography>

      {/* Risk Profile Controls */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Risk Profile
              </Typography>
              <FormControl fullWidth>
                <InputLabel>Risk Tolerance</InputLabel>
                <Select
                  value={riskProfile}
                  label="Risk Tolerance"
                  onChange={(e) => setRiskProfile(e.target.value)}
                >
                  <MenuItem value="conservative">Conservative</MenuItem>
                  <MenuItem value="moderate">Moderate</MenuItem>
                  <MenuItem value="aggressive">Aggressive</MenuItem>
                </Select>
              </FormControl>
              <Box sx={{ mt: 2 }}>
                <Chip
                  label={riskProfile.charAt(0).toUpperCase() + riskProfile.slice(1)}
                  color={getRiskColor(riskProfile)}
                  variant="outlined"
                />
              </Box>
              <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                {getRiskDescription(riskProfile)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Investment Amount
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main', mb: 2 }}>
                ₹{investmentAmount.toLocaleString()}
              </Typography>
              <Slider
                value={investmentAmount}
                onChange={(e, newValue) => setInvestmentAmount(newValue)}
                min={10000}
                max={1000000}
                step={10000}
                marks={[
                  { value: 10000, label: '10K' },
                  { value: 500000, label: '5L' },
                  { value: 1000000, label: '10L' }
                ]}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `₹${(value / 1000).toFixed(0)}K`}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Time Horizon
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main', mb: 2 }}>
                {timeHorizon} Years
              </Typography>
              <Slider
                value={timeHorizon}
                onChange={(e, newValue) => setTimeHorizon(newValue)}
                min={1}
                max={30}
                step={1}
                marks={[
                  { value: 1, label: '1Y' },
                  { value: 10, label: '10Y' },
                  { value: 20, label: '20Y' },
                  { value: 30, label: '30Y' }
                ]}
                valueLabelDisplay="auto"
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {assessment && (
        <Grid container spacing={3}>
          {/* Risk Metrics */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Risk Assessment Metrics
                </Typography>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" color="text.secondary">Expected Annual Return</Typography>
                  <Typography variant="h6" color="success.main">
                    {(assessment.expectedReturn * 100).toFixed(1)}%
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={assessment.expectedReturn * 500}
                    sx={{ mt: 1, height: 8, borderRadius: 4 }}
                  />
                </Box>

                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" color="text.secondary">Portfolio Volatility</Typography>
                  <Typography variant="h6" color="warning.main">
                    {(assessment.volatility * 100).toFixed(1)}%
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={assessment.volatility * 500}
                    color="warning"
                    sx={{ mt: 1, height: 8, borderRadius: 4 }}
                  />
                </Box>

                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" color="text.secondary">Maximum Drawdown</Typography>
                  <Typography variant="h6" color="error.main">
                    {(assessment.maxDrawdown * 100).toFixed(1)}%
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={assessment.maxDrawdown * 400}
                    color="error"
                    sx={{ mt: 1, height: 8, borderRadius: 4 }}
                  />
                </Box>

                <Box>
                  <Typography variant="body2" color="text.secondary">Sharpe Ratio</Typography>
                  <Typography variant="h6" color="info.main">
                    {assessment.sharpeRatio.toFixed(2)}
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={assessment.sharpeRatio * 33}
                    color="info"
                    sx={{ mt: 1, height: 8, borderRadius: 4 }}
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Risk Radar Chart */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Risk Profile Analysis
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={riskRadarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} />
                    <Radar
                      name="Risk Score"
                      dataKey="A"
                      stroke="#8884d8"
                      fill="#8884d8"
                      fillOpacity={0.6}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Portfolio Allocation */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Recommended Asset Allocation
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={allocationData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" />
                    <YAxis />
                    <Tooltip formatter={(value) => `${value.toFixed(1)}%`} />
                    <Bar dataKey="percentage" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Projection Results */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Investment Projection
                </Typography>
                <Box sx={{ textAlign: 'center', mb: 3 }}>
                  <Typography variant="h3" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                    ₹{assessment.projectedValue.toLocaleString()}
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    Projected value in {timeHorizon} years
                  </Typography>
                </Box>

                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Box sx={{ p: 2, bgcolor: 'success.light', borderRadius: 2, textAlign: 'center' }}>
                      <Typography variant="h6" color="success.contrastText">
                        ₹{(assessment.projectedValue - investmentAmount).toLocaleString()}
                      </Typography>
                      <Typography variant="body2" color="success.contrastText">
                        Total Returns
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box sx={{ p: 2, bgcolor: 'info.light', borderRadius: 2, textAlign: 'center' }}>
                      <Typography variant="h6" color="info.contrastText">
                        ₹{assessment.riskAdjustedReturn.toLocaleString()}
                      </Typography>
                      <Typography variant="body2" color="info.contrastText">
                        Risk-Adjusted Value
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Risk Warnings and Recommendations */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Risk Management Recommendations
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Alert severity="info" sx={{ mb: 2 }}>
                      <Typography variant="subtitle2">Diversification Strategy</Typography>
                      <Typography variant="body2">
                        Spread investments across {Object.keys(assessment.allocation).length} asset classes
                        to reduce portfolio volatility and improve risk-adjusted returns.
                      </Typography>
                    </Alert>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Alert severity="warning" sx={{ mb: 2 }}>
                      <Typography variant="subtitle2">Rebalancing Frequency</Typography>
                      <Typography variant="body2">
                        Review and rebalance your portfolio quarterly to maintain target allocations
                        and adapt to changing market conditions.
                      </Typography>
                    </Alert>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Alert severity={riskProfile === 'aggressive' ? 'error' : 'success'} sx={{ mb: 2 }}>
                      <Typography variant="subtitle2">Emergency Fund</Typography>
                      <Typography variant="body2">
                        Maintain 6-12 months of expenses in liquid, low-risk investments
                        regardless of your risk profile.
                      </Typography>
                    </Alert>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Alert severity="info" sx={{ mb: 2 }}>
                      <Typography variant="subtitle2">Regular Monitoring</Typography>
                      <Typography variant="body2">
                        Monitor portfolio performance monthly and adjust strategy based on
                        life changes, market conditions, and financial goals.
                      </Typography>
                    </Alert>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Container>
  );
};

export default RiskAssessment;