import React, { useState, useRef } from 'react';
import { Search, BarChart3, Loader2, LineChart, Plus, X, Download, Palette, Play } from 'lucide-react';
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


// Predefined color options
const colorOptions = [
  'rgb(34, 197, 94)', // green (default)
  'rgb(99, 102, 241)', // indigo
  'rgb(239, 68, 68)', // red
  'rgb(234, 179, 8)', // yellow
  'rgb(168, 85, 247)', // purple
  'rgb(14, 165, 233)', // sky
  'rgb(236, 72, 153)', // pink
  'rgb(245, 101, 101)', // rose
  'rgb(52, 211, 153)', // emerald
  'rgb(251, 146, 60)', // orange
  'rgb(139, 69, 19)', // brown
  'rgb(75, 85, 99)', // gray
  'rgb(219, 39, 119)', // hot pink
  'rgb(16, 185, 129)', // teal
  'rgb(245, 158, 11)', // amber
  'rgb(124, 58, 237)', // violet
  'rgb(59, 130, 246)', // blue
  'rgb(239, 68, 68)', // red-500
  'rgb(6, 182, 212)', // cyan
  'rgb(132, 204, 22)', // lime
  'rgb(244, 63, 94)', // rose-500
  'rgb(168, 162, 158)', // stone
  'rgb(20, 184, 166)', // teal-500
  'rgb(217, 119, 6)', // orange-600
];

// Background gradient options
const backgroundOptions = [
  { gradient: 'bg-gradient-to-br from-green-900 to-emerald-900', color: 'bg-green-600' },
  { gradient: 'bg-gradient-to-br from-indigo-900 to-purple-900', color: 'bg-indigo-600' },
  { gradient: 'bg-gradient-to-br from-blue-900 to-cyan-900', color: 'bg-blue-600' },
  { gradient: 'bg-gradient-to-br from-purple-900 to-pink-900', color: 'bg-purple-600' },
  { gradient: 'bg-gradient-to-br from-emerald-900 to-teal-900', color: 'bg-emerald-600' },
  { gradient: 'bg-gradient-to-br from-red-900 to-orange-900', color: 'bg-red-600' },
  { gradient: 'bg-gradient-to-br from-gray-900 to-slate-900', color: 'bg-gray-600' },
  { gradient: 'bg-gradient-to-br from-yellow-900 to-orange-900', color: 'bg-yellow-600' },
  { gradient: 'bg-gradient-to-br from-pink-900 to-rose-900', color: 'bg-pink-600' },
  { gradient: 'bg-gradient-to-br from-violet-900 to-purple-900', color: 'bg-violet-600' },
  { gradient: 'bg-gradient-to-br from-cyan-900 to-blue-900', color: 'bg-cyan-600' },
  { gradient: 'bg-gradient-to-br from-lime-900 to-green-900', color: 'bg-lime-600' },
  { gradient: 'bg-gradient-to-br from-amber-900 to-yellow-900', color: 'bg-amber-600' },
  { gradient: 'bg-gradient-to-br from-rose-900 to-pink-900', color: 'bg-rose-600' },
  { gradient: 'bg-gradient-to-br from-teal-900 to-cyan-900', color: 'bg-teal-600' },
  { gradient: 'bg-gradient-to-br from-stone-900 to-gray-900', color: 'bg-stone-600' },
  { gradient: 'bg-gradient-to-br from-slate-900 to-zinc-900', color: 'bg-slate-600' },
  { gradient: 'bg-gradient-to-br from-orange-900 to-red-900', color: 'bg-orange-600' },
  { gradient: 'bg-gradient-to-br from-fuchsia-900 to-pink-900', color: 'bg-fuchsia-600' },
  { gradient: 'bg-gradient-to-br from-sky-900 to-blue-900', color: 'bg-sky-600' },
];

function App() {
  const [showHomePage, setShowHomePage] = useState(true);
  const [artist, setArtist] = useState('');
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedAlbums, setSelectedAlbums] = useState<Album[]>([]);
  const [words, setWords] = useState<{text: string, color: string}[]>([]);
  const [newWord, setNewWord] = useState('');
  const [wordCounts, setWordCounts] = useState<WordCount[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [countLoading, setCountLoading] = useState<string | null>(null);
  const [searchProgress, setSearchProgress] = useState<{word: string, song: string} | null>(null);
  const [error, setError] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [backgroundGradient, setBackgroundGradient] = useState(backgroundOptions[0].gradient);
  const [showColorPicker, setShowColorPicker] = useState<string | null>(null);
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
    if (newWord && words.length < 6 && !words.find(w => w.text === newWord)) {
      const newColor = colorOptions[words.length % colorOptions.length];
      setWords([...words, { text: newWord, color: newColor }]);
      setNewWord('');
    }
  };

  const updateWordColor = (wordText: string, newColor: string) => {
    setWords(words.map(w => w.text === wordText ? { ...w, color: newColor } : w));
    setShowColorPicker(null);
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
    setWords(words.filter(w => w.text !== wordToRemove));
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
    setSearchProgress(null);
    const newCounts: WordCount[] = [];
    
    for (const album of selectedAlbums) {
        setCountLoading(album.id);
        
        // Get album tracks first
        const token = await getSpotifyToken();
        const tracksResponse = await fetch(`https://api.spotify.com/v1/albums/${album.id}/tracks`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (tracksResponse.ok) {
          const tracksData = await tracksResponse.json();
          const tracks = tracksData.items;
          
          // Process each word for this album
          for (const word of words) {
            let totalCount = 0;
            
            // Process each track
            for (const track of tracks) {
              setSearchProgress({ word: word.text, song: track.name });
              
              // Add a small delay to show the progress
              await new Promise(resolve => setTimeout(resolve, 500));
              
              const lyrics = await getLyrics(artist, track.name);
              const normalizedLyrics = lyrics.toLowerCase().replace(/[^a-z0-9\s]/g, '');
              const wordCount = normalizedLyrics.split(/\s+/).filter(w => w === word.text.toLowerCase()).length;
              totalCount += wordCount;
            }
            
            newCounts.push({
              artist,
              album: album.name,
              word: word.text,
              count: totalCount,
              albumArt: album.images[0]?.url
            });
          }
        }
        
        try {
          // Backend call removed - now using direct processing above
        } catch (err) {
          setError('Failed to count words');
        }
    }
    
    setSearchProgress(null);
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
    datasets: words.map((word) => ({
      label: word.text,
      data: selectedAlbums.map(album => 
        wordCounts.find(wc => wc.album === album.name && wc.word === word.text)?.count || 0
      ),
      borderColor: word.color,
      backgroundColor: word.color,
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

  if (showHomePage) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center relative"
        style={{
          backgroundImage: 'url(https://i.imgur.com/J9oEGPC.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        {/* Dark overlay for better text readability */}
        <div className="absolute inset-0 bg-black/40"></div>
        
        <div className="relative z-10 text-center text-white">
          <h1 className="text-8xl font-black mb-8 tracking-wider drop-shadow-2xl" style={{ fontFamily: 'Orbitron, monospace' }}>
            LYRICOSITY
          </h1>
          <p className="text-2xl mb-12 drop-shadow-lg max-w-2xl mx-auto leading-relaxed">
            Discover the frequency of words in your favorite artist's albums. 
          
          </p>
          <button
            onClick={() => setShowHomePage(false)}
            className="px-12 py-4 bg-green-600 hover:bg-green-700 rounded-full text-xl font-semibold flex items-center gap-3 mx-auto transition-all transform hover:scale-105 shadow-2xl"
          >
            <Play size={24} />
            Get Started
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${backgroundGradient} text-white p-8`}>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-center mb-8 gap-4">
          <button
            onClick={() => setShowHomePage(true)}
            className="absolute top-8 left-8 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
          >
            ← Home
          </button>
          <h1 className="text-5xl font-black text-center tracking-wider" style={{ fontFamily: 'Orbitron, monospace' }}>
            LYRICOSITY
          </h1>
          <div className="relative">
            <button
              onClick={() => setShowColorPicker(showColorPicker === 'background' ? null : 'background')}
              className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
              title="Change background"
            >
              <Palette size={24} />
            </button>
            {showColorPicker === 'background' && (
              <div className="absolute top-12 right-0 bg-black/80 backdrop-blur-lg rounded-lg p-4 z-50">
                <div className="grid grid-cols-5 gap-2 w-60">
                  {backgroundOptions.map((bg, index) => (
                    <button
                      key={index}
                      onClick={() => setBackgroundGradient(bg.gradient)}
                      className={`w-10 h-10 rounded ${bg.color} border-2 ${backgroundGradient === bg.gradient ? 'border-white' : 'border-gray-400'} transition-all hover:scale-105 hover:border-white`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        
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
                    disabled={!newWord || words.length >= 6 || words.find(w => w.text === newWord)}
                    className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded flex items-center gap-2 disabled:opacity-50"
                  >
                    <Plus size={20} />
                    Add Word
                  </button>
                </div>
                
                {words.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {words.map((word) => (
                      <div
                        key={word.text}
                        className="px-3 py-1 rounded-full flex items-center gap-2 relative"
                        style={{ backgroundColor: word.color }}
                      >
                        <span>{word.text}</span>
                        <button
                          onClick={() => setShowColorPicker(showColorPicker === word.text ? null : word.text)}
                          className="hover:text-gray-300 text-xs"
                          title="Change color"
                        >
                          <Palette size={12} />
                        </button>
                        <button
                          onClick={() => removeWord(word.text)}
                          className="hover:text-red-400"
                        >
                          <X size={16} />
                        </button>
                        {showColorPicker === word.text && (
                          <div className="absolute top-8 left-0 bg-black/80 backdrop-blur-lg rounded-lg p-2 z-50">
                            <div className="grid grid-cols-6 gap-1 max-w-xs">
                              {colorOptions.map((color, index) => (
                                <button
                                  key={index}
                                  onClick={() => updateWordColor(word.text, color)}
                                  className="w-5 h-5 rounded border border-white/20 hover:border-white transition-colors"
                                  style={{ backgroundColor: color }}
                                />
                              ))}
                            </div>
                          </div>
                        )}
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
              
              {searchProgress && (
                <div className="mt-4 p-3 bg-blue-600/50 rounded-lg text-center">
                  <div className="text-sm">
                    Searching for "<span className="font-semibold">{searchProgress.word}</span>" in
                  </div>
                  <div className="text-xs text-blue-200 mt-1 truncate">
                    {searchProgress.song}
                  </div>
                </div>
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