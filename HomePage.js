import React from 'react';
import {
  Container,
  Typography,
  Card,
  CardContent,
  Grid,
  Box,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Button
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import AssessmentIcon from '@mui/icons-material/Assessment';

const HomePage = ({ onTabChange }) => {
  const features = [
    {
      icon: <AccountBalanceIcon sx={{ fontSize: 40, color: 'primary.main' }} />,
      title: 'Personal Finance Analysis',
      description: 'Analyze your income, expenses, and spending patterns to understand your financial health.'
    },
    {
      icon: <TrendingUpIcon sx={{ fontSize: 40, color: 'primary.main' }} />,
      title: 'Stock Market Intelligence',
      description: 'Get real-time stock analysis, technical indicators, and market trend predictions.'
    },
    {
      icon: <SmartToyIcon sx={{ fontSize: 40, color: 'primary.main' }} />,
      title: 'AI-Powered Recommendations',
      description: 'Receive personalized investment and spending advice based on your financial situation.'
    },
    {
      icon: <AnalyticsIcon sx={{ fontSize: 40, color: 'primary.main' }} />,
      title: 'Spending Optimization',
      description: 'Learn how to optimize your savings and allocate funds across different categories.'
    },
    {
      icon: <AssessmentIcon sx={{ fontSize: 40, color: 'primary.main' }} />,
      title: 'Performance Tracking',
      description: 'Monitor system performance and get insights into prediction accuracy.'
    }
  ];

  const steps = [
    'Enter your financial transactions',
    'Review market conditions and stock analysis',
    'Get personalized AI recommendations',
    'Optimize your spending and savings',
    'Track performance and insights'
  ];

  return (
    <Box sx={{ backgroundColor: 'background.default', minHeight: '100vh', color: 'text.primary' }}>
      {/* Hero Section */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          color: 'white',
          py: 8,
          textAlign: 'center',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
        }}
      >
        <Container maxWidth="md">
          <Typography variant="h2" component="h1" gutterBottom sx={{ fontWeight: 'bold', color: '#ffffff' }}>
            Intelligent Financial Decision-Making System
          </Typography>
          <Typography variant="h5" sx={{ mb: 4, opacity: 0.9, color: '#b8c5d6' }}>
            Make smarter financial decisions with AI-powered insights tailored to your personal situation
          </Typography>
          <Typography variant="body1" sx={{ mb: 4, color: '#8892a0' }}>
            Use the tabs above to navigate through different sections of the system
          </Typography>
        </Container>
      </Box>

      {/* Features Section */}
      <Container maxWidth="lg" sx={{ py: 8, backgroundColor: 'background.default' }}>
        <Typography variant="h3" component="h2" textAlign="center" gutterBottom sx={{ mb: 6, color: '#ffffff' }}>
          What Our System Does
        </Typography>

        <Grid container spacing={4}>
          {features.map((feature, index) => (
            <Grid item xs={12} md={6} lg={4} key={index}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.2s',
                  background: 'linear-gradient(135deg, rgba(26, 26, 46, 0.9) 0%, rgba(22, 22, 38, 0.9) 100%)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                  },
                }}
              >
                <CardContent sx={{ flexGrow: 1, textAlign: 'center' }}>
                  <Box sx={{ mb: 2 }}>
                    {React.cloneElement(feature.icon, {
                      sx: { fontSize: 40, color: '#6366f1' }
                    })}
                  </Box>
                  <Typography variant="h6" component="h3" gutterBottom sx={{ color: '#ffffff', fontWeight: 'bold' }}>
                    {feature.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#b8c5d6' }}>
                    {feature.description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* How It Works Section */}
      <Box sx={{ backgroundColor: 'background.paper', py: 8, borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <Container maxWidth="md">
          <Typography variant="h3" component="h2" textAlign="center" gutterBottom sx={{ mb: 6, color: '#ffffff' }}>
            How It Works
          </Typography>

          <Card
            sx={{
              background: 'linear-gradient(135deg, rgba(26, 26, 46, 0.9) 0%, rgba(22, 22, 38, 0.9) 100%)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <CardContent sx={{ p: 4 }}>
              <List>
                {steps.map((step, index) => (
                  <ListItem key={index} sx={{ px: 0 }}>
                    <ListItemIcon>
                      <Chip
                        label={index + 1}
                        sx={{
                          backgroundColor: 'rgba(99, 102, 241, 0.2)',
                          color: '#6366f1',
                          fontWeight: 'bold',
                          minWidth: 32,
                          height: 32,
                        }}
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography variant="body1" sx={{ color: '#ffffff', fontWeight: 'medium' }}>
                          {step}
                        </Typography>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>

          <Box sx={{ textAlign: 'center', mt: 6 }}>
            <Typography variant="h4" gutterBottom sx={{ color: '#ffffff', mb: 4 }}>
              Ready to Get Started?
            </Typography>
            <Typography variant="body1" sx={{ color: '#b8c5d6', mb: 4 }}>
              Begin by entering your financial transactions to receive personalized insights and recommendations.
            </Typography>
            <Button
              variant="contained"
              size="large"
              onClick={() => onTabChange?.(null, 1)}
              sx={{
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #5b5fcf 0%, #7c3aed 100%)',
                },
                px: 4,
                py: 1.5,
                fontSize: '1.1rem',
              }}
            >
              Start Your Financial Journey
            </Button>
          </Box>
        </Container>
      </Box>
    </Box>
  );
};

export default HomePage;
