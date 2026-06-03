import { useEffect, useState } from 'react';
import { Box, Typography, Card, CardContent, Stack, Chip, Button, Avatar, Alert, IconButton } from '@mui/material';
import { Sos, LocationOn, Phone, CheckCircle, Done } from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { api } from '../services/api';
import { getSocket } from '../services/socket';
import type { RootState } from '../store';

type AlertRow = {
  id: string;
  userId: string;
  lat: number;
  lng: number;
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  note?: string | null;
  user?: { id: string; fullName: string; phone?: string | null; avatarUrl?: string | null };
};

export default function SosAlerts() {
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [banner, setBanner] = useState<AlertRow | null>(null);
  const token = useSelector((s: RootState) => s.auth.accessToken);

  const load = () => api.get('/sos').then((r) => setAlerts(r.data)).catch(() => {});

  useEffect(() => {
    load();
    if (!token) return;
    const socket = getSocket(token);
    const onNew = (a: AlertRow) => {
      setAlerts((cur) => [a, ...cur]);
      setBanner(a);
      try { new Audio('/alert.mp3').play().catch(() => {}); } catch {}
    };
    const onUpd = (a: AlertRow) => setAlerts((cur) => cur.map((x) => x.id === a.id ? { ...x, ...a } : x));
    socket.on('sos:new', onNew);
    socket.on('sos:update', onUpd);
    return () => { socket.off('sos:new', onNew); socket.off('sos:update', onUpd); };
  }, [token]);

  const ack = (id: string) => api.post(`/sos/${id}/acknowledge`).then(load);
  const resolve = (id: string) => api.post(`/sos/${id}/resolve`).then(load);

  return (
    <Box>
      <Typography variant="h4" mb={2}><Sos sx={{ color: 'red', mr: 1, verticalAlign: 'middle' }} />SOS Alerts</Typography>

      {banner && banner.status === 'ACTIVE' && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setBanner(null)}>
          <strong>{banner.user?.fullName || 'A field agent'} just triggered an SOS.</strong>{' '}
          Location: {banner.lat.toFixed(5)}, {banner.lng.toFixed(5)}.{' '}
          {banner.user?.phone && `Call: ${banner.user.phone}`}
        </Alert>
      )}

      <Stack spacing={2}>
        {alerts.map((a) => (
          <Card key={a.id} sx={{ borderLeft: 6, borderColor: a.status === 'ACTIVE' ? 'error.main' : a.status === 'ACKNOWLEDGED' ? 'warning.main' : 'success.main' }}>
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center">
                <Avatar src={a.user?.avatarUrl || undefined}>{a.user?.fullName?.[0] || '?'}</Avatar>
                <Box flexGrow={1}>
                  <Typography variant="h6">{a.user?.fullName || 'Unknown'}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    <LocationOn sx={{ fontSize: 14, verticalAlign: 'middle' }} />
                    {' '}{a.lat.toFixed(5)}, {a.lng.toFixed(5)} · {new Date(a.createdAt).toLocaleString()}
                  </Typography>
                  {a.note && <Typography variant="body2" mt={0.5}>"{a.note}"</Typography>}
                </Box>
                <Chip
                  label={a.status}
                  color={a.status === 'ACTIVE' ? 'error' : a.status === 'ACKNOWLEDGED' ? 'warning' : 'success'}
                />
                {a.user?.phone && (
                  <IconButton href={`tel:${a.user.phone}`} color="primary"><Phone /></IconButton>
                )}
                <IconButton
                  href={`https://www.google.com/maps?q=${a.lat},${a.lng}`}
                  target="_blank"
                  color="primary"
                ><LocationOn /></IconButton>
                {a.status === 'ACTIVE' && (
                  <Button variant="outlined" color="warning" startIcon={<CheckCircle />} onClick={() => ack(a.id)}>
                    Acknowledge
                  </Button>
                )}
                {a.status !== 'RESOLVED' && (
                  <Button variant="contained" color="success" startIcon={<Done />} onClick={() => resolve(a.id)}>
                    Resolve
                  </Button>
                )}
              </Stack>
            </CardContent>
          </Card>
        ))}
        {!alerts.length && (
          <Typography color="text.secondary">No SOS alerts. The system is quiet.</Typography>
        )}
      </Stack>
    </Box>
  );
}
