/**
 * ISU GeoBot - AI Chatbot Module
 * Powered by Groq API (LLaMA)
 * 
 * Automatically describes campus locations when markers are clicked,
 * and allows free-form Q&A about the campus.
 */

(function () {
    'use strict';

    // ─── Configuration ───────────────────────────────────────
    const GROQ_API_KEY = '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';
    const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
    const MODEL = 'openai/gpt-oss-120b';

    const SYSTEM_PROMPT = `You are ISU GeoBot, a friendly and knowledgeable AI campus guide for the Isabela State University (ISU) Echague Main Campus, located in San Fabian, Echague, Isabela, Philippines.

Key facts about ISU Echague:
- It is the Main Campus of the Isabela State University system
- Located in San Fabian, Echague, Isabela 3309, Philippines
- Established in 1978; the campus spans approximately 355 hectares
- Coordinates: approximately 16.7218°N, 121.6922°E
- Contact: (078) 258 2461 | echague@isu.edu.ph
- The campus is home to various colleges including Agriculture, Engineering, Education, Arts & Sciences, Business, Computing/ICT, and Criminal Justice Education
- Notable facilities include the CVCDC (Cagayan Valley Cacao Development Center), EMCC (Equipment Manufacturing Cluster Center), and free campus transport bikes
- Key landmarks: Administrative Building, Alba Hall, De Venecia Hall, University Amphitheater, Student Plaza, The Oval, Library Park

Your role:
1. When a user selects a location on the map, provide an engaging, informative description of that place. Include interesting details, what it's used for, its significance to campus life, and any tips for visitors.
2. Answer questions about the campus, its history, facilities, programs, and student life.
3. Be warm, enthusiastic, and use a conversational Filipino-English tone when appropriate (e.g., occasional Tagalog/Filipino expressions).
4. EXTREMELY IMPORTANT: Keep your responses VERY SHORT and to the point. Summarize the information and give only the most important details (1-2 short sentences maximum). Do not write long paragraphs.
5. If you don't know something specific, be honest and suggest the user contact the campus directly.
6. Format responses in plain text. Use line breaks between paragraphs. Avoid markdown syntax like ** or ##.
7. MAP CONTROL: If the user explicitly asks where a specific location is, or asks to see it, append "[LOCATION_ID: <id>]" at the very end of your response, using the exact id of that location from the CURRENT DATABASE LOCATIONS context provided below. (e.g. [LOCATION_ID: admin-building]). Only do this if they are asking to find/see a location.`;

    // ─── State ───────────────────────────────────────────────
    let isOpen = false;
    let isLoading = false;
    let conversationHistory = [];
    let lastDescribedLocationId = null;

    // ─── DOM References ──────────────────────────────────────
    const $fab = document.getElementById('chatbot-fab');
    const $panel = document.getElementById('chatbot-panel');
    const $messages = document.getElementById('chatbot-messages');
    const $typing = document.getElementById('chatbot-typing');
    const $input = document.getElementById('chatbot-input');
    const $sendBtn = document.getElementById('chatbot-send');
    const $closeBtn = document.getElementById('chatbot-close');
    const $clearBtn = document.getElementById('chatbot-clear');
    const $subtitle = document.getElementById('chatbot-subtitle');

    // ─── Initialize ──────────────────────────────────────────
    function init() {
        bindEvents();
        // Add system prompt to conversation history
        conversationHistory.push({
            role: 'system',
            content: SYSTEM_PROMPT
        });
    }

    // ─── Event Bindings ──────────────────────────────────────
    function bindEvents() {
        // Toggle chatbot panel
        $fab.addEventListener('click', togglePanel);
        $closeBtn.addEventListener('click', closePanel);

        // Send message
        $sendBtn.addEventListener('click', handleSend);
        $input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        });

        // Clear chat
        $clearBtn.addEventListener('click', clearChat);

        // Listen for location selection from the map
        window.addEventListener('locationSelected', (e) => {
            const location = e.detail.location;
            handleLocationSelected(location);
        });
    }

    // ─── Panel Toggle ────────────────────────────────────────
    function togglePanel() {
        isOpen ? closePanel() : openPanel();
    }

    function openPanel() {
        isOpen = true;
        $panel.classList.remove('hidden');
        $fab.classList.add('active');
        $input.focus();
        scrollToBottom();
    }

    function closePanel() {
        isOpen = false;
        $panel.classList.add('hidden');
        $fab.classList.remove('active');
    }

    // ─── Location Selected (no auto-describe) ─────────────────
    function handleLocationSelected(location) {
        // Open the chatbot panel
        if (!isOpen) openPanel();

        // Update subtitle to show which location was selected
        $subtitle.textContent = `Selected: ${location.name}`;

        // Pre-fill the input so the user can send it with one click/Enter
        $input.value = `📍 Tell me about ${location.name}`;
        $input.focus();
    }

    // ─── Send User Message ───────────────────────────────────
    function handleSend() {
        const text = $input.value.trim();
        if (!text || isLoading) return;

        $input.value = '';
        addMessage('user', text);
        sendToGroq(text);
    }

    // ─── Groq API Call ───────────────────────────────────────
    async function sendToGroq(userMessage) {
        if (isLoading) return;
        isLoading = true;
        setLoadingState(true);

        // Add to conversation history
        conversationHistory.push({
            role: 'user',
            content: userMessage
        });

        try {
            // Dynamically append live database locations to the system prompt
            let dynamicContext = "";
            if (window.LOCATIONS && window.LOCATIONS.length > 0) {
                dynamicContext = "\n\nCURRENT DATABASE LOCATIONS (Use these exact details if the user asks about them):\n" + 
                    window.LOCATIONS.map(l => `- ID: ${l.id} | Name: ${l.name} (${l.category}): ${l.description}`).join('\n');
            }
            
            const currentMessages = [...conversationHistory];
            currentMessages[0] = {
                role: 'system',
                content: SYSTEM_PROMPT + dynamicContext
            };

            const response = await fetch(GROQ_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${GROQ_API_KEY}`
                },
                body: JSON.stringify({
                    model: MODEL,
                    messages: currentMessages,
                    temperature: 0.7,
                    max_tokens: 600,
                    top_p: 0.9
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error?.message || `API error: ${response.status}`);
            }

            const data = await response.json();
            const reply = data.choices[0]?.message?.content || 'Sorry, I couldn\'t generate a response.';

            // Parse out location ID for map control
            let cleanReply = reply;
            let locationId = null;
            const match = reply.match(/\[LOCATION_ID:\s*([a-zA-Z0-9-]+)\]/i);
            
            if (match) {
                locationId = match[1];
                cleanReply = reply.replace(match[0], '').trim();
            }

            // Add assistant reply to history
            conversationHistory.push({
                role: 'assistant',
                content: cleanReply
            });

            // Keep conversation history manageable (last 20 messages + system)
            if (conversationHistory.length > 21) {
                conversationHistory = [
                    conversationHistory[0], // system prompt
                    ...conversationHistory.slice(-20)
                ];
            }

            addMessage('bot', cleanReply);
            
            // Dispatch event to app.js if a location was found
            if (locationId) {
                window.dispatchEvent(new CustomEvent('chatbotSelectLocation', {
                    detail: { id: locationId }
                }));
            }

            $subtitle.textContent = 'Ask me about any campus location';

        } catch (error) {
            console.error('Groq API Error:', error);
            addMessage('bot', `Oops! Something went wrong: ${error.message}. Please try again.`, 'error-bubble');
        } finally {
            isLoading = false;
            setLoadingState(false);
        }
    }

    // ─── Message Rendering ───────────────────────────────────
    function addMessage(role, text, extraClass = '') {
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-message ${role}`;

        const avatarIcon = role === 'bot' ? 'fa-robot' : 'fa-user';
        const avatarClass = role === 'bot' ? 'bot-avatar' : 'user-avatar';
        const bubbleClass = role === 'bot' ? 'bot-bubble' : 'user-bubble';

        // Format text: convert line breaks to paragraphs for bot messages
        let formattedText;
        if (role === 'bot') {
            const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
            formattedText = paragraphs.map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('');
        } else {
            formattedText = escapeHtml(text);
        }

        msgDiv.innerHTML = `
            <div class="chat-avatar ${avatarClass}">
                <i class="fas ${avatarIcon}"></i>
            </div>
            <div class="chat-bubble ${bubbleClass} ${extraClass}">
                ${formattedText}
            </div>
        `;

        $messages.appendChild(msgDiv);
        scrollToBottom();
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ─── UI Helpers ──────────────────────────────────────────
    function setLoadingState(loading) {
        $typing.classList.toggle('hidden', !loading);
        $sendBtn.disabled = loading;
        $input.disabled = loading;

        if (loading) {
            $input.placeholder = 'GeoBot is thinking...';
            scrollToBottom();
        } else {
            $input.placeholder = 'Ask about a campus location...';
            $input.focus();
        }
    }

    function scrollToBottom() {
        requestAnimationFrame(() => {
            $messages.scrollTop = $messages.scrollHeight;
        });
    }

    function clearChat() {
        // Keep only the welcome message
        const welcomeMsg = $messages.querySelector('.chat-message');
        $messages.innerHTML = '';
        if (welcomeMsg) {
            $messages.appendChild(welcomeMsg);
        }

        // Reset conversation history (keep system prompt)
        conversationHistory = [conversationHistory[0]];
        lastDescribedLocationId = null;
        $subtitle.textContent = 'Ask me about any campus location';
    }

    // ─── Start ───────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', init);

})();
