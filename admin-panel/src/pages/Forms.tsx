import { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Stack, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Chip
} from '@mui/material';
import { Add, ListAlt } from '@mui/icons-material';
import { api } from '../services/api';

const EXAMPLE = JSON.stringify([
  { id: 'owner_present', label: 'Owner present?', type: 'boolean', required: true },
  { id: 'property_age', label: 'Property age (years)', type: 'number', required: true, min: 0 },
  { id: 'condition', label: 'Overall condition', type: 'select', options: ['Excellent','Good','Average','Poor'] },
  { id: 'photos', label: 'Site photos', type: 'photos', min: 2, max: 6 },
  { id: 'remarks', label: 'Remarks', type: 'text', multiline: true },
], null, 2);

export default function Forms() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [schema, setSchema] = useState(EXAMPLE);
  const [err, setErr] = useState('');

  const load = async () => {
    const [t, s] = await Promise.all([
      api.get('/forms/templates?activeOnly=false'),
      api.get('/forms/submissions'),
    ]);
    setTemplates(t.data); setSubmissions(s.data);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setErr('');
    try {
      const parsed = JSON.parse(schema);
      await api.post('/forms/templates', { key, name, schema: parsed });
      setOpen(false); setName(''); setKey(''); setSchema(EXAMPLE);
      load();
    } catch (e: any) {
      setErr(e.response?.data?.error || e.message);
    }
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" mb={2}>
        <Typography variant="h4" sx={{ flexGrow: 1 }}>Dynamic Forms</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)}>New template</Button>
      </Stack>

      <Stack direction="row" spacing={2}>
        <Card sx={{ flexBasis: 360 }}>
          <CardContent>
            <Typography variant="h6" mb={1}>Templates ({templates.length})</Typography>
            {templates.map((t) => (
              <Box key={t.id} sx={{ p: 1.5, borderBottom: '1px solid #eee' }}>
                <Stack direction="row" alignItems="center">
                  <Box flexGrow={1}>
                    <Typography variant="subtitle2">{t.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t.key} · v{t.version} · {t.schema.length} fields
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    label={t.isActive ? 'Active' : 'Inactive'}
                    color={t.isActive ? 'success' : 'default'}
                  />
                </Stack>
              </Box>
            ))}
            {templates.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No templates yet — create one to capture custom fields per case type.
              </Typography>
            )}
          </CardContent>
        </Card>

        <Card sx={{ flexGrow: 1 }}>
          <CardContent>
            <Typography variant="h6" mb={1}><ListAlt sx={{ verticalAlign: 'middle', mr: 1 }} />Recent submissions ({submissions.length})</Typography>
            <Stack spacing={1}>
              {submissions.map((s) => (
                <Box key={s.id} sx={{ p: 1.5, borderBottom: '1px solid #eee' }}>
                  <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
                    <Typography variant="subtitle2">{s.template.name}</Typography>
                    <Chip size="small" label={`v${s.template.version}`} />
                    {s.refId && <Chip size="small" label={`Ref: ${s.refId}`} color="info" />}
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(s.capturedAt).toLocaleString()} · {s.lat?.toFixed(4)}, {s.lng?.toFixed(4)}
                  </Typography>
                  <Box sx={{ mt: 0.5, fontFamily: 'monospace', fontSize: 12, color: '#555' }}>
                    {Object.entries(s.data).slice(0, 4).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('  ·  ')}
                    {Object.keys(s.data).length > 4 && '  · …'}
                  </Box>
                </Box>
              ))}
              {submissions.length === 0 && (
                <Typography variant="body2" color="text.secondary">No submissions yet.</Typography>
              )}
            </Stack>
          </CardContent>
        </Card>
      </Stack>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>New form template</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
            <TextField
              label="Key (stable identifier)"
              value={key} onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
              fullWidth helperText="e.g. property_valuation, collections_visit"
            />
            <TextField
              label="Schema (JSON array of fields)"
              value={schema} onChange={(e) => setSchema(e.target.value)}
              multiline minRows={12} fullWidth
              InputProps={{ sx: { fontFamily: 'monospace', fontSize: 12 } }}
              helperText="Supported types: text, number, date, boolean, select, multiselect, photos, signature"
            />
            {err && <Typography color="error" variant="body2">{err}</Typography>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={save}>Save template</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
