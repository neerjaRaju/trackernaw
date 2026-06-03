import { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Stack, TextField, MenuItem, Chip
} from '@mui/material';
import { GoogleMap, Marker, Polyline, useLoadScript } from '@react-google-maps/api';
import { api } from '../services/api';

type Point = { lat: number; lng: number; recordedAt: string; speed?: number };
type Stop = { lat: number; lng: number; startedAt: string; endedAt: string; durationMin: number; pings: number };
type User = { id: string; fullName: string };

function todayISO() { return new Date().toISOString().slice(0, 10); }

export default function RoutesPage() {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: (import.meta as any).env.VITE_GOOGLE_MAPS_KEY || '',
  });
  const [users, setUsers] = useState<User[]>([]);
  const [userId, setUserId] = useState('');
  const [day, setDay] = useState(todayISO());
  const [data, setData] = useState<{ points: Point[]; stops: Stop[]; distanceKm: number } | null>(null);

  useEffect(() => {
    api.get('/users').then((r) => {
      setUsers(r.data);
      if (r.data[0] && !userId) setUserId(r.data[0].id);
    });
  }, []);

  useEffect(() => {
    if (!userId) return;
    api.get(`/location/route/${userId}?day=${day}`).then((r) => setData(r.data)).catch(() => setData(null));
  }, [userId, day]);

  const path = (data?.points || []).map((p) => ({ lat: p.lat, lng: p.lng }));
  const center = path[0] || { lat: 28.6139, lng: 77.209 };

  return (
    <Box>
      <Typography variant="h4" mb={2}>Routes &amp; Stops</Typography>
      <Card sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField
            select size="small" label="Employee" value={userId}
            onChange={(e) => setUserId(e.target.value)} sx={{ minWidth: 240 }}
          >
            {users.map((u) => <MenuItem key={u.id} value={u.id}>{u.fullName}</MenuItem>)}
          </TextField>
          <TextField
            type="date" size="small" label="Date" value={day}
            onChange={(e) => setDay(e.target.value)} InputLabelProps={{ shrink: true }}
          />
          {data && (
            <Stack direction="row" spacing={1}>
              <Chip label={`${data.distanceKm} km`} color="primary" />
              <Chip label={`${data.points.length} pings`} />
              <Chip label={`${data.stops.length} stops`} color="warning" />
            </Stack>
          )}
        </Stack>
      </Card>

      <Stack direction="row" spacing={2}>
        <Card sx={{ flexGrow: 1, height: '70vh' }}>
          {isLoaded ? (
            <GoogleMap mapContainerStyle={{ width: '100%', height: '100%' }} center={center} zoom={12}>
              {path.length > 1 && (
                <Polyline
                  path={path}
                  options={{ strokeColor: '#2563eb', strokeWeight: 4, strokeOpacity: 0.8 }}
                />
              )}
              {path[0] && <Marker position={path[0]} label="A" />}
              {path[path.length - 1] && path.length > 1 && (
                <Marker position={path[path.length - 1]} label="B" />
              )}
              {(data?.stops || []).map((s, i) => (
                <Marker
                  key={i}
                  position={{ lat: s.lat, lng: s.lng }}
                  label={{ text: String(s.durationMin), color: 'white', fontSize: '11px' }}
                  icon={{
                    path: window.google?.maps.SymbolPath.CIRCLE,
                    scale: 14,
                    fillColor: '#f59e0b',
                    fillOpacity: 1,
                    strokeColor: '#b45309',
                    strokeWeight: 2,
                  }}
                />
              ))}
            </GoogleMap>
          ) : (
            <Box p={4}>Loading Google Maps…</Box>
          )}
        </Card>

        <Card sx={{ flexBasis: 320, flexShrink: 0, height: '70vh', overflow: 'auto' }}>
          <CardContent>
            <Typography variant="h6" mb={1}>Stops ({data?.stops.length || 0})</Typography>
            {!data?.stops.length && (
              <Typography variant="body2" color="text.secondary">No stops ≥ 5 min for this day.</Typography>
            )}
            {(data?.stops || []).map((s, i) => (
              <Box key={i} sx={{ mb: 2, pb: 1.5, borderBottom: '1px solid #eee' }}>
                <Typography variant="subtitle2">
                  Stop {i + 1} · {s.durationMin} min
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {new Date(s.startedAt).toLocaleTimeString()} → {new Date(s.endedAt).toLocaleTimeString()}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {s.lat.toFixed(5)}, {s.lng.toFixed(5)} · {s.pings} pings
                </Typography>
              </Box>
            ))}
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
