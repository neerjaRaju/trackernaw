import { useEffect, useState } from 'react';
import { Box, Typography, Card } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { api } from '../services/api';

const columns: GridColDef[] = [
  { field: 'orderNumber', headerName: 'Order #', width: 160 },
  { field: 'dealer', headerName: 'Dealer', flex: 1, valueGetter: (_v, r) => r.dealer?.name },
  { field: 'total', headerName: 'Total', width: 120 },
  { field: 'status', headerName: 'Status', width: 140 },
  { field: 'createdAt', headerName: 'Created', flex: 1 },
];

export default function Orders() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { api.get('/orders').then((r) => setRows(r.data)); }, []);
  return (
    <Box>
      <Typography variant="h4" mb={2}>Orders</Typography>
      <Card>
        <DataGrid rows={rows} columns={columns} autoHeight getRowId={(r) => r.id} />
      </Card>
    </Box>
  );
}
