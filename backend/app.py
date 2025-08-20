from flask import Flask, request, jsonify
from flask_cors import CORS
from spotify_utils import get_spotify_artist_id, get_spotify_albums
from rap_genius_utils import get_song_info_from_genius, count_word_occurrences
from duckdb_utils import check_duckdb_cache, store_in_duckdb
from dotenv import load_dotenv

load_dotenv()
app = Flask(__name__)
CORS(app)


@app.route("/albums", methods=["POST"])
def get_albums():
    #Endpoint that retrieves album art for various albums
    data = request.get_json()
    artist = data.get("artist", "").strip().lower()

    artist_id = get_spotify_artist_id(artist)
    if not artist_id:
        return jsonify({"error": "Artist not found"}), 404

    albums = get_spotify_albums(artist_id)
    if not albums:
        return jsonify({"error": "No albums found"}), 404

    # Convert to JSON-friendly format

    album_map = []
    for album in albums.get("items", []):
        if album.get("images"):
            album_map.append({
                "id": album["id"],
                "name": album["name"],
                "images": album["images"]  # this is already an array of {url, height, width}
            })

    return jsonify({"albums": album_map})

@app.route("/count-word", methods=["POST"])
def count_word():
    #endpoint for counting album words 
    data = request.get_json()
    artist = data.get("artist", "").strip().lower()
    album_id = data.get("albumId")
    album_name = data.get("albumName")
    word = data.get("word", "").strip().lower()

    if not all([artist, album_id, album_name, word]):
        return jsonify({"error": "Missing required parameters"}), 400

    # Check DuckDB cache
    cached = check_duckdb_cache(artist, album_name, word)
    if cached:
        count, album_art = cached
    else:
        count, album_art = count_word_occurrences(album_id, artist, word)
        store_in_duckdb(artist, album_name, word, count, album_art)

    return jsonify({
        "artist": artist,
        "album": album_name,
        "word": word,
        "count": count,
        "albumArt": album_art
    })

if __name__ == "__main__":
    app.run(debug=True)
