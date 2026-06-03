import { useEffect, useState } from 'react';
import { Box, Typography, Card, Stack, TextField, Button } from '@mui/material';
import { Download, PictureAsPdf } from '@mui/icons-material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { api } from '../services/api';
import { store } from '../store';

function todayISO() { return new Date().toISOString().slice(0, 10); }

const cols: GridColDef[] = [
  { field: 'fullName', headerName: 'Employee', flex: 1 },
  { field: 'checkIn', headerName: 'In', width: 110, valueFormatter: (v) => v ? new Date(v as string).toLocaleTimeString() : '—' },
  { field: 'checkOut', headerName: 'Out', width: 110, valueFormatter: (v) => v ? new Date(v as string).toLocaleTimeString() : '—' },
  { field: 'workMinutes', headerName: 'Min', width: 80 },
  { field: 'distanceKm', headerName: 'Km', width: 80 },
  { field: 'tasksCompleted', headerName: 'Tasks', width: 80 },
  { field: 'visits', headerName: 'Visits', width: 80 },
  { field: 'expenseAmount', headerName: 'Expense', width: 110 },
  { field: 'faceVerified', headerName: 'Face ✓', width: 90, type: 'boolean' },
  { field: 'withinGeofence', headerName: 'Geofence', width: 100, type: 'boolean' },
];

export default function Reports() {
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async (d: string) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/reports/daily?date=${d}`);
      setRows(data.rows || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(date); }, [date]);

  function download(kind: 'csv' | 'pdf') {
    const token = store.getState().auth.accessToken;
    fetch(`/api/v1/reports/daily.${kind}?date=${date}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(async (r) => {
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `daily-${date}.${kind}`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <Box>
      <Typography variant="h4" mb={2}>Daily Reports</Typography>
      <Card sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField type="date" label="Date" value={date} onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          <Button variant="outlined" startIcon={<Download />} onClick={() => download('csv')}>CSV (payroll)</Button>
          <Button variant="contained" startIcon={<PictureAsPdf />} onClick={() => download('pdf')}>PDF</Button>
        </Stack>
      </Card>
      <Card>
        <DataGrid
          rows={rows}
          columns={cols}
          autoHeight
          loading={loading}
          getRowId={(r) => r.userId}
        />
      </Card>
    </Box>
  );
}
