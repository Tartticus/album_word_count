import React, { useState } from 'react';
import { Search, BarChart3, Loader2 } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface Album {
  name: string;
  id: string;
  images: { url: string }[];
}

interface WordCount {
  artist: string;
  album: string;
  word: string;
  count: number;
  albumArt: string;
}

async function getSpotifyToken() {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa('56d3b4e5526845a09849a6757a0e7089:4d6a6149f01240d589f2b9f7738a5159')}`,
    },
    body: 'grant_type=client_credentials',
  });

  const data = await response.json();
  return data.access_token;
}

function App() {
  const [artist, setArtist] = useState('');
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [word, setWord] = useState('');
  const [wordCounts, setWordCounts] = useState<WordCount[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [countLoading, setCountLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  const searchArtist = async () => {
    setSearchLoading(true);
    setError('');
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-artist`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ artist }),
        }
      );

      if (!response.ok) throw new Error('Artist search failed');
      
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      
      setAlbums(data.albums.filter((album: Album) => album.images?.length > 0));
      setSelectedAlbum(null);
      setWord('');
      setWordCounts([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to find artist');
    } finally {
      setSearchLoading(false);
    }
  };

  const countWord = async () => {
    if (!selectedAlbum || !word) return;
    
    setCountLoading(selectedAlbum.id);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/count-word`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            artist,
            albumId: selectedAlbum.id,
            word,
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to count words');
      
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      setWordCounts(prev => [...prev, {
        artist,
        album: selectedAlbum.name,
        word,
        count: data.count,
        albumArt: selectedAlbum.images[0]?.url
      }]);
    } catch (err) {
      setError('Failed to count words');
    } finally {
      setCountLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-purple-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center">Lyrics Word Counter</h1>
        
        <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6 mb-8">
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <input
                type="text"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="Enter artist name..."
                className="w-full px-4 py-2 rounded bg-white/20 border border-white/30 focus:outline-none focus:border-white"
              />
            </div>
            <button
              onClick={searchArtist}
              disabled={searchLoading}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 rounded flex items-center gap-2 disabled:opacity-50"
            >
              {searchLoading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Search size={20} />
              )}
              {searchLoading ? 'Searching...' : 'Search'}
            </button>
          </div>

          {albums.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {albums.map(album => (
                <div key={album.id} className="space-y-2">
                  <div
                    onClick={() => setSelectedAlbum(album)}
                    className={`relative cursor-pointer rounded-lg overflow-hidden transition-all ${
                      selectedAlbum?.id === album.id ? 'ring-2 ring-white scale-105' : 'hover:scale-105'
                    }`}
                  >
                    <img
                      src={album.images[0]?.url}
                      alt={album.name}
                      className="w-full aspect-square object-cover"
                    />
                    <div className="p-2 bg-black/50 text-sm truncate">
                      {album.name}
                    </div>
                  </div>

                  {selectedAlbum?.id === album.id && (
                    <div className="bg-black/50 backdrop-blur-sm rounded-lg p-3 space-y-3 animate-fade-in">
                      <input
                        type="text"
                        value={word}
                        onChange={(e) => setWord(e.target.value)}
                        placeholder="Enter word to count..."
                        className="w-full px-3 py-2 rounded bg-white/20 border border-white/30 focus:outline-none focus:border-white text-sm"
                      />
                      <button
                        onClick={countWord}
                        disabled={countLoading === album.id || !word}
                        className="w-full px-3 py-2 bg-indigo-600 hover:bg-indigo-700 rounded flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
                      >
                        {countLoading === album.id ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            Counting...
                          </>
                        ) : (
                          <>
                            <BarChart3 size={16} />
                            Count Word
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {wordCounts.filter(wc => wc.album === album.name).length > 0 && (
                    <div className="h-[200px] bg-black/30 rounded-lg p-3">
                      <Bar
                        data={{
                          labels: wordCounts
                            .filter(wc => wc.album === album.name)
                            .map(wc => wc.word),
                          datasets: [{
                            label: 'Word Count',
                            data: wordCounts
                              .filter(wc => wc.album === album.name)
                              .map(wc => wc.count),
                            backgroundColor: 'rgba(99, 102, 241, 0.6)',
                            borderColor: 'rgba(99, 102, 241, 1)',
                            borderWidth: 1,
                          }],
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          scales: {
                            y: {
                              beginAtZero: true,
                              ticks: { color: 'white' }
                            },
                            x: {
                              ticks: { color: 'white' }
                            }
                          },
                          plugins: {
                            legend: {
                              labels: { color: 'white' }
                            }
                          }
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-500/50 text-white p-4 rounded-lg mt-4">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
