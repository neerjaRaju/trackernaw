import { useEffect, useState } from 'react';
import { Box, Typography, Card, Chip } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { api } from '../services/api';

const columns: GridColDef[] = [
  { field: 'title', headerName: 'Title', flex: 1 },
  { field: 'assignee', headerName: 'Assignee', flex: 1, valueGetter: (_v, r) => r.assignee?.fullName },
  { field: 'priority', headerName: 'Priority', width: 110,
    renderCell: (p) => <Chip size="small" label={p.value} /> },
  { field: 'status', headerName: 'Status', width: 140 },
  { field: 'dueAt', headerName: 'Due', flex: 1 },
];

export default function Tasks() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { api.get('/tasks').then((r) => setRows(r.data)); }, []);
  return (
    <Box>
      <Typography variant="h4" mb={2}>Tasks</Typography>
      <Card>
        <DataGrid rows={rows} columns={columns} autoHeight getRowId={(r) => r.id} />
      </Card>
    </Box>
  );
}
