import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Box,
  Alert
} from '@mui/material';
import axios from 'axios';

const UserPreferences = () => {
  const [preferences, setPreferences] = useState({
    risk_profile: 'moderate',
    investment_horizon: 'medium',
    preferred_sectors: []
  });
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const response = await axios.get('/api/user_preferences/1');
      setPreferences(response.data);
    } catch (error) {
      console.error('Error fetching preferences:', error);
    }
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setPreferences(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSectorChange = (event) => {
    const { value } = event.target;
    setPreferences(prev => ({
      ...prev,
      preferred_sectors: typeof value === 'string' ? value.split(',') : value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      await axios.post('/api/user_preferences/1', preferences);
      setMessage('Preferences saved successfully!');
    } catch (error) {
      console.error('Error saving preferences:', error);
      setMessage('Error saving preferences.');
    }
  };

  const sectors = ['Technology', 'Finance', 'Healthcare', 'Energy', 'Consumer Goods', 'Real Estate'];

  return (
    <Container maxWidth="md">
      <Typography variant="h4" component="h1" gutterBottom>
        User Preferences
      </Typography>
      {message && (
        <Alert severity={message.includes('Error') ? 'error' : 'success'} sx={{ mb: 2 }}>
          {message}
        </Alert>
      )}
      <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
        <FormControl fullWidth margin="normal">
          <InputLabel>Risk Profile</InputLabel>
          <Select
            name="risk_profile"
            value={preferences.risk_profile}
            onChange={handleChange}
            label="Risk Profile"
          >
            <MenuItem value="conservative">Conservative</MenuItem>
            <MenuItem value="moderate">Moderate</MenuItem>
            <MenuItem value="aggressive">Aggressive</MenuItem>
          </Select>
        </FormControl>

        <FormControl fullWidth margin="normal">
          <InputLabel>Investment Horizon</InputLabel>
          <Select
            name="investment_horizon"
            value={preferences.investment_horizon}
            onChange={handleChange}
            label="Investment Horizon"
          >
            <MenuItem value="short">Short-term (1-3 years)</MenuItem>
            <MenuItem value="medium">Medium-term (3-7 years)</MenuItem>
            <MenuItem value="long">Long-term (7+ years)</MenuItem>
          </Select>
        </FormControl>

        <FormControl fullWidth margin="normal">
          <InputLabel>Preferred Sectors</InputLabel>
          <Select
            multiple
            name="preferred_sectors"
            value={preferences.preferred_sectors}
            onChange={handleSectorChange}
            label="Preferred Sectors"
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selected.map((value) => (
                  <Chip key={value} label={value} />
                ))}
              </Box>
            )}
          >
            {sectors.map((sector) => (
              <MenuItem key={sector} value={sector}>
                {sector}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Button type="submit" variant="contained" sx={{ mt: 3 }}>
          Save Preferences
        </Button>
      </Box>
    </Container>
  );
};

export default UserPreferences;