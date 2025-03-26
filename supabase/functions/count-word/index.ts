import { createClient } from 'npm:@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SPOTIFY_CLIENT_ID = '56d3b4e5526845a09849a6757a0e7089';
const SPOTIFY_CLIENT_SECRET = '4d6a6149f01240d589f2b9f7738a5159';
const GENIUS_API_TOKEN = 'BLtzK4rzDYkeUgeYEH4hDpagB08odDYmU45WXH715AvhEMs8IT42hlqdmGJM8JyL';

// Get Spotify token (unchanged)
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

// Fetch lyrics from Genius
async function getLyrics(artist, track) {
  try {
    const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(`${artist} ${track}`)}`;
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${GENIUS_API_TOKEN}`,
      },
    });

    if (!searchResponse.ok) {
      throw new Error(`Genius search failed: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();
    const song = searchData.response.hits[0]?.result;

    if (!song) {
      return "No lyrics found for this track.";
    }

    const songUrl = song.url;
    return `Lyrics can be found at: ${songUrl}`; // For now, returning URL
  } catch (error) {
    console.error('Error fetching lyrics:', error);
    return 'Failed to retrieve lyrics.';
  }
}

// Function to count words in a string
function countWords(text) {
  if (!text || typeof text !== 'string') {
    console.error("Invalid input: text must be a non-empty string");
    return 0;
  }

  // Split by whitespace and filter out empty strings
  const words = text.trim().split(/\s+/).filter(word => word.length > 0);
  return words.length;
}