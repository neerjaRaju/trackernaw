import { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Button, Stack, Chip, Alert, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField
} from '@mui/material';
import { Download, DeleteForever, History } from '@mui/icons-material';
import { api } from '../services/api';
import { store } from '../store';

export default function Privacy() {
  const [consents, setConsents] = useState<any[]>([]);
  const [erasureOpen, setErasureOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [erasureMsg, setErasureMsg] = useState<string | null>(null);

  useEffect(() => { api.get('/me/consent').then((r) => setConsents(r.data)); }, []);

  function exportData() {
    const token = store.getState().auth.accessToken;
    fetch('/api/v1/me/export', { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => {
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'my-data.json'; a.click();
        URL.revokeObjectURL(url);
      });
  }

  async function submitErasure() {
    const { data } = await api.post('/me/erasure', { reason });
    setErasureOpen(false);
    setErasureMsg(data.message);
  }

  return (
    <Box>
      <Typography variant="h4" mb={2}>Privacy &amp; Data Rights</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Under India's Digital Personal Data Protection Act (DPDP, 2023), you have the right
        to access, correct, and erase your personal data. Use the controls below.
      </Typography>

      {erasureMsg && <Alert severity="success" sx={{ mb: 2 }}>{erasureMsg}</Alert>}

      <Stack spacing={2}>
        <Card>
          <CardContent>
            <Typography variant="h6"><Download sx={{ verticalAlign: 'middle', mr: 1 }} />Export my data</Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>
              Download everything we hold about you — profile, attendance, location history, tasks, expenses,
              orders, messages, and consent log — as a single JSON file.
            </Typography>
            <Button variant="contained" onClick={exportData}>Download my data</Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6"><History sx={{ verticalAlign: 'middle', mr: 1 }} />Consent history</Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>
              Every consent you've granted or withdrawn, with the policy version and timestamp.
            </Typography>
            <Stack spacing={1}>
              {consents.length === 0 && (
                <Typography variant="body2" color="text.secondary">No consent records yet.</Typography>
              )}
              {consents.map((c) => (
                <Box key={c.id} sx={{ p: 1.5, borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center' }}>
                  <Chip
                    label={c.granted ? 'GRANTED' : 'WITHDRAWN'}
                    color={c.granted ? 'success' : 'default'}
                    size="small" sx={{ mr: 2 }}
                  />
                  <Box flexGrow={1}>
                    <Typography variant="body2"><strong>{c.type}</strong> · {c.purpose || '—'}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Policy v{c.policyVersion || '?'} · {new Date(c.createdAt).toLocaleString()}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{ borderLeft: 4, borderColor: 'error.main' }}>
          <CardContent>
            <Typography variant="h6" color="error">
              <DeleteForever sx={{ verticalAlign: 'middle', mr: 1 }} />Request data erasure
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>
              Your account will be anonymized immediately. Biometric face data and raw location pings
              are deleted at once. Aggregated records (e.g. payroll totals) are retained for 13 months
              for legal compliance, then permanently purged.
            </Typography>
            <Button variant="outlined" color="error" onClick={() => setErasureOpen(true)}>
              Request erasure
            </Button>
          </CardContent>
        </Card>
      </Stack>

      <Dialog open={erasureOpen} onClose={() => setErasureOpen(false)}>
        <DialogTitle>Confirm erasure request</DialogTitle>
        <DialogContent>
          <Typography variant="body2" mb={2}>
            This will sign you out of all devices and anonymize your account. This is irreversible.
          </Typography>
          <TextField
            fullWidth multiline minRows={2}
            label="Reason (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setErasureOpen(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={submitErasure}>I understand, erase my data</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
