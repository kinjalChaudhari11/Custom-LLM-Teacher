from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import google.generativeai as genai
import pdfplumber
import os
import json
from io import BytesIO

app = Flask(__name__)
CORS(app)

# Configure Gemini API
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

def extract_text_from_pdf(pdf_file):
    """Extract text from uploaded PDF file"""
    text = ""
    with pdfplumber.open(pdf_file) as pdf:
        for page in pdf.pages:
            text += page.extract_text() + "\n"
    return text

def generate_game(content, interests, chapter_num=1, previous_choice=None):
    """Generate interactive game chapter using Gemini"""
    
    model = genai.GenerativeModel(
        'gemini-flash-latest',
        generation_config={
            'response_mime_type': 'application/json',
            'response_schema': {
                'type': 'object',
                'properties': {
                    'chapter_number': {'type': 'integer'},
                    'title': {'type': 'string'},
                    'narrative': {'type': 'string'},
                    'concept_explained': {'type': 'string'},
                    'choices': {
                        'type': 'array',
                        'items': {
                            'type': 'object',
                            'properties': {
                                'id': {'type': 'string'},
                                'text': {'type': 'string'},
                                'hint': {'type': 'string'}
                            }
                        }
                    }
                },
                'required': ['chapter_number', 'title', 'narrative', 'concept_explained', 'choices']
            }
        }
    )
    
    if chapter_num == 1:
        prompt = f"""Create Chapter 1 of an educational game.

CONTENT: {content[:4000]}
INTERESTS: {interests}

Write 300 words teaching these concepts through a story about {interests}. Include 3 choices."""
    else:
        prompt = f"""Continue the educational game.

CONTENT: {content[:3000]}
INTERESTS: {interests}
PREVIOUS: {previous_choice}
CHAPTER: {chapter_num}

Write 300 words continuing the story and teaching new concepts. Include 3 choices."""

    try:
        response = model.generate_content(prompt)
        game_data = json.loads(response.text)
        return game_data
    except Exception as e:
        print(f"Error: {e}")
        return {
            "chapter_number": chapter_num,
            "title": f"Chapter {chapter_num}",
            "narrative": "Error generating story. Please try again.",
            "concept_explained": "Error",
            "choices": [
                {"id": "A", "text": "Try again", "hint": "Restart"}
            ]
        }

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/upload', methods=['POST'])
def upload_content():
    """Handle PDF upload or text paste"""
    try:
        content = ""
        
        if 'pdf' in request.files:
            pdf_file = request.files['pdf']
            content = extract_text_from_pdf(pdf_file)
        elif 'text' in request.form:
            content = request.form['text']
        
        if not content:
            return jsonify({"error": "No content provided"}), 400
        
        return jsonify({
            "success": True,
            "content_length": len(content),
            "preview": content[:500] + "..."
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/start-game', methods=['POST'])
def start_game():
    """Start a new game with uploaded content and interests"""
    try:
        data = request.json
        content = data.get('content', '')
        interests = data.get('interests', '')
        
        if not content or not interests:
            return jsonify({"error": "Content and interests required"}), 400
        
        game_data = generate_game(content, interests, chapter_num=1)
        
        return jsonify({
            "success": True,
            "game": game_data
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/continue-game', methods=['POST'])
def continue_game():
    """Continue the game based on player choice"""
    try:
        data = request.json
        content = data.get('content', '')
        interests = data.get('interests', '')
        chapter_num = data.get('chapter_num', 2)
        choice = data.get('choice', '')
        
        game_data = generate_game(content, interests, chapter_num, choice)
        
        return jsonify({
            "success": True,
            "game": game_data
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)