import { createClient } from 'npm:@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SPOTIFY_CLIENT_ID = '56d3b4e5526845a09849a6757a0e7089';
const SPOTIFY_CLIENT_SECRET = '4d6a6149f01240d589f2b9f7738a5159';
const GENIUS_API_TOKEN = 'BLtzK4rzDYkeUgeYEH4hDpagB08odDYmU45WXH715AvhEMs8IT42hlqdmGJM8JyL';
async function getSpotifyToken() {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`)}`,
    },
    body: 'grant_type=client_credentials',
  });

  const data = await response.json();
  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { artist } = await req.json();
    const token = await getSpotifyToken();

    const searchResponse = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(artist)}&type=artist`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    const searchData = await searchResponse.json();
    const artistId = searchData.artists.items[0]?.id;

    if (!artistId) {
      return new Response(
        JSON.stringify({ error: 'Artist not found' }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const albumsResponse = await fetch(
      `https://api.spotify.com/v1/artists/${artistId}/albums`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    const albumsData = await albumsResponse.json();

    return new Response(
      JSON.stringify({ albums: albumsData.items }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});