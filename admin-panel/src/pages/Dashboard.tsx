import { useEffect, useState } from 'react';
import { Grid, Card, CardContent, Typography, Box } from '@mui/material';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';
import { api } from '../services/api';

type Summary = {
  totalEmployees: number;
  presentToday: number;
  attendanceRate: number;
  openTasks: number;
  pendingExpenses: number;
  todayOrders: number;
};

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [trend, setTrend] = useState<any[]>([]);

  useEffect(() => {
    api.get('/dashboard/summary').then((r) => setSummary(r.data)).catch(() => {});
    api.get('/dashboard/attendance-trend').then((r) => setTrend(r.data)).catch(() => {});
  }, []);

  const tiles = [
    { label: 'Total Employees', value: summary?.totalEmployees ?? '—' },
    { label: 'Present Today', value: summary?.presentToday ?? '—' },
    { label: 'Attendance %', value: summary ? `${summary.attendanceRate}%` : '—' },
    { label: 'Open Tasks', value: summary?.openTasks ?? '—' },
    { label: 'Pending Expenses', value: summary?.pendingExpenses ?? '—' },
    { label: "Today's Orders", value: summary?.todayOrders ?? '—' },
  ];

  return (
    <Box>
      <Typography variant="h4" mb={3}>Dashboard</Typography>
      <Grid container spacing={2}>
        {tiles.map((t) => (
          <Grid item xs={12} sm={6} md={4} lg={2} key={t.label}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">{t.label}</Typography>
                <Typography variant="h4">{t.value}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" mb={2}>Attendance Trend (30 days)</Typography>
          <Box height={300}>
            <ResponsiveContainer>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="present" stroke="#2563eb" />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
