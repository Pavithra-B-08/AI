import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Card,
  CardContent,
  Grid,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemText
} from '@mui/material';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import axios from 'axios';

const PersonalFinance = () => {
  const [financeData, setFinanceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchFinanceData();
  }, []);

  const fetchFinanceData = async () => {
    try {
      const response = await axios.get('/api/personal_finance/1');
      setFinanceData(response.data);
    } catch (err) {
      setError('Error fetching financial data. Please try again.');
      console.error('Error:', err);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg">
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  const pieData = financeData ? Object.entries(financeData.category_expenses).map(([category, amount]) => ({
    name: category,
    value: amount
  })) : [];

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  const barData = financeData ? [
    { name: 'Income', amount: financeData.total_income },
    { name: 'Expenses', amount: financeData.total_expenses },
    { name: 'Savings', amount: financeData.savings }
  ] : [];

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" component="h1" gutterBottom>
        Personal Financial Analysis
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Financial Overview
              </Typography>
              <List>
                <ListItem>
                  <ListItemText
                    primary="Total Income"
                    secondary={`₹${financeData.total_income.toLocaleString()}`}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Total Expenses"
                    secondary={`₹${financeData.total_expenses.toLocaleString()}`}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Savings"
                    secondary={`₹${financeData.savings.toLocaleString()}`}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Savings Rate"
                    secondary={`${financeData.savings_rate.toFixed(2)}%`}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Current Balance"
                    secondary={`₹${financeData.current_balance.toLocaleString()}`}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Emergency Fund Status"
                    secondary={financeData.emergency_fund_status}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Income vs Expenses vs Savings
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => [`₹${value.toLocaleString()}`, 'Amount']} />
                  <Legend />
                  <Bar dataKey="amount" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Expense Breakdown by Category
              </Typography>
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`₹${value.toLocaleString()}`, 'Amount']} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
};

export default PersonalFinance;