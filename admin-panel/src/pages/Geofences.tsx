import { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Stack, Button, TextField, MenuItem,
  IconButton, List, ListItem, ListItemText, Chip
} from '@mui/material';
import { Delete, AddLocation } from '@mui/icons-material';
import { GoogleMap, Marker, Circle, useLoadScript } from '@react-google-maps/api';
import { api } from '../services/api';

type Fence = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusM: number;
  type: string;
};

const TYPES = [
  { value: 'office', label: 'Office' },
  { value: 'client', label: 'Client site' },
  { value: 'restricted', label: 'Restricted zone' },
];

export default function Geofences() {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: (import.meta as any).env.VITE_GOOGLE_MAPS_KEY || '',
  });
  const [fences, setFences] = useState<Fence[]>([]);
  const [draft, setDraft] = useState<{ lat: number; lng: number } | null>(null);
  const [name, setName] = useState('');
  const [radius, setRadius] = useState(200);
  const [type, setType] = useState('office');

  const load = () => api.get('/geofences').then((r) => setFences(r.data));
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!draft || !name) return;
    await api.post('/geofences', { name, lat: draft.lat, lng: draft.lng, radiusM: radius, type });
    setDraft(null); setName('');
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this geofence?')) return;
    await api.delete(`/geofences/${id}`);
    load();
  };

  const center = fences[0] ? { lat: fences[0].lat, lng: fences[0].lng } : { lat: 28.6139, lng: 77.209 };

  return (
    <Box>
      <Typography variant="h4" mb={2}>Geofences</Typography>
      <Stack direction="row" spacing={2}>
        <Card sx={{ flexBasis: 320, flexShrink: 0 }}>
          <CardContent>
            <Typography variant="subtitle2" mb={1}>
              Click on the map to place a new fence
            </Typography>
            <Stack spacing={1.5}>
              <TextField
                size="small" fullWidth label="Name"
                value={name} onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Mumbai HQ"
              />
              <TextField
                size="small" fullWidth label="Radius (meters)"
                type="number" value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
              />
              <TextField
                size="small" fullWidth select label="Type"
                value={type} onChange={(e) => setType(e.target.value)}
              >
                {TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
              </TextField>
              <Typography variant="caption" color="text.secondary">
                {draft ? `📍 ${draft.lat.toFixed(5)}, ${draft.lng.toFixed(5)}` : 'No point selected'}
              </Typography>
              <Button
                variant="contained" startIcon={<AddLocation />}
                disabled={!draft || !name} onClick={save}
              >
                Save fence
              </Button>
            </Stack>

            <Typography variant="subtitle2" mt={3} mb={1}>Existing ({fences.length})</Typography>
            <List dense disablePadding>
              {fences.map((f) => (
                <ListItem
                  key={f.id} disableGutters
                  secondaryAction={
                    <IconButton size="small" onClick={() => remove(f.id)}><Delete fontSize="small" /></IconButton>
                  }
                >
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <span>{f.name}</span>
                        <Chip size="small" label={f.type} />
                      </Stack>
                    }
                    secondary={`${f.radiusM}m radius`}
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>

        <Card sx={{ flexGrow: 1, height: '75vh' }}>
          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              center={center}
              zoom={12}
              onClick={(e) => {
                if (e.latLng) setDraft({ lat: e.latLng.lat(), lng: e.latLng.lng() });
              }}
            >
              {fences.map((f) => (
                <Circle
                  key={f.id}
                  center={{ lat: f.lat, lng: f.lng }}
                  radius={f.radiusM}
                  options={{
                    fillColor: f.type === 'restricted' ? '#ef4444' : '#2563eb',
                    fillOpacity: 0.18,
                    strokeColor: f.type === 'restricted' ? '#dc2626' : '#1d4ed8',
                    strokeOpacity: 0.8,
                    strokeWeight: 2,
                  }}
                />
              ))}
              {draft && (
                <>
                  <Marker position={draft} />
                  <Circle
                    center={draft}
                    radius={radius}
                    options={{ fillColor: '#16a34a', fillOpacity: 0.2, strokeColor: '#16a34a' }}
                  />
                </>
              )}
            </GoogleMap>
          ) : (
            <Box p={4}>Loading Google Maps…</Box>
          )}
        </Card>
      </Stack>
    </Box>
  );
}
