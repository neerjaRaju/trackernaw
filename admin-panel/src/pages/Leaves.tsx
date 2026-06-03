import { useEffect, useState } from 'react';
import {
  Box, Card, Typography, Stack, Chip, Button, ToggleButtonGroup, ToggleButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Avatar
} from '@mui/material';
import { Check, Close } from '@mui/icons-material';
import { api } from '../services/api';

type Leave = {
  id: string;
  userId: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  decisionNote?: string | null;
  user?: { id: string; fullName: string; avatarUrl?: string | null } | null;
};

const statusColor: Record<string, any> = {
  PENDING: 'warning', APPROVED: 'success', REJECTED: 'error', CANCELLED: 'default',
};

export default function Leaves() {
  const [filter, setFilter] = useState<string>('PENDING');
  const [rows, setRows] = useState<Leave[]>([]);
  const [decide, setDecide] = useState<{ leave: Leave; action: 'APPROVED' | 'REJECTED' } | null>(null);
  const [note, setNote] = useState('');

  const load = () => {
    const q = filter === 'ALL' ? '' : `?status=${filter}`;
    api.get(`/leaves${q}`).then((r) => setRows(r.data));
  };
  useEffect(() => { load(); }, [filter]);

  const submit = async () => {
    if (!decide) return;
    await api.post(`/leaves/${decide.leave.id}/decide`, { status: decide.action, decisionNote: note });
    setDecide(null); setNote('');
    load();
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" mb={2} spacing={2}>
        <Typography variant="h4" sx={{ flexGrow: 1 }}>Leave Requests</Typography>
        <ToggleButtonGroup size="small" exclusive value={filter} onChange={(_, v) => v && setFilter(v)}>
          <ToggleButton value="PENDING">Pending</ToggleButton>
          <ToggleButton value="APPROVED">Approved</ToggleButton>
          <ToggleButton value="REJECTED">Rejected</ToggleButton>
          <ToggleButton value="ALL">All</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      <Stack spacing={1.5}>
        {rows.map((l) => (
          <Card key={l.id}>
            <Stack direction="row" spacing={2} alignItems="center" p={2}>
              <Avatar src={l.user?.avatarUrl || undefined}>{l.user?.fullName?.[0] || '?'}</Avatar>
              <Box flexGrow={1}>
                <Typography variant="subtitle1">
                  {l.user?.fullName || 'Unknown'} · <Chip size="small" label={l.type} sx={{ mr: 1 }} />
                  <Chip size="small" label={`${l.days} day${l.days !== 1 ? 's' : ''}`} />
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {new Date(l.startDate).toLocaleDateString()} → {new Date(l.endDate).toLocaleDateString()}
                </Typography>
                {l.reason && <Typography variant="body2" mt={0.5}>"{l.reason}"</Typography>}
                {l.decisionNote && (
                  <Typography variant="caption" color="text.secondary">Manager note: {l.decisionNote}</Typography>
                )}
              </Box>
              <Chip label={l.status} color={statusColor[l.status]} />
              {l.status === 'PENDING' && (
                <Stack direction="row" spacing={1}>
                  <Button size="small" variant="contained" color="success" startIcon={<Check />} onClick={() => setDecide({ leave: l, action: 'APPROVED' })}>
                    Approve
                  </Button>
                  <Button size="small" variant="outlined" color="error" startIcon={<Close />} onClick={() => setDecide({ leave: l, action: 'REJECTED' })}>
                    Reject
                  </Button>
                </Stack>
              )}
            </Stack>
          </Card>
        ))}
        {rows.length === 0 && <Typography color="text.secondary">No leave requests in this view.</Typography>}
      </Stack>

      <Dialog open={!!decide} onClose={() => setDecide(null)}>
        <DialogTitle>{decide?.action === 'APPROVED' ? 'Approve' : 'Reject'} leave request</DialogTitle>
        <DialogContent>
          <Typography variant="body2" mb={2}>
            {decide?.leave.user?.fullName} — {decide?.leave.type} · {decide?.leave.days} day(s)
          </Typography>
          <TextField fullWidth multiline minRows={2} label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDecide(null)}>Cancel</Button>
          <Button variant="contained" color={decide?.action === 'APPROVED' ? 'success' : 'error'} onClick={submit}>
            {decide?.action === 'APPROVED' ? 'Approve' : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
