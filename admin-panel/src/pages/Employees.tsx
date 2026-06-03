import { useEffect, useState } from 'react';
import { Box, Typography, Card } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { api } from '../services/api';

const columns: GridColDef[] = [
  { field: 'fullName', headerName: 'Name', flex: 1 },
  { field: 'email', headerName: 'Email', flex: 1 },
  { field: 'role', headerName: 'Role', width: 140 },
  { field: 'lastLoginAt', headerName: 'Last login', flex: 1 },
  { field: 'isActive', headerName: 'Active', type: 'boolean', width: 90 },
];

export default function Employees() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { api.get('/users').then((r) => setRows(r.data)); }, []);
  return (
    <Box>
      <Typography variant="h4" mb={2}>Employees</Typography>
      <Card>
        <DataGrid rows={rows} columns={columns} autoHeight getRowId={(r) => r.id} />
      </Card>
    </Box>
  );
}
