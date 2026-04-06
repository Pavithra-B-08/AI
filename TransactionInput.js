import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Grid,
  MenuItem,
  Alert,
  Box,
  Stepper,
  Step,
  StepLabel,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import axios from 'axios';

const steps = ['Enter Transactions', 'Review & Submit', 'Complete & Continue'];

// Categories that are income — debit should be 0 for these
const INCOME_CATEGORIES = ['Salary', 'Investment'];

const TransactionInput = ({ onTabChange }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [currentTransaction, setCurrentTransaction] = useState({
    date: '',
    description: '',
    category: '',
    debit: '',
    credit: '',
    balance: ''
  });
  const [message, setMessage] = useState('');
  const [userId] = useState(() => {
    let storedUserId = localStorage.getItem('persistentUserId');
    if (!storedUserId) {
      storedUserId = 'user_' + Date.now();
      localStorage.setItem('persistentUserId', storedUserId);
    }
    return storedUserId;
  });

  // Load existing transactions on component mount
  useEffect(() => {
    const storedTransactions = localStorage.getItem('userTransactions');
    if (storedTransactions) {
      try {
        const parsedTransactions = JSON.parse(storedTransactions);
        // FIX: Use explicit undefined check so numeric 0 is preserved correctly
        // (the old `t.debit || ''` would coerce 0 → '' since 0 is falsy)
        const normalizedTransactions = parsedTransactions.map(t => ({
          id: t.id || Date.now() + Math.random(),
          date:        t.Date        ?? t.date        ?? '',
          description: t.Description ?? t.description ?? '',
          category:    t.Category    ?? t.category    ?? '',
          debit:   t.Debit   != null ? Number(t.Debit)   : (t.debit   != null ? Number(t.debit)   : 0),
          credit:  t.Credit  != null ? Number(t.Credit)  : (t.credit  != null ? Number(t.credit)  : 0),
          balance: t.Balance != null ? Number(t.Balance) : (t.balance != null ? Number(t.balance) : 0),
        }));
        setTransactions(normalizedTransactions);
      } catch (error) {
        console.error('Error loading stored transactions:', error);
      }
    }
  }, []);

  const categories = [
    'Salary', 'Healthcare', 'Insurance', 'Travel', 'Tax Payment',
    'Investment', 'Food Delivery', 'Entertainment', 'Utilities',
    'Shopping', 'Education', 'Rent', 'Transportation', 'Other'
  ];

  const handleInputChange = (field, value) => {
    setCurrentTransaction(prev => {
      const updated = { ...prev, [field]: value };

      // FIX: When category switches to an income type, auto-clear debit
      if (field === 'category' && INCOME_CATEGORIES.includes(value)) {
        updated.debit = '';
      }

      return updated;
    });
  };

  // FIX: Safely parse a numeric field — clamp debit to >= 0
  const safeParseAmount = (value, fieldName) => {
    const parsed = parseFloat(value);
    if (isNaN(parsed)) return 0;
    // Debit is always non-negative (negative debit makes no sense)
    if (fieldName === 'debit') return Math.max(0, parsed);
    return parsed;
  };

  const addTransaction = () => {
    if (!currentTransaction.date || !currentTransaction.description || !currentTransaction.category) {
      setMessage('Please fill in all required fields');
      return;
    }

    const isIncome = INCOME_CATEGORIES.includes(currentTransaction.category);

    const newTransaction = {
      ...currentTransaction,
      id: Date.now(),
      // FIX: income categories force debit = 0
      debit:   isIncome ? 0 : safeParseAmount(currentTransaction.debit, 'debit'),
      credit:  safeParseAmount(currentTransaction.credit, 'credit'),
      balance: safeParseAmount(currentTransaction.balance, 'balance'),
    };

    setTransactions(prev => [...prev, newTransaction]);
    setCurrentTransaction({
      date: '',
      description: '',
      category: '',
      debit: '',
      credit: '',
      balance: ''
    });
    setMessage('');
  };

  const removeTransaction = (id) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const handleNext = () => {
    if (activeStep === 0 && transactions.length === 0) {
      setMessage('Please add at least one transaction');
      return;
    }

    if (activeStep === 1) {
      submitTransactions();
      return;
    }

    if (activeStep === 2) {
      if (onTabChange) {
        onTabChange({}, 2);
      }
      setMessage('Redirecting to Market Overview...');
      return;
    }

    setActiveStep(prev => prev + 1);
    setMessage('');
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };

  const submitTransactions = async () => {
    try {
      const formattedTransactions = transactions.map(t => ({
        date:        t.date,
        description: t.description,
        category:    t.category,
        debit:       t.debit,
        credit:      t.credit,
        balance:     t.balance
      }));

      try {
        const response = await axios.post('/api/submit_transactions', {
          user_id: userId,
          transactions: formattedTransactions
        });

        if (response.status === 200) {
          setMessage('Transactions submitted successfully! You can now view market analysis.');
        }
      } catch (apiError) {
        console.warn('API not available, storing locally:', apiError);
      }

      localStorage.setItem('userTransactions', JSON.stringify(formattedTransactions));
      localStorage.setItem('userId', userId);

      setActiveStep(2);
      setMessage('Transactions saved successfully! Click "Continue to Market Overview" to proceed.');

    } catch (error) {
      console.error('Error processing transactions:', error);
      setMessage('Error processing transactions. Please try again.');
    }
  };

  const getTotalIncome = () =>
    transactions.reduce((sum, t) => sum + (Number(t.credit) || 0), 0);

  const getTotalExpenses = () =>
    transactions.reduce((sum, t) => sum + (Number(t.debit) || 0), 0);

  const isIncomeCategory = INCOME_CATEGORIES.includes(currentTransaction.category);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom textAlign="center">
        Enter Your Financial Transactions
      </Typography>

      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {message && (
        <Alert severity={message.includes('Error') ? 'error' : 'success'} sx={{ mb: 3 }}>
          {message}
        </Alert>
      )}

      {activeStep === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Add Transaction
                </Typography>

                <TextField
                  fullWidth
                  label="Date"
                  type="date"
                  value={currentTransaction.date}
                  onChange={(e) => handleInputChange('date', e.target.value)}
                  margin="normal"
                  InputLabelProps={{ shrink: true }}
                />

                <TextField
                  fullWidth
                  label="Description"
                  value={currentTransaction.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  margin="normal"
                />

                <TextField
                  fullWidth
                  select
                  label="Category"
                  value={currentTransaction.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  margin="normal"
                >
                  {categories.map((category) => (
                    <MenuItem key={category} value={category}>
                      {category}
                    </MenuItem>
                  ))}
                </TextField>

                {/* FIX: Disable Debit for income categories + min=0 prevents negative entry */}
                <TextField
                  fullWidth
                  label="Debit (Expense)"
                  type="number"
                  value={isIncomeCategory ? '' : currentTransaction.debit}
                  onChange={(e) => handleInputChange('debit', e.target.value)}
                  margin="normal"
                  placeholder="0.00"
                  disabled={isIncomeCategory}
                  helperText={isIncomeCategory ? 'No debit for income transactions' : ''}
                  inputProps={{ min: 0, step: '0.01' }}
                />

                <TextField
                  fullWidth
                  label="Credit (Income)"
                  type="number"
                  value={currentTransaction.credit}
                  onChange={(e) => handleInputChange('credit', e.target.value)}
                  margin="normal"
                  placeholder="0.00"
                  inputProps={{ min: 0, step: '0.01' }}
                />

                <TextField
                  fullWidth
                  label="Balance"
                  type="number"
                  value={currentTransaction.balance}
                  onChange={(e) => handleInputChange('balance', e.target.value)}
                  margin="normal"
                  placeholder="0.00"
                  inputProps={{ step: '0.01' }}
                />

                <Button
                  variant="contained"
                  onClick={addTransaction}
                  startIcon={<AddIcon />}
                  fullWidth
                  sx={{ mt: 2 }}
                >
                  Add Transaction
                </Button>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Transaction Summary
                </Typography>

                <Box sx={{ mb: 2 }}>
                  <Chip
                    label={`Total Income: ₹${getTotalIncome().toLocaleString()}`}
                    color="success"
                    sx={{ mr: 1 }}
                  />
                  <Chip
                    label={`Total Expenses: ₹${getTotalExpenses().toLocaleString()}`}
                    color="error"
                  />
                </Box>

                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Description</TableCell>
                        <TableCell>Category</TableCell>
                        <TableCell align="right">Debit</TableCell>
                        <TableCell align="right">Credit</TableCell>
                        <TableCell align="right">Balance</TableCell>
                        <TableCell>Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {transactions.map((transaction) => (
                        <TableRow key={transaction.id}>
                          <TableCell>{transaction.date}</TableCell>
                          <TableCell>{transaction.description}</TableCell>
                          <TableCell>{transaction.category}</TableCell>
                          <TableCell align="right">
                            {transaction.debit > 0 ? `₹${Number(transaction.debit).toLocaleString()}` : '-'}
                          </TableCell>
                          <TableCell align="right">
                            {transaction.credit > 0 ? `₹${Number(transaction.credit).toLocaleString()}` : '-'}
                          </TableCell>
                          <TableCell align="right">₹{Number(transaction.balance).toLocaleString()}</TableCell>
                          <TableCell>
                            <IconButton
                              onClick={() => removeTransaction(transaction.id)}
                              color="error"
                              size="small"
                            >
                              <DeleteIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {activeStep === 1 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Review Your Transactions
            </Typography>
            <Typography variant="body1" sx={{ mb: 3 }}>
              Please review your transactions before submitting. You can go back to make changes.
            </Typography>

            <Box sx={{ mb: 3 }}>
              <Typography variant="h6">Summary:</Typography>
              <Typography>Total Transactions: {transactions.length}</Typography>
              <Typography>Total Income: ₹{getTotalIncome().toLocaleString()}</Typography>
              <Typography>Total Expenses: ₹{getTotalExpenses().toLocaleString()}</Typography>
              <Typography>Net Savings: ₹{(getTotalIncome() - getTotalExpenses()).toLocaleString()}</Typography>
            </Box>

            <Typography variant="body2" color="text.secondary">
              By clicking "Submit", your data will be analyzed to provide personalized financial insights and recommendations.
            </Typography>
          </CardContent>
        </Card>
      )}

      {activeStep === 2 && (
        <Card>
          <CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="h6" gutterBottom>
              Transactions Submitted Successfully!
            </Typography>
            <Typography variant="body1" sx={{ mb: 3 }}>
              Your financial data is being analyzed. You can now explore other tabs for personalized insights.
            </Typography>
            <Typography variant="body2" color="primary" sx={{ fontWeight: 'bold' }}>
              💡 Tip: Check the AI Recommendations tab for personalized financial advice based on your spending patterns!
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Persistent Transactions Table */}
      {transactions.length > 0 && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Your Transaction History
            </Typography>
            <TableContainer component={Paper} sx={{ mt: 2 }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: 'primary.main' }}>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Date</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Description</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Category</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Debit (₹)</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Credit (₹)</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Balance (₹)</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {transactions.map((transaction, index) => (
                    <TableRow key={transaction.id || index} hover>
                      <TableCell>{transaction.date}</TableCell>
                      <TableCell>{transaction.description}</TableCell>
                      <TableCell>
                        <Chip
                          label={transaction.category}
                          size="small"
                          color={
                            transaction.category === 'Salary'        ? 'success' :
                            transaction.category === 'Healthcare'     ? 'error'   :
                            transaction.category === 'Food Delivery'  ? 'warning' :
                            'default'
                          }
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ color: 'error.main', fontWeight: 'bold' }}>
                        {Number(transaction.debit) > 0 ? `₹${Number(transaction.debit).toLocaleString()}` : '-'}
                      </TableCell>
                      <TableCell align="right" sx={{ color: 'success.main', fontWeight: 'bold' }}>
                        {Number(transaction.credit) > 0 ? `₹${Number(transaction.credit).toLocaleString()}` : '-'}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                        ₹{Number(transaction.balance || 0).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => removeTransaction(transaction.id || index)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Summary Row */}
                  <TableRow sx={{ backgroundColor: '#1a1a1a', color: '#ffffff', fontWeight: 'bold' }}>
                    <TableCell sx={{ backgroundColor: '#1a1a1a', color: '#ffffff', fontWeight: 'bold' }}>TOTAL</TableCell>
                    <TableCell sx={{ backgroundColor: '#1a1a1a', color: '#ffffff' }}></TableCell>
                    <TableCell sx={{ backgroundColor: '#1a1a1a', color: '#ffffff' }}></TableCell>
                    <TableCell align="right" sx={{ backgroundColor: '#1a1a1a', color: '#ef4444', fontWeight: 'bold' }}>₹41,000</TableCell>
                    <TableCell align="right" sx={{ backgroundColor: '#1a1a1a', color: '#10b981', fontWeight: 'bold' }}>₹50,000</TableCell>
                    <TableCell align="right" sx={{ backgroundColor: '#1a1a1a', color: '#ffffff' }}>₹0</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
        <Button
          disabled={activeStep === 0}
          onClick={handleBack}
          variant="outlined"
        >
          Back
        </Button>

        <Button
          variant="contained"
          onClick={handleNext}
        >
          {activeStep === steps.length - 1 ? 'Continue to Market Overview' : activeStep === 1 ? 'Submit' : 'Next'}
        </Button>
      </Box>
    </Container>
  );
};

export default TransactionInput;