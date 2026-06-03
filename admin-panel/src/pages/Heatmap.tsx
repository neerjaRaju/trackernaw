import { useEffect, useMemo, useState } from 'react';
import { Box, Card, Typography, ToggleButton, ToggleButtonGroup, Stack } from '@mui/material';
import { GoogleMap, HeatmapLayer, useLoadScript } from '@react-google-maps/api';
import { api } from '../services/api';

const libs: ('visualization')[] = ['visualization'];

export default function Heatmap() {
  const [days, setDays] = useState(30);
  const [points, setPoints] = useState<{ lat: number; lng: number; weight: number }[]>([]);
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: (import.meta as any).env.VITE_GOOGLE_MAPS_KEY || '',
    libraries: libs,
  });

  useEffect(() => {
    api.get(`/dashboard/heatmap?days=${days}`).then((r) => setPoints(r.data)).catch(() => {});
  }, [days]);

  const data = useMemo(() => {
    if (!isLoaded || !window.google) return [];
    return points.map((p) => ({
      location: new google.maps.LatLng(p.lat, p.lng),
      weight: p.weight,
    }));
  }, [points, isLoaded]);

  const center = points[0] ? { lat: points[0].lat, lng: points[0].lng } : { lat: 28.6139, lng: 77.209 };
  const totalPings = points.reduce((s, p) => s + p.weight, 0);

  return (
    <Box>
      <Stack direction="row" alignItems="center" mb={2} spacing={2}>
        <Typography variant="h4" sx={{ flexGrow: 1 }}>Activity Heatmap</Typography>
        <ToggleButtonGroup
          size="small"
          value={days}
          exclusive
          onChange={(_, v) => v && setDays(v)}
        >
          <ToggleButton value={7}>7d</ToggleButton>
          <ToggleButton value={30}>30d</ToggleButton>
          <ToggleButton value={90}>90d</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      <Card sx={{ p: 1.5, mb: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {points.length.toLocaleString()} grid cells · {totalPings.toLocaleString()} pings over last {days} days
        </Typography>
      </Card>

      <Card sx={{ height: '70vh' }}>
        {isLoaded ? (
          <GoogleMap mapContainerStyle={{ width: '100%', height: '100%' }} center={center} zoom={11}>
            <HeatmapLayer data={data} options={{ radius: 25, opacity: 0.7 }} />
          </GoogleMap>
        ) : (
          <Box p={4}>Loading Google Maps… (set VITE_GOOGLE_MAPS_KEY in admin-panel/.env)</Box>
        )}
      </Card>
    </Box>
  );
}
