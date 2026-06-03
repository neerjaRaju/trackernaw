import { useEffect, useState } from 'react';
import { Box, Typography, Card } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { api } from '../services/api';

const columns: GridColDef[] = [
  { field: 'fullName', headerName: 'Employee', flex: 1, valueGetter: (_v, row) => row.user?.fullName },
  { field: 'checkInAt', headerName: 'Check-in', flex: 1 },
  { field: 'checkOutAt', headerName: 'Check-out', flex: 1 },
  { field: 'workMinutes', headerName: 'Work min', width: 110 },
  { field: 'withinGeofence', headerName: 'In Geofence', width: 130, type: 'boolean' },
  { field: 'status', headerName: 'Status', width: 120 },
];

export default function Attendance() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { api.get('/attendance/team').then((r) => setRows(r.data)); }, []);
  return (
    <Box>
      <Typography variant="h4" mb={2}>Attendance — Today</Typography>
      <Card>
        <DataGrid rows={rows} columns={columns} autoHeight getRowId={(r) => r.id} />
      </Card>
    </Box>
  );
}
