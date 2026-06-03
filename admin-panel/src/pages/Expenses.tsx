import { useEffect, useState } from 'react';
import { Box, Typography, Card, Button, Stack } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { api } from '../services/api';

export default function Expenses() {
  const [rows, setRows] = useState<any[]>([]);
  const load = () => api.get('/expenses').then((r) => setRows(r.data));
  useEffect(() => { load(); }, []);

  const approve = async (id: string) => { await api.post(`/expenses/${id}/approve`); load(); };
  const reject = async (id: string) => { await api.post(`/expenses/${id}/reject`, { reason: 'Insufficient receipt' }); load(); };

  const columns: GridColDef[] = [
    { field: 'category', headerName: 'Category', width: 130 },
    { field: 'amount', headerName: 'Amount', width: 110 },
    { field: 'user', headerName: 'Submitted by', flex: 1, valueGetter: (_v, r) => r.user?.fullName },
    { field: 'distanceKm', headerName: 'Km', width: 90 },
    { field: 'status', headerName: 'Status', width: 130 },
    { field: 'actions', headerName: 'Actions', width: 220, renderCell: (p) => (
      <Stack direction="row" spacing={1}>
        <Button size="small" variant="outlined" onClick={() => approve(p.row.id)}>Approve</Button>
        <Button size="small" color="error" onClick={() => reject(p.row.id)}>Reject</Button>
      </Stack>
    ) },
  ];

  return (
    <Box>
      <Typography variant="h4" mb={2}>Expense Claims</Typography>
      <Card>
        <DataGrid rows={rows} columns={columns} autoHeight getRowId={(r) => r.id} />
      </Card>
    </Box>
  );
}
