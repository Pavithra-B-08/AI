import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Tabs,
  Tab,
  Box,
  Container,
  Paper,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  useMediaQuery,
  useTheme
} from '@mui/material';
import {
  Home as HomeIcon,
  AccountBalance as TransactionIcon,
  TrendingUp as MarketIcon,
  SmartToy as RecommendationIcon,
  Assessment as PerformanceIcon,
  Analytics as TrendingUp,
  Timeline as AssessmentIcon,
  Security as SmartToyIcon,
  Balance as AccountBalanceIcon,
  Menu as MenuIcon
} from '@mui/icons-material';

import HomePage from './HomePage';
import TransactionInput from './TransactionInput';
import MarketOverview from './MarketOverview';
import Recommendations from './Recommendations';
import PerformanceMetrics from './PerformanceMetrics';
import SpendingAnalysis from './SpendingAnalysis';
import FuturePredictions from './FuturePredictions';
import RiskAssessment from './RiskAssessment';
import PortfolioOptimization from './PortfolioOptimization';

const MainLayout = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const toggleDrawer = () => {
    setDrawerOpen(!drawerOpen);
  };

  const tabs = [
    { label: 'Home', icon: <HomeIcon />, component: <HomePage onTabChange={handleTabChange} /> },
    { label: 'Transactions', icon: <TransactionIcon />, component: <TransactionInput onTabChange={handleTabChange} /> },
    { label: 'Market Overview', icon: <MarketIcon />, component: <MarketOverview /> },
    { label: 'AI Recommendations', icon: <RecommendationIcon />, component: <Recommendations /> },
    { label: 'Performance', icon: <PerformanceIcon />, component: <PerformanceMetrics /> },
    { label: 'Spending Analysis', icon: <TrendingUp />, component: <SpendingAnalysis /> },
    { label: 'Future Predictions', icon: <AssessmentIcon />, component: <FuturePredictions /> },
    { label: 'Risk Assessment', icon: <SmartToyIcon />, component: <RiskAssessment /> },
    { label: 'Portfolio Optimization', icon: <AccountBalanceIcon />, component: <PortfolioOptimization /> }
  ];

  const drawerContent = (
    <List>
      {tabs.map((tab, index) => (
        <ListItem
          button
          key={index}
          onClick={() => {
            setActiveTab(index);
            setDrawerOpen(false);
          }}
          selected={activeTab === index}
        >
          <ListItemIcon>
            {tab.icon}
          </ListItemIcon>
          <ListItemText primary={tab.label} />
        </ListItem>
      ))}
    </List>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      <AppBar position="static" sx={{ backgroundColor: '#1a1a1a', color: '#ffffff' }}>
        <Toolbar>
          {isMobile && (
            <IconButton
              edge="start"
              color="inherit"
              onClick={toggleDrawer}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Intelligent Financial Decision-Making System
          </Typography>
        </Toolbar>
        {!isMobile && (
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            indicatorColor="secondary"
            textColor="inherit"
            variant="fullWidth"
            sx={{
              '& .MuiTab-root': { color: '#ffffff' },
              '& .MuiTabs-indicator': { backgroundColor: '#bb86fc' }
            }}
          >
            {tabs.map((tab, index) => (
              <Tab
                key={index}
                icon={tab.icon}
                label={tab.label}
                iconPosition="start"
              />
            ))}
          </Tabs>
        )}
      </AppBar>

      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={toggleDrawer}
        sx={{
          '& .MuiDrawer-paper': { 
            width: 250, 
            backgroundColor: '#1a1a1a', 
            color: '#ffffff' 
          },
          '& .MuiListItem-root': { color: '#ffffff' },
          '& .MuiListItemIcon-root': { color: '#bb86fc' }
        }}
      >
        {drawerContent}
      </Drawer>

      <Container maxWidth="xl" sx={{ flexGrow: 1, py: 3, backgroundColor: '#0a0a0a' }}>
        <Paper elevation={2} sx={{ 
          p: 3, 
          minHeight: '70vh', 
          backgroundColor: '#1a1a1a', 
          color: '#ffffff',
          border: '1px solid #333'
        }}>
          {tabs[activeTab].component}
        </Paper>
      </Container>
    </Box>
  );
};

export default MainLayout;