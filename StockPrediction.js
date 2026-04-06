import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Grid,
  Alert,
  CircularProgress
} from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import axios from 'axios';

const StockPrediction = () => {
  const [symbol, setSymbol] = useState('RELIANCE');
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePredict = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`/api/stock_prediction/${symbol}`);
      setPrediction(response.data);
    } catch (err) {
      setError('Error fetching prediction. Please try again.');
      console.error('Error:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    handlePredict();
  }, []);

  const chartData = prediction ? [
    { name: 'Current', price: prediction.current_price },
    { name: 'Predicted', price: prediction.predicted_price }
  ] : [];

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" component="h1" gutterBottom>
        Stock Price Prediction
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Enter Stock Symbol
              </Typography>
              <TextField
                fullWidth
                label="Stock Symbol"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                margin="normal"
              />
              <Button
                variant="contained"
                onClick={handlePredict}
                disabled={loading}
                fullWidth
                sx={{ mt: 2 }}
              >
                {loading ? <CircularProgress size={24} /> : 'Predict'}
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {prediction && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Prediction Results for {symbol}
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body1">
                      Current Price: ₹{prediction.current_price.toFixed(2)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body1">
                      Predicted Price: ₹{prediction.predicted_price.toFixed(2)}
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography
                      variant="body1"
                      color={prediction.change_percent > 0 ? 'green' : 'red'}
                    >
                      Change: {prediction.change_percent > 0 ? '+' : ''}{prediction.change_percent.toFixed(2)}%
                    </Typography>
                  </Grid>
                </Grid>

                <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>
                  Price Comparison
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`₹${value.toFixed(2)}`, 'Price']} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="price"
                      stroke="#8884d8"
                      strokeWidth={2}
                      dot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>
    </Container>
  );
};

export default StockPrediction;