import React, { useState, useEffect } from 'react';
import { Search, Music, BarChart3 } from 'lucide-react';
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

function App() {
  const [artist, setArtist] = useState('');
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [word, setWord] = useState('');
  const [wordCounts, setWordCounts] = useState<WordCount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const searchArtist = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-artist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ artist })
      });
      
      if (!response.ok) throw new Error('Artist not found');
      
      const data = await response.json();
      setAlbums(data.albums);
    } catch (err) {
      setError('Failed to find artist');
    } finally {
      setLoading(false);
    }
  };

  const countWord = async () => {
    if (!selectedAlbum || !word) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/count-word`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          artist,
          albumId: selectedAlbum.id,
          word
        })
      });
      
      if (!response.ok) throw new Error('Failed to count words');
      
      const data = await response.json();
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
      setLoading(false);
    }
  };

  const chartData = {
    labels: wordCounts.map(wc => wc.album),
    datasets: [
      {
        label: 'Word Count',
        data: wordCounts.map(wc => wc.count),
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1,
      },
    ],
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-purple-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center">Lyrics Word Counter</h1>
        
        {/* Search Section */}
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
              disabled={loading}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 rounded flex items-center gap-2 disabled:opacity-50"
            >
              <Search size={20} />
              Search
            </button>
          </div>

          {/* Albums Grid */}
          {albums.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {albums.map(album => (
                <div
                  key={album.id}
                  onClick={() => setSelectedAlbum(album)}
                  className={`cursor-pointer rounded-lg overflow-hidden transition-transform hover:scale-105 ${
                    selectedAlbum?.id === album.id ? 'ring-2 ring-white' : ''
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
              ))}
            </div>
          )}
        </div>

        {/* Word Count Section */}
        {selectedAlbum && (
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6 mb-8">
            <div className="flex gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  value={word}
                  onChange={(e) => setWord(e.target.value)}
                  placeholder="Enter word to count..."
                  className="w-full px-4 py-2 rounded bg-white/20 border border-white/30 focus:outline-none focus:border-white"
                />
              </div>
              <button
                onClick={countWord}
                disabled={loading || !word}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 rounded flex items-center gap-2 disabled:opacity-50"
              >
                <BarChart3 size={20} />
                Count
              </button>
            </div>
          </div>
        )}

        {/* Results Chart */}
        {wordCounts.length > 0 && (
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-4">Results</h2>
            <div className="h-[400px]">
              <Bar
                data={chartData}
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
          </div>
        )}

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