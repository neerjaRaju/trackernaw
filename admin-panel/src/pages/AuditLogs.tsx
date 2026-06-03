import { useEffect, useState } from 'react';
import { Box, Card, Typography, Stack, TextField, Button, Chip } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { api } from '../services/api';

const cols: GridColDef[] = [
  { field: 'createdAt', headerName: 'When', width: 170,
    valueFormatter: (v) => new Date(v as string).toLocaleString() },
  { field: 'user', headerName: 'User', flex: 1,
    valueGetter: (_v, r) => r.user?.fullName || r.userId || '—' },
  { field: 'action', headerName: 'Action', width: 200,
    renderCell: (p) => <Chip size="small" label={p.value} /> },
  { field: 'entityType', headerName: 'Entity', width: 130 },
  { field: 'entityId', headerName: 'Entity ID', width: 220,
    renderCell: (p) => <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{p.value || ''}</span> },
  { field: 'ip', headerName: 'IP', width: 120 },
  { field: 'meta', headerName: 'Meta', flex: 1,
    valueFormatter: (v) => v ? JSON.stringify(v) : '' },
];

export default function AuditLogs() {
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0); // 0-indexed for DataGrid
  const [action, setAction] = useState('');
  const [userId, setUserId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [actions, setActions] = useState<string[]>([]);

  const load = async () => {
    const params = new URLSearchParams();
    if (action) params.set('action', action);
    if (userId) params.set('userId', userId);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    params.set('page', String(page + 1));
    params.set('pageSize', '50');
    const r = await api.get(`/audit?${params.toString()}`);
    setRows(r.data.rows); setTotal(r.data.total);
  };

  useEffect(() => { load(); }, [page]);
  useEffect(() => { api.get('/audit/actions').then((r) => setActions(r.data)); }, []);

  return (
    <Box>
      <Typography variant="h4" mb={2}>Audit Log</Typography>
      <Card sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2}>
          <TextField select size="small" label="Action" value={action}
            onChange={(e) => setAction(e.target.value)} sx={{ minWidth: 200 }}
            SelectProps={{ native: true }}>
            <option value="">All</option>
            {actions.map((a) => <option key={a} value={a}>{a}</option>)}
          </TextField>
          <TextField size="small" label="User ID" value={userId}
            onChange={(e) => setUserId(e.target.value)} sx={{ minWidth: 220 }} />
          <TextField size="small" type="date" label="From" value={from}
            onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField size="small" type="date" label="To" value={to}
            onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
          <Button variant="contained" onClick={() => { setPage(0); load(); }}>Apply</Button>
        </Stack>
      </Card>
      <Card>
        <DataGrid
          rows={rows} columns={cols} autoHeight
          getRowId={(r) => r.id}
          paginationMode="server"
          rowCount={total}
          paginationModel={{ page, pageSize: 50 }}
          onPaginationModelChange={(m) => setPage(m.page)}
          pageSizeOptions={[50]}
        />
      </Card>
    </Box>
  );
}
