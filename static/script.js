// Game state
let gameState = {
    content: '',
    interests: '',
    currentChapter: 1,
    history: []
};

// DOM Elements
const welcomeScreen = document.getElementById('welcome-screen');
const gameScreen = document.getElementById('game-screen');
const pdfUpload = document.getElementById('pdf-upload');
const textInput = document.getElementById('text-input');
const interestsInput = document.getElementById('interests-input');
const startBtn = document.getElementById('start-btn');
const loading = document.getElementById('loading');
const newGameBtn = document.getElementById('new-game-btn');

// Check if content and interests are provided to enable start button
function checkReadyToStart() {
    const hasContent = gameState.content || textInput.value.trim();
    const hasInterests = interestsInput.value.trim();
    startBtn.disabled = !(hasContent && hasInterests);
}

// Handling th e PDF upload
pdfUpload.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('pdf', file);

    try {
        loading.classList.remove('hidden');
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        
        if (data.success) {
            gameState.content = data.preview;
            textInput.value = `PDF uploaded: ${file.name} (${data.content_length} characters)`;
            textInput.disabled = true;
            checkReadyToStart();
        } else {
            alert('Error uploading PDF: ' + data.error);
        }
    } catch (error) {
        alert('Error uploading PDF: ' + error.message);
    } finally {
        loading.classList.add('hidden');
    }
});

// Handling text input
textInput.addEventListener('input', () => {
    if (textInput.value.trim()) {
        gameState.content = textInput.value;
        pdfUpload.disabled = true;
    } else {
        pdfUpload.disabled = false;
    }
    checkReadyToStart();
});

// Handling interests input
interestsInput.addEventListener('input', checkReadyToStart);

// Start
startBtn.addEventListener('click', async () => {
    gameState.interests = interestsInput.value.trim();
    
    if (!gameState.content) {
        gameState.content = textInput.value.trim();
    }

    if (!gameState.content || !gameState.interests) {
        alert('Please provide both content and your interests!');
        return;
    }

    try {
        loading.classList.remove('hidden');
        startBtn.disabled = true;

        const response = await fetch('/api/start-game', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content: gameState.content,
                interests: gameState.interests
            })
        });

        const data = await response.json();
        console.log('Start game response:', data);

        if (data.success && data.game) {
            gameState.currentChapter = 1;
            gameState.history = [];
            displayGame(data.game);
            switchScreen('game');
        } else {
            alert('Error starting game: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Start game error:', error);
        alert('Error starting game: ' + error.message);
    } finally {
        loading.classList.add('hidden');
        startBtn.disabled = false;
    }
});

// Display game content
function displayGame(gameData) {
    console.log('=== DISPLAY GAME CALLED ===');
    console.log('Full game data:', JSON.stringify(gameData, null, 2));
    
    if (!gameData) {
        console.error('ERROR: No game data received');
        return;
    }

    // Loging  each field
    console.log('Chapter number:', gameData.chapter_number);
    console.log('Title:', gameData.title);
    console.log('Narrative:', gameData.narrative);
    console.log('Concept:', gameData.concept_explained);
    console.log('Choices:', gameData.choices);

    // Update the UI
    const chapterNum = gameData.chapter_number || 1;
    const title = gameData.title || 'Chapter';
    const narrative = gameData.narrative || 'Loading story...';
    const concept = gameData.concept_explained || 'Loading...';

    console.log('Setting chapter-num to:', `Chapter ${chapterNum}`);
    document.getElementById('chapter-num').textContent = `Chapter ${chapterNum}`;
    
    console.log('Setting concept-tag to:', concept);
    document.getElementById('concept-tag').textContent = concept;
    
    console.log('Setting chapter-title to:', title);
    document.getElementById('chapter-title').textContent = title;
    
    console.log('Setting narrative to:', narrative);
    document.getElementById('narrative').textContent = narrative;

    // Update progress bar
    const progress = (chapterNum / 5) * 100;
    document.getElementById('progress').style.width = progress + '%';

    // Show choices
    const choicesContainer = document.getElementById('choices-container');
    choicesContainer.innerHTML = '';

    if (gameData.choices && Array.isArray(gameData.choices) && gameData.choices.length > 0) {
        console.log('Rendering', gameData.choices.length, 'choices');
        gameData.choices.forEach((choice, index) => {
            console.log(`Choice ${index}:`, choice);
            const choiceBtn = document.createElement('button');
            choiceBtn.className = 'choice-btn';
            choiceBtn.innerHTML = `
                <div>
                    <span class="choice-id">${choice.id || 'A'}</span>
                    <span class="choice-text">${choice.text || 'Continue'}</span>
                </div>
                <div class="choice-hint">→ ${choice.hint || 'Continue the story'}</div>
            `;
            choiceBtn.addEventListener('click', () => handleChoice(choice));
            choicesContainer.appendChild(choiceBtn);
        });
    } else {
        console.error('ERROR: No valid choices in game data');
    }
    
    console.log('DISPLAY GAME COMPLETE');
}

// Handle choice selection
async function handleChoice(choice) {
    console.log('Choice selected:', choice);
    
    gameState.history.push({
        chapter: gameState.currentChapter,
        choice: choice
    });
    gameState.currentChapter++;

    // If we've played 5 chapters, end the game
    if (gameState.currentChapter > 5) {
        displayGameEnd();
        return;
    }

    try {
        loading.classList.remove('hidden');
        document.getElementById('choices-container').style.opacity = '0.5';

        console.log('Sending continue request for chapter', gameState.currentChapter);
        
        const response = await fetch('/api/continue-game', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content: gameState.content,
                interests: gameState.interests,
                chapter_num: gameState.currentChapter,
                choice: `${choice.id}: ${choice.text}`
            })
        });

        const data = await response.json();
        console.log('Continue game response:', data);

        if (data.success && data.game) {
            displayGame(data.game);
        } else {
            alert('Error continuing game: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Continue game error:', error);
        alert('Error continuing game: ' + error.message);
    } finally {
        loading.classList.add('hidden');
        document.getElementById('choices-container').style.opacity = '1';
    }
}

// Display game end
function displayGameEnd() {
    document.getElementById('chapter-title').textContent = 'Quest Complete!';
    document.getElementById('narrative').innerHTML = `
        <p>Congratulations! You've completed your learning adventure through ${gameState.currentChapter - 1} chapters.</p>
        <p>You've explored complex concepts through the lens of ${gameState.interests}, making learning both fun and memorable!</p>
        <p><strong>Concepts Mastered:</strong> Check your journey above to see what you've learned.</p>
    `;
    document.getElementById('choices-container').innerHTML = '';
    document.getElementById('progress').style.width = '100%';
}

// New game button
newGameBtn.addEventListener('click', () => {
    switchScreen('welcome');
    resetGame();
});

// Switch between screens
function switchScreen(screen) {
    welcomeScreen.classList.remove('active');
    gameScreen.classList.remove('active');

    if (screen === 'welcome') {
        welcomeScreen.classList.add('active');
    } else if (screen === 'game') {
        gameScreen.classList.add('active');
    }
}

// Reset game state
function resetGame() {
    gameState = {
        content: '',
        interests: '',
        currentChapter: 1,
        history: []
    };
    
    textInput.value = '';
    textInput.disabled = false;
    interestsInput.value = '';
    pdfUpload.value = '';
    pdfUpload.disabled = false;
    startBtn.disabled = true;
}

checkReadyToStart();