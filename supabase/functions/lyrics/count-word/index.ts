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

async function getLyrics(artist: string, track: string) {
  // Search for the song on Genius
  const searchResponse = await fetch(
    `https://api.genius.com/search?q=${encodeURIComponent(`${artist} ${track}`)}`,
    {
      headers: {
        'Authorization': `Bearer ${GENIUS_API_TOKEN}`,
      },
    }
  );

  const searchData = await searchResponse.json();
  const songUrl = searchData.response.hits[0]?.result.url;

  if (!songUrl) return '';

  // Fetch the lyrics page
  const pageResponse = await fetch(songUrl);
  const html = await pageResponse.text();

  // Extract lyrics from the HTML (simplified version)
  const lyricsMatch = html.match(/<div[^>]*class="[^"]*Lyrics__Container[^"]*"[^>]*>([\s\S]*?)<\/div>/);
  return lyricsMatch ? lyricsMatch[1].replace(/<[^>]*>/g, '') : '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { artist, albumId, word } = await req.json();
    const token = await getSpotifyToken();

    // Get album tracks
    const tracksResponse = await fetch(
      `https://api.spotify.com/v1/albums/${albumId}/tracks`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    const tracksData = await tracksResponse.json();
    let totalCount = 0;

    // Count word occurrences in each track's lyrics
    for (const track of tracksData.items) {
      const lyrics = await getLyrics(artist, track.name);
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = lyrics.match(regex);
      if (matches) {
        totalCount += matches.length;
      }
    }

    return new Response(
      JSON.stringify({ count: totalCount }),
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