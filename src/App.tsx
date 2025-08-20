import React, { useState, useRef } from 'react';
import { Search, BarChart3, Loader2, LineChart, Plus, X, Download } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { toPng } from 'html-to-image';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
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


// Generate a different color for each word
const generateColor = (index: number) => {
  const colors = [
    'rgb(99, 102, 241)', // indigo
    'rgb(239, 68, 68)', // red
    'rgb(34, 197, 94)', // green
    'rgb(234, 179, 8)', // yellow
    'rgb(168, 85, 247)', // purple
    'rgb(14, 165, 233)', // sky
  ];
  return colors[index % colors.length];
};

function App() {
  const [artist, setArtist] = useState('');
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedAlbums, setSelectedAlbums] = useState<Album[]>([]);
  const [words, setWords] = useState<string[]>([]);
  const [newWord, setNewWord] = useState('');
  const [wordCounts, setWordCounts] = useState<WordCount[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [countLoading, setCountLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showResults, setShowResults] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  const searchArtist = async () => {
    setSearchLoading(true);
    setError('');
    try {
      const response = await fetch(
        `http://localhost:5000/albums`,
        {
          method: 'POST',
          headers: {
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
      setSelectedAlbums([]);
      setWords([]);
      setWordCounts([]);
      setShowResults(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to find artist');
    } finally {
      setSearchLoading(false);
    }
  };

const getLyrics = async (artist: string, track: string) => {
    try {
      const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(`${artist} ${track}`)}`;
      const searchResponse = await fetch(searchUrl, {
        headers: {
          'Authorization': `Bearer BLtzK4rzDYkeUgeYEH4hDpagB08odDYmU45WXH715AvhEMs8IT42hlqdmGJM8JyL`,
        },
      });

      if (!searchResponse.ok) {
        return '';
      }

      const searchData = await searchResponse.json();
      const songUrl = searchData.response.hits[0]?.result.url;

      if (!songUrl) return '';

      const pageResponse = await fetch(songUrl);
      const html = await pageResponse.text();
      const lyricsMatch = html.match(/<div[^>]*class="[^"]*Lyrics__Container[^"]*"[^>]*>([\s\S]*?)<\/div>/);
      return lyricsMatch ? lyricsMatch[1].replace(/<[^>]*>/g, '') : '';
    } catch (error) {
      console.error('Error fetching lyrics:', error);
      return '';
    }
  };


  const addWord = () => {
    if (newWord && words.length < 6 && !words.includes(newWord)) {
      setWords([...words, newWord]);
      setNewWord('');
    }
  };

  const getSpotifyToken = async () => {
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
  };



  const removeWord = (wordToRemove: string) => {
    setWords(words.filter(w => w !== wordToRemove));
    setWordCounts(wordCounts.filter(wc => wc.word !== wordToRemove));
  };

  const toggleAlbum = (album: Album) => {
    if (selectedAlbums.find(a => a.id === album.id)) {
      setSelectedAlbums(selectedAlbums.filter(a => a.id !== album.id));
      setWordCounts(wordCounts.filter(wc => wc.album !== album.name));
    } else if (selectedAlbums.length < 6) {
      setSelectedAlbums([...selectedAlbums, album]);
    }
  };

  const countWords = async () => {
    if (selectedAlbums.length === 0 || words.length === 0) return;
    
    setShowResults(true);
    const newCounts: WordCount[] = [];
    
    for (const album of selectedAlbums) {
      for (const word of words) {
        setCountLoading(album.id);
        try {
          const response = await fetch(
            `http://localhost:5000/count-word`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                artist,
                albumId: album.id,
                albumName: album.name,
                word,
              }),
            }
          );
          
          if (!response.ok) throw new Error('Failed to count words');
          
          const data = await response.json();
          if (data.error) {
            throw new Error(data.error);
          }

          newCounts.push({
            artist,
            album: album.name,
            word,
            count: data.count,
            albumArt: album.images[0]?.url
          });
        } catch (err) {
          setError('Failed to count words');
        }
      }
    }
    setWordCounts(newCounts);
    setCountLoading(null);
  };

  const downloadChart = async () => {
    if (!chartRef.current) return;
    
    try {
      const dataUrl = await toPng(chartRef.current, {
        backgroundColor: '#1e1b4b', // dark indigo background
      });
      
      const link = document.createElement('a');
      link.download = `${artist}-word-count.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to download chart:', err);
    }
  };

  const chartData = {
    labels: selectedAlbums.map(album => album.name),
    datasets: words.map((word, index) => ({
      label: word,
      data: selectedAlbums.map(album => 
        wordCounts.find(wc => wc.album === album.name && wc.word === word)?.count || 0
      ),
      borderColor: generateColor(index),
      backgroundColor: generateColor(index),
      tension: 0.4,
    })),
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
        ticks: { 
          color: 'white',
          font: {
            size: 12,
          },
        },
      },
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
        ticks: { 
          color: 'white',
          font: {
            size: 12,
          },
        },
      },
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: 'white',
          font: {
            size: 14,
          },
          padding: 20,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
      },
    },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-purple-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center">Lyrics Word Counter</h1>
        
        <div className="flex gap-8">
          <div className="flex-1">
            <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6 mb-8">
              {/* Word Search Input */}
              <div className="mb-6">
                <div className="flex gap-4 mb-4">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={newWord}
                      onChange={(e) => setNewWord(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addWord()}
                      placeholder="Enter word to count..."
                      className="w-full px-4 py-2 rounded bg-white/20 border border-white/30 focus:outline-none focus:border-white"
                    />
                  </div>
                  <button
                    onClick={addWord}
                    disabled={!newWord || words.length >= 6}
                    className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded flex items-center gap-2 disabled:opacity-50"
                  >
                    <Plus size={20} />
                    Add Word
                  </button>
                </div>
                
                {words.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {words.map((word, index) => (
                      <div
                        key={word}
                        className="px-3 py-1 rounded-full flex items-center gap-2"
                        style={{ backgroundColor: generateColor(index) }}
                      >
                        <span>{word}</span>
                        <button
                          onClick={() => removeWord(word)}
                          className="hover:text-red-400"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Artist Search */}
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

              {/* Albums Grid */}
              {albums.length > 0 && !showResults && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {albums.map(album => (
                    <div
                      key={album.id}
                      onClick={() => toggleAlbum(album)}
                      className={`relative cursor-pointer rounded-lg overflow-hidden transition-all ${
                        selectedAlbums.find(a => a.id === album.id)
                          ? 'ring-2 ring-white scale-105'
                          : 'hover:scale-105'
                      }`}
                    >
                      <img
                        src={album.images[0]?.url}
                        alt={album.name}
                        className="w-full aspect-square object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end">
                        <div className="p-3 text-sm">
                          {album.name}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Results Chart */}
              {showResults && wordCounts.length > 0 && (
                <div className="space-y-6">
                  <div ref={chartRef} className="bg-indigo-950 rounded-lg p-6">
                    <div className="h-[400px]">
                      <Line data={chartData} options={chartOptions} />
                    </div>
                    <div className="flex justify-center gap-4 mt-6">
                      {selectedAlbums.map(album => (
                        <img
                          key={album.id}
                          src={album.images[0]?.url}
                          alt={album.name}
                          className="w-16 h-16 rounded-lg object-cover"
                          title={album.name}
                        />
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={downloadChart}
                    className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 rounded flex items-center justify-center gap-2"
                  >
                    <Download size={20} />
                    Download Chart
                  </button>
                  <button
                    onClick={() => setShowResults(false)}
                    className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded"
                  >
                    Back to Albums
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Selected Albums */}
          <div className="w-96">
            <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Selected Albums ({selectedAlbums.length}/6)</h2>
              <div className="space-y-3">
                {selectedAlbums.map(album => (
                  <div key={album.id} className="flex items-center gap-3 bg-black/30 rounded-lg p-2">
                    <img
                      src={album.images[0]?.url}
                      alt={album.name}
                      className="w-12 h-12 rounded object-cover"
                    />
                    <div className="flex-1 truncate">{album.name}</div>
                    <button
                      onClick={() => toggleAlbum(album)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <X size={20} />
                    </button>
                  </div>
                ))}
              </div>

              {selectedAlbums.length > 0 && words.length > 0 && !showResults && (
                <button
                  onClick={countWords}
                  disabled={countLoading !== null}
                  className="w-full mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {countLoading !== null ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      Counting...
                    </>
                  ) : (
                    <>
                      <LineChart size={20} />
                      Generate Chart
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
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