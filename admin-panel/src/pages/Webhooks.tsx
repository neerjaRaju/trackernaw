import { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Stack, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Chip, IconButton, Alert,
  FormGroup, FormControlLabel, Checkbox, Switch
} from '@mui/material';
import { Add, Delete, History, ContentCopy } from '@mui/icons-material';
import { api } from '../services/api';

type Webhook = {
  id: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  failureCount: number;
  secret: string;
  lastDeliveryAt: string | null;
};

export default function Webhooks() {
  const [hooks, setHooks] = useState<Webhook[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [secretReveal, setSecretReveal] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<any[] | null>(null);

  const load = () => api.get('/webhooks').then((r) => setHooks(r.data));
  useEffect(() => { load(); api.get('/webhooks/events').then((r) => setEvents(r.data)); }, []);

  const save = async () => {
    const r = await api.post('/webhooks', { name, url, events: [...sel] });
    setSecretReveal(r.data.secret);
    setOpen(false); setName(''); setUrl(''); setSel(new Set());
    load();
  };

  const toggle = async (h: Webhook) => {
    await api.put(`/webhooks/${h.id}`, { isActive: !h.isActive });
    load();
  };

  const del = async (id: string) => {
    if (!confirm('Delete this webhook?')) return;
    await api.delete(`/webhooks/${id}`);
    load();
  };

  const showDeliveries = async (id: string) => {
    const r = await api.get(`/webhooks/${id}/deliveries`);
    setDeliveries(r.data);
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" mb={2}>
        <Typography variant="h4" sx={{ flexGrow: 1 }}>Webhooks</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)}>New webhook</Button>
      </Stack>

      {secretReveal && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setSecretReveal(null)}>
          <strong>Save this signing secret now.</strong> You won't see it again:{' '}
          <code style={{ background: '#fff', padding: '2px 6px', borderRadius: 3 }}>{secretReveal}</code>
          <IconButton size="small" onClick={() => navigator.clipboard.writeText(secretReveal)}>
            <ContentCopy fontSize="small" />
          </IconButton>
        </Alert>
      )}

      <Stack spacing={1.5}>
        {hooks.map((h) => (
          <Card key={h.id}>
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center">
                <Box flexGrow={1}>
                  <Typography variant="subtitle1">{h.name}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                    {h.url}
                  </Typography>
                  <Stack direction="row" spacing={0.5} mt={1} flexWrap="wrap">
                    {h.events.map((e) => <Chip key={e} size="small" label={e} />)}
                  </Stack>
                  <Typography variant="caption" color="text.secondary" mt={1} display="block">
                    Last delivery: {h.lastDeliveryAt ? new Date(h.lastDeliveryAt).toLocaleString() : '—'} ·
                    Failures: {h.failureCount}
                  </Typography>
                </Box>
                <Switch checked={h.isActive} onChange={() => toggle(h)} />
                <IconButton onClick={() => showDeliveries(h.id)}><History /></IconButton>
                <IconButton onClick={() => del(h.id)} color="error"><Delete /></IconButton>
              </Stack>
            </CardContent>
          </Card>
        ))}
        {hooks.length === 0 && (
          <Typography color="text.secondary">No webhooks yet. Create one to receive outbound events.</Typography>
        )}
      </Stack>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New webhook</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
            <TextField label="URL" value={url} onChange={(e) => setUrl(e.target.value)} fullWidth
              placeholder="https://partner.example.com/hooks/fieldforce" />
            <Typography variant="subtitle2">Events</Typography>
            <FormGroup sx={{ maxHeight: 200, overflow: 'auto' }}>
              {events.map((e) => (
                <FormControlLabel
                  key={e}
                  control={
                    <Checkbox
                      checked={sel.has(e)}
                      onChange={(_, c) => {
                        const next = new Set(sel);
                        c ? next.add(e) : next.delete(e);
                        setSel(next);
                      }}
                    />
                  }
                  label={e}
                />
              ))}
            </FormGroup>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!name || !url || sel.size === 0} onClick={save}>Create</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deliveries} onClose={() => setDeliveries(null)} maxWidth="md" fullWidth>
        <DialogTitle>Recent deliveries</DialogTitle>
        <DialogContent>
          {deliveries?.length === 0 && <Typography color="text.secondary">No deliveries yet.</Typography>}
          {(deliveries || []).map((d) => (
            <Box key={d.id} sx={{ p: 1.5, borderBottom: '1px solid #eee' }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  size="small"
                  label={d.status || 'ERR'}
                  color={d.status && d.status < 400 ? 'success' : 'error'}
                />
                <Typography variant="body2"><strong>{d.event}</strong></Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date(d.attemptedAt).toLocaleString()}
                </Typography>
              </Stack>
              {d.response && (
                <Box sx={{ mt: 0.5, fontFamily: 'monospace', fontSize: 11, color: '#666' }}>
                  {d.response}
                </Box>
              )}
            </Box>
          ))}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
