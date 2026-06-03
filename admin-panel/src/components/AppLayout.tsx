import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText, AppBar, Toolbar, Typography, IconButton } from '@mui/material';
import { Dashboard, Map, AccessTime, Assignment, Receipt, ShoppingCart, People, Logout, Sos, Description, Whatshot, Place, Route, PrivacyTip, EventNote, DynamicForm, History, Webhook, Business } from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../store';

const baseItems = [
  { to: '/', label: 'Dashboard', icon: <Dashboard /> },
  { to: '/live-map', label: 'Live Map', icon: <Map /> },
  { to: '/routes', label: 'Routes & Stops', icon: <Route /> },
  { to: '/heatmap', label: 'Heatmap', icon: <Whatshot /> },
  { to: '/geofences', label: 'Geofences', icon: <Place /> },
  { to: '/attendance', label: 'Attendance', icon: <AccessTime /> },
  { to: '/tasks', label: 'Tasks', icon: <Assignment /> },
  { to: '/expenses', label: 'Expenses', icon: <Receipt /> },
  { to: '/leaves', label: 'Leaves', icon: <EventNote /> },
  { to: '/orders', label: 'Orders', icon: <ShoppingCart /> },
  { to: '/employees', label: 'Employees', icon: <People /> },
  { to: '/sos', label: 'SOS Alerts', icon: <Sos sx={{ color: 'red' }} /> },
  { to: '/reports', label: 'Reports', icon: <Description /> },
  { to: '/forms', label: 'Forms', icon: <DynamicForm /> },
  { to: '/privacy', label: 'Privacy', icon: <PrivacyTip /> },
  { to: '/audit', label: 'Audit Log', icon: <History /> },
  { to: '/webhooks', label: 'Webhooks', icon: <Webhook /> },
];

const superAdminItems = [
  { to: '/companies', label: 'Companies', icon: <Business /> },
];

const drawerWidth = 240;

export default function AppLayout() {
  const dispatch = useDispatch();
  const nav = useNavigate();
  const user = useSelector((state: any) => state.auth.user);

  function doLogout() { dispatch(logout()); nav('/login'); }

  const items = user?.role === 'SUPER_ADMIN' ? [...superAdminItems, ...baseItems] : baseItems;

  return (
    <Box display="flex">
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>Field Force Admin</Typography>
          <IconButton color="inherit" onClick={doLogout}><Logout /></IconButton>
        </Toolbar>
      </AppBar>
      <Drawer variant="permanent" sx={{ width: drawerWidth, '& .MuiDrawer-paper': { width: drawerWidth } }}>
        <Toolbar />
        <List>
          {items.map((it) => (
            <ListItemButton key={it.to} component={NavLink} to={it.to} end>
              <ListItemIcon>{it.icon}</ListItemIcon>
              <ListItemText primary={it.label} />
            </ListItemButton>
          ))}
        </List>
      </Drawer>
      <Box component="main" flexGrow={1} p={3}>
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}

